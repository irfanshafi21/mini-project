"""Retrain from approved topic labels against the unchanged original holdout."""
import argparse, json, re
from pathlib import Path
from train import train, predict, ROOT

def key(text):
    return re.sub(r'\s+', ' ', text.replace('_', ' ').strip().lower())

def train_reviewed(reviews):
    baseline = json.loads((ROOT / 'dataset.json').read_text(encoding='utf-8'))
    heldout = baseline['test']
    blocked = {key(row['topic']) for row in heldout}
    rows = {key(row['topic']): row for row in baseline['train']}
    included, excluded = set(), set()
    for row in reviews:
        topic, label = row['topic'].strip(), row['label']
        if label not in ['concept', 'process', 'comparison', 'numerical'] or not topic:
            raise ValueError('Invalid reviewed topic label')
        k = key(topic)
        if k in blocked:
            excluded.add(k)
            continue
        rows[k] = {'topic': topic, 'label': label}
        included.add(k)
    model = train(list(rows.values()))
    predictions = [dict(row, predicted=predict(model, row['topic'])) for row in heldout]
    correct = sum(row['label'] == row['predicted'] for row in predictions)
    labels = model['labels']
    confusion = {a: {b: sum(r['label'] == a and r['predicted'] == b for r in predictions) for b in labels} for a in labels}
    scores = []
    for label in labels:
        tp = confusion[label][label]
        fp = sum(confusion[k][label] for k in labels if k != label)
        fn = sum(v for k, v in confusion[label].items() if k != label)
        scores.append(2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0)
    report = {'trainingExamples': len(rows), 'testExamples': len(heldout),
              'reviewedTopicsUsed': len(included), 'heldoutTopicsExcluded': len(excluded),
              'topicOverlap': 0, 'accuracy': correct/len(heldout), 'macroF1': sum(scores)/len(scores),
              'confusionMatrix': confusion, 'evaluationKind': 'Frozen original topic-classification holdout',
              'limitations': 'This score does not measure question correctness, difficulty or a generative language model.'}
    model['dataSource'] = 'Original training set plus explicitly approved topic labels; frozen holdout excluded'
    model['trainingReport'] = report
    return model, report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--reviews', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    reviews = json.loads(Path(args.reviews).read_text(encoding='utf-8'))
    model, report = train_reviewed(reviews)
    Path(args.output).write_text(json.dumps(model, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(report))
