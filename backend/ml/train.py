"""Train a small, transparent topic-type classifier. No API or ML framework required."""
import argparse, json, math, random, re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
SEED = 21
TOPICS = {
 'concept': ['data representation','binary number representation','operating system concepts','database fundamentals','computer network basics','instruction set concepts','memory hierarchy concepts','data abstraction','object oriented principles','digital logic fundamentals','processor registers','cache memory','virtual memory','network protocols','relational database concepts','computer architecture fundamentals'],
 'process': ['instruction execution cycle','interrupt handling process','memory allocation procedure','process scheduling algorithms','pipeline execution stages','data transfer procedure','database transaction processing','network routing procedure','cache replacement algorithms','address translation process','instruction decoding stages','input output transfer process','sorting algorithm steps','packet transmission procedure','deadlock detection algorithm','program compilation stages'],
 'comparison': ['RISC versus CISC processors','RAM versus ROM memory','SRAM and DRAM differences','Harvard versus Von Neumann architecture','hardwired versus microprogrammed control','synchronous versus asynchronous transfer','polling versus interrupts','serial versus parallel communication','direct versus associative mapping','TCP versus UDP protocols','paging versus segmentation','compiler versus interpreter','stack versus queue differences','primary versus secondary memory','static versus dynamic allocation','multiplexer versus decoder'],
 'numerical': ['binary addition arithmetic','decimal to binary conversion','cache hit ratio calculation','CPU execution time calculation','pipeline speedup calculation','memory address calculation','floating point arithmetic','two complement subtraction','binary to hexadecimal conversion','effective memory access time calculation','instruction throughput calculation','binary multiplication arithmetic','disk access time calculation','number base conversion','cache miss penalty calculation','processor performance calculation'],
}

def features(text):
    words = re.findall(r'[a-z]+', text.lower())
    return words + ['#'+word[i:i+3] for word in words for i in range(len(word)-2)]

def train(rows):
    labels = sorted(TOPICS)
    counts = {label: Counter() for label in labels}
    docs = Counter()
    for row in rows:
        docs[row['label']] += 1
        counts[row['label']].update(features(row['topic']))
    vocab = sorted(set().union(*(set(c) for c in counts.values())))
    return {'version':1, 'kind':'multinomial-naive-bayes-topic-type', 'labels':labels,
      'vocabulary':vocab, 'logPrior':{k:math.log(docs[k]/len(rows)) for k in labels},
      'logLikelihood':{k:{w:math.log((counts[k][w]+1)/(sum(counts[k].values())+len(vocab))) for w in vocab} for k in labels},
      'seed':SEED, 'dataSource':'Hand-authored synthetic topic-type labels; not faculty-reviewed questions'}

def predict(model, text):
    return max(model['labels'],key=lambda k:model['logPrior'][k]+sum(model['logLikelihood'][k].get(w,0) for w in features(text)))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--dataset',help='JSON file containing an examples array of topic/label records')
    args=parser.parse_args()
    source=TOPICS
    if args.dataset:
        source={k:[] for k in TOPICS}; seen=set()
        for row in json.loads(Path(args.dataset).read_text(encoding='utf-8'))['examples']:
            topic=row['topic'].strip(); label=row['label']; key=topic.lower()
            if label not in source or not topic or key in seen: raise ValueError('Labels must be supported and topics must be unique and non-empty')
            seen.add(key);source[label].append(topic)
        if any(len(rows)<8 for rows in source.values()): raise ValueError('Provide at least 8 distinct topics per class')
    rng=random.Random(SEED); train_rows=[]; test_rows=[]
    for label, topics in source.items():
        topics=topics.copy(); rng.shuffle(topics)
        cut=int(len(topics)*.75)
        train_rows += [{'topic':t,'label':label} for t in topics[:cut]]
        test_rows += [{'topic':t,'label':label} for t in topics[cut:]]
    model=train(train_rows)
    predictions=[dict(row,predicted=predict(model,row['topic'])) for row in test_rows]
    correct=sum(r['label']==r['predicted'] for r in predictions)
    confusion={a:{b:sum(r['label']==a and r['predicted']==b for r in predictions) for b in model['labels']} for a in model['labels']}
    f1=[]
    for label in model['labels']:
        tp=confusion[label][label]; fp=sum(confusion[k][label] for k in model['labels'] if k!=label); fn=sum(v for k,v in confusion[label].items() if k!=label)
        f1.append(2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0)
    report={'seed':SEED,'trainingExamples':len(train_rows),'testExamples':len(test_rows),'topicOverlap':0,
      'accuracy':correct/len(test_rows),'macroF1':sum(f1)/len(f1),'confusionMatrix':confusion,'predictions':predictions,
      'limitations':'Small synthetic held-out topic classification benchmark, NOT question correctness or educational quality. No neural language model was trained. Faculty review and a larger real dataset are required.'}
    (ROOT/'model.json').write_text(json.dumps(model,separators=(',',':')),encoding='utf-8')
    (ROOT/'dataset.json').write_text(json.dumps({'train':train_rows,'test':test_rows},indent=2),encoding='utf-8')
    (ROOT/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['trainingExamples','testExamples','topicOverlap','accuracy']}))
