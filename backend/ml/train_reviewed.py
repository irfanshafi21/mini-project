"""Retrain from approved topic labels against the unchanged original holdout."""
import argparse, json, re
from pathlib import Path
from train import train, predict, ROOT
from collections import Counter
from train_bloom import train_bloom

def key(text):
    return ' '.join(re.findall(r'[a-z0-9]+',text.replace('_',' ').lower()))


def evaluate(model, rows):
    labels=model['labels']
    predictions=[dict(row,predicted=predict(model,row['topic'])) for row in rows]
    confusion={a:{b:sum(r['label']==a and r['predicted']==b for r in predictions) for b in labels} for a in labels}
    scores=[]
    for label in labels:
        tp=confusion[label][label]
        fp=sum(confusion[k][label] for k in labels if k!=label)
        fn=sum(v for k,v in confusion[label].items() if k!=label)
        scores.append(2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0)
    return {'accuracy':sum(r['label']==r['predicted'] for r in predictions)/len(rows),
            'macroF1':sum(scores)/len(scores),'testExamples':len(rows),
            'confusionMatrix':confusion,'predictions':predictions}


def train_reviewed(reviews):
    baseline=json.loads((ROOT/'dataset.json').read_text(encoding='utf-8'))
    supplemental=json.loads((ROOT/'supplemental.json').read_text(encoding='utf-8'))
    heldout=baseline['test']; validation=supplemental['validation']; benchmark=supplemental['benchmark']
    splits=[baseline['train']+supplemental['train'],validation,benchmark,heldout]
    keys=[{key(r['topic']) for r in rows} for rows in splits]
    if any(keys[i] & keys[j] for i in range(len(keys)) for j in range(i)):
        raise ValueError('Training, validation and test topics must be disjoint')
    blocked=keys[1] | keys[2] | keys[3]
    rows={key(row['topic']):row for row in splits[0]}
    included,excluded,conflicts=set(),set(),set()
    grouped={}
    for row in reviews:
        topic,label=row['topic'].strip(),row['label']; k=key(topic)
        if label not in ['concept','process','comparison','numerical'] or not k:
            raise ValueError('Invalid reviewed topic label')
        if k in blocked:
            excluded.add(k);continue
        grouped.setdefault(k,[]).append({'topic':topic,'label':label})
    accepted=[]
    for k,examples in grouped.items():
        labels={r['label'] for r in examples}
        if len(labels)>1 or (k in rows and rows[k]['label'] not in labels):
            conflicts.add(k);continue
        accepted.append((k,examples[-1]))
    # Bound class skew from repeated definition-only papers; preserve curated data.
    counts=Counter(r['label'] for r in rows.values()); cap=min(counts.values())*2
    for k,row in reversed(accepted):
        if k not in rows and counts[row['label']]>=cap:continue
        if k not in rows:counts[row['label']]+=1
        rows[k]=row;included.add(k)
    training=list(rows.values())
    best=None;best_score=None; best_validation=None
    # Select settings only on validation data; neither test set chooses a candidate.
    for weight in [1,3,5]:
        for alpha in [0.1,0.5,1.0]:
            settings={'wordWeight':weight,'alpha':alpha,'bigrams':True,'balancedPrior':True}
            candidate=train(training,settings); score=evaluate(candidate,validation)
            rank=(score['macroF1'],score['accuracy'])
            if best is None or rank>best_score:best,best_score,best_validation=candidate,rank,score
    legacy=evaluate(best,heldout); independent=evaluate(best,benchmark)
    original=train(baseline['train'])
    report={**legacy,'trainingExamples':len(training),'reviewedTopicsUsed':len(included),
      'heldoutTopicsExcluded':len(excluded),'conflictingTopicsExcluded':len(conflicts),
      'topicOverlap':0,'trainingByClass':dict(Counter(r['label'] for r in training)),
      'validation':best_validation,'independentBenchmark':independent,
      'baselineIndependentBenchmark':evaluate(original,benchmark),
      'selectedSettings':best['featureSettings'],'candidateCount':9,
      'splitHashes':{name:__import__('hashlib').sha256(json.dumps(split,sort_keys=True).encode()).hexdigest() for name,split in [('legacyTest',heldout),('validation',validation),('benchmark',benchmark)]},
      'evaluationKind':'Frozen original holdout; separate validation selection and 48-topic synthetic benchmark',
      'limitations':'Synthetic topic classification only; not faculty-validated, question correctness, difficulty or language-model training. Semantic overlap between related topics can remain.'}
    best['dataSource']='Original plus balanced curated training topics and eligible local/faculty labels; validation and test records excluded'
    bloom,bloom_report=train_bloom(reviews)
    best['bloomModel']=bloom
    report['bloomEvaluation']=bloom_report
    best['trainingReport']=report
    return best,report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--reviews', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    reviews = json.loads(Path(args.reviews).read_text(encoding='utf-8'))
    model, report = train_reviewed(reviews)
    Path(args.output).write_text(json.dumps(model, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(report))
