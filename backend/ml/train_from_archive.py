"""Train the local Bloom classifier from a supplied GATE question-paper ZIP.

Only text-extractable GATE CS 2022 questions train the candidate. GATE CS 2023
questions are held out by year. Bloom labels are weak labels inferred from the
college verb chart; the report never presents them as faculty-verified truth.
The source ZIP and extracted question text are never written into the project.
"""
import argparse
import json
import re
import zipfile
from pathlib import Path
from train_bloom import train_bloom

try:
    import pymupdf
except ImportError as exc:
    raise SystemExit('Install the PDF text reader first: python -m pip install -r requirements-training.txt') from exc

ROOT = Path(__file__).parent
LEVELS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']
MAX_PDF_BYTES = 30 * 1024 * 1024


def clean_stem(text):
    text = re.sub(r'GATE\s+20\d\d.*?\(CS\)', ' ', text, flags=re.I)
    text = re.sub(r'Computer Science and Information Technology\s*\(CS\)', ' ', text, flags=re.I)
    text = re.sub(r'CS\s+Page\s+\d+\s+of\s+\d+.*$', ' ', text, flags=re.I)
    text = re.sub(r'Page\s+\d+\s+of\s+\d+.*$', ' ', text, flags=re.I)
    text = re.split(r'\(A\)', text, maxsplit=1)[0]
    return ' '.join(text.split()).strip(' \n:.-')


def read_2022_questions(archive):
    """Extract question stems from the text-based portion of the 2022 paper."""
    entry = 'GATE/2022/cs_2022.pdf'
    info = archive.getinfo(entry)
    if info.file_size > MAX_PDF_BYTES:
        raise ValueError(f'{entry} is unexpectedly large')
    document = pymupdf.open(stream=archive.read(entry), filetype='pdf')
    result = {}
    marker = re.compile(r'Q\s*\.\s*(\d{1,2})\s+(?![–-])')
    for page in document:
        text = page.get_text()
        if 'Computer Science and Information Technology (CS)' not in text:
            continue
        matches = list(marker.finditer(text))
        for index, match in enumerate(matches):
            number = int(match.group(1))
            if not 11 <= number <= 65:
                continue
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            stem = clean_stem(text[match.end():end])
            if stem.lower().startswith(('multiple choice questions', 'multiple select questions', 'numerical answer type')):
                continue
            if len(stem) >= 25:
                result[number] = stem
    document.close()
    return result


def read_2023_questions(archive):
    """Extract the 2023 CS question pages; five image-only pages may be absent."""
    entry = 'GATE/2023/cs_2023.pdf'
    info = archive.getinfo(entry)
    if info.file_size > MAX_PDF_BYTES:
        raise ValueError(f'{entry} is unexpectedly large')
    document = pymupdf.open(stream=archive.read(entry), filetype='pdf')
    result = {}
    for number, page_index in zip(range(11, 66), range(7, 62)):
        if page_index >= len(document):
            break
        stem = clean_stem(document[page_index].get_text())
        if len(stem) >= 25:
            result[number] = stem
    document.close()
    return result


def weak_bloom_label(text, verbs):
    """Return a chart-based label only for an unambiguous instructional verb."""
    ownership = {}
    for level in LEVELS:
        for verb in verbs[level]:
            ownership.setdefault(verb.casefold(), set()).add(level)
    # These prompt openers describe a scenario rather than the requested task.
    ignore = {'assume', 'suppose', 'let', 'given', 'consider'}
    candidates = []
    for verb, levels in ownership.items():
        if len(levels) != 1 or verb in ignore:
            continue
        match = re.search(r'(?<![a-z])' + re.escape(verb) + r'(?![a-z])', text, re.I)
        if match:
            candidates.append((match.start(), -len(verb), next(iter(levels))))
    if not candidates:
        return None
    return min(candidates)[2]


def bloom_features(text):
    words = re.findall(r'[a-z]+', text.lower())
    return words + ['@' + left + ' ' + right for left, right in zip(words, words[1:])]


def predict(model, text):
    features = bloom_features(text)
    return max(model['labels'], key=lambda label: model['prior'][label] + sum(model['weights'][label].get(feature, 0) for feature in features))


def score(model, rows, classifier=predict):
    confusion = {label: {pred: 0 for pred in LEVELS} for label in LEVELS}
    for row in rows:
        confusion[row['label']][classifier(model, row['text'])] += 1
    total = sum(sum(values.values()) for values in confusion.values())
    accuracy = sum(confusion[level][level] for level in LEVELS) / total if total else 0
    f1 = []
    for label in LEVELS:
        tp = confusion[label][label]
        fp = sum(confusion[other][label] for other in LEVELS if other != label)
        fn = sum(confusion[label][other] for other in LEVELS if other != label)
        f1.append(2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0)
    return {'examples': total, 'accuracy': accuracy, 'macroF1': sum(f1) / len(LEVELS),
            'labels': {label: sum(confusion[label].values()) for label in LEVELS},
            'confusionMatrix': confusion}


def predict_with_chart_verb(model, text, verbs):
    ownership = {}
    for level in LEVELS:
        for verb in verbs[level]:
            ownership.setdefault(verb.casefold(), set()).add(level)
    clean = text.strip().replace('“', '').replace('"', '')
    for verb in sorted(ownership, key=len, reverse=True):
        if len(ownership[verb]) == 1 and re.match(r'(?i)^' + re.escape(verb) + r'(?:\b|\s)', clean):
            return next(iter(ownership[verb]))
    return predict(model, text)


