"""Six-class context-based Bloom classifier, separate from topic classification."""
import json,math,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).parent
LABELS=['K1','K2','K3','K4','K5','K6']
def key(text):return ' '.join(re.findall('[a-z]+',text.lower()))
def features(text):
 words=re.findall('[a-z]+',text.lower())
 return words+['@'+a+' '+b for a,b in zip(words,words[1:])]
def predict(model,text):return max(LABELS,key=lambda label:model['prior'][label]+sum(model['weights'][label].get(w,0) for w in features(text)))
def train_bloom(reviews=None):
 data=json.loads((ROOT/'bloom-dataset.json').read_text());blocked={key(r['text']) for r in data['test']}
 rows={key(r['text']):r for r in data['train']};groups={}
 for r in reviews or []:
  level=r.get('bloom_level');q=r.get('question',{});text=q.get('text','')
  if level in LABELS and text and key(text) not in blocked:groups.setdefault(key(text),[]).append({'text':text,'label':level})
 for k,items in groups.items():
  if len({r['label'] for r in items})==1 and (k not in rows or rows[k]['label']==items[-1]['label']):rows[k]=items[-1]
 counts={l:Counter() for l in LABELS}
 for r in rows.values():counts[r['label']].update(features(r['text']))
 vocab=set().union(*(set(c) for c in counts.values()))
 model={'labels':LABELS,'prior':{l:math.log(1/6) for l in LABELS},'weights':{l:{w:math.log((counts[l][w]+.5)/(sum(counts[l].values())+.5*len(vocab))) for w in vocab} for l in LABELS}}
 predictions=[dict(r,predicted=predict(model,r['text'])) for r in data['test']]
 report={'trainingExamples':len(rows),'testExamples':len(predictions),'accuracy':sum(r['label']==r['predicted'] for r in predictions)/len(predictions),'predictions':predictions,'limitations':'Small synthetic Bloom task benchmark with shared wording templates; overlapping verbs require contextual review. Not educational-quality accuracy.'}
 model['report']=report
 return model,report
if __name__=='__main__':
 m,r=train_bloom();(ROOT/'bloom-model.json').write_text(json.dumps(m,separators=(',',':')));print(json.dumps(r))