def score_with_chart_verbs(model, rows, verbs):
    return score(model, rows, lambda candidate, text: predict_with_chart_verb(candidate, text, verbs))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, help='Path to All_Past_Exam_Papers_with_Syllabi.zip')
    parser.add_argument('--output', default=str(ROOT / 'bloom-model.json'))
    parser.add_argument('--report', default=str(ROOT / 'archive-evaluation.json'))
    parser.add_argument('--integrate', action='store_true', help='Also update bloomModel embedded in model.json')
    args = parser.parse_args()
    archive_path = Path(args.archive)
    if not archive_path.is_file():
        raise SystemExit(f'Archive not found: {archive_path}')

    with zipfile.ZipFile(archive_path) as archive:
        train_papers = read_2022_questions(archive)
        heldout_papers = read_2023_questions(archive)
        # The archive is read in place. Reject unsafe names even though no files
        # are extracted, and cap the selected source entries before reading.
        for info in archive.infolist():
            if '..' in Path(info.filename).parts or info.filename.startswith(('/', '\\')):
                raise ValueError('Archive contains an unsafe path')

    verbs = json.loads((ROOT / 'bloom-verbs.json').read_text(encoding='utf-8'))
    training = [{'text': stem, 'label': weak_bloom_label(stem, verbs)} for stem in train_papers.values()]
    testing = [{'text': stem, 'label': weak_bloom_label(stem, verbs)} for stem in heldout_papers.values()]
    training = [row for row in training if row['label']]
    testing = [row for row in testing if row['label']]
    if len(training) < 8 or len(testing) < 8:
        raise SystemExit('Not enough clear verb-labeled questions to evaluate training safely.')

    # Keep the hand-authored examples that cover all six levels, then add the
    # earlier exam year. The later year is never used for fitting or tuning.
    dataset = json.loads((ROOT / 'bloom-dataset.json').read_text(encoding='utf-8'))
    fit_rows = dataset['train'] + training
    class_counts = {level: sum(row['label'] == level for row in fit_rows) for level in LEVELS}
    if any(not class_counts[level] for level in LEVELS):
        raise SystemExit('Training data must retain examples from all K1-K6 levels.')
    # Inverse-frequency example weighting keeps the paper's K1-heavy wording
    # from overwhelming the smaller levels. Each token is capped per question.
    import math
    from collections import Counter
    token_counts = {level: Counter() for level in LEVELS}
    for row in fit_rows:
        weight = min(4.0, len(fit_rows) / (len(LEVELS) * class_counts[row['label']]))
        token_counts[row['label']].update({feature: weight for feature in set(bloom_features(row['text']))})
    vocabulary = set().union(*(set(counter) for counter in token_counts.values()))
    model = {'labels': LEVELS, 'prior': {level: math.log(1 / len(LEVELS)) for level in LEVELS},
             'weights': {level: {word: math.log((token_counts[level][word] + .5) /
                        (sum(token_counts[level].values()) + .5 * len(vocabulary))) for word in vocabulary}
                         for level in LEVELS}}

    authored_test = dataset['test']
    authored_report = score_with_chart_verbs(model, authored_test, verbs)
    archive_report = score(model, testing)
    # The baseline uses the bundled model with no archive-derived examples.
    # Rebuild the frozen authored-only baseline so a repeated training run is
    # reproducible even after an archive candidate has already been promoted.
    baseline, _ = train_bloom()
    baseline_archive = score(baseline, testing)
    baseline_authored = score_with_chart_verbs(baseline, authored_test, verbs)
    model['report'] = {'trainingExamples': len(fit_rows), 'testExamples': len(authored_test),
                       'accuracy': authored_report['accuracy'], 'macroF1': authored_report['macroF1'],
                       'limitations': 'Training includes weak labels inferred from the college Bloom verb list. GATE 2023 is a held-out paper year, but its labels are also verb-inferred, not faculty-verified. These scores measure agreement with the verb heuristic, not question correctness or educational quality.'}
    report = {'source': 'User-supplied archive; GATE Computer Science papers only',
              'trainingPaperYear': 2022, 'heldOutPaperYear': 2023,
              'extractedQuestionCounts': {'2022': len(train_papers), '2023': len(heldout_papers)},
              'weakLabelCounts': {'2022': {level: sum(row['label'] == level for row in training) for level in LEVELS},
                                  '2023': {level: sum(row['label'] == level for row in testing) for level in LEVELS}},
              'baselineHeldOut': baseline_archive, 'candidateHeldOut': archive_report,
              'authoredSyntheticBenchmarkWithCollegeVerbRule': authored_report,
              'baselineAuthoredSyntheticBenchmarkWithCollegeVerbRule': baseline_authored,
              'promoted': archive_report['macroF1'] > baseline_archive['macroF1'] and
                          authored_report['macroF1'] >= baseline_authored['macroF1'],
              'labeling': 'Only unambiguous action verbs from the college verb chart; ambiguous or unlabeled prompts are omitted.',
              'limitations': 'This ZIP contains no faculty Bloom annotations. Weak labels reproduce the verb chart and must not be presented as educational accuracy. Some PDF pages contain no extractable text. The original archive and question text are not copied to the project.'}
    if not report['promoted']:
        print(json.dumps(report, indent=2))
        raise SystemExit('Candidate did not beat both held-out safeguards; active model was left unchanged.')
    model['dataSource'] = 'Hand-authored examples plus weakly labeled GATE CS 2022 question stems; GATE CS 2023 held out by year'
    Path(args.output).write_text(json.dumps(model, separators=(',', ':')), encoding='utf-8')
    Path(args.report).write_text(json.dumps(report, indent=2), encoding='utf-8')
    if args.integrate:
        integrated = json.loads((ROOT / 'model.json').read_text(encoding='utf-8'))
        integrated['bloomModel'] = model
        (ROOT / 'model.json').write_text(json.dumps(integrated, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
