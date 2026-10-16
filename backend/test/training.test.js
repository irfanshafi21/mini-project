import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyTopic } from '../src/localModel.js';

test('balanced trainer excludes validation/test topics and conflicting review labels',()=>{
 const code=`import json
from train_reviewed import train_reviewed,key
from train import ROOT,predict
a=json.loads((ROOT/'dataset.json').read_text()); b=json.loads((ROOT/'supplemental.json').read_text())
reviews=[dict(b['validation'][0]),dict(b['benchmark'][0]),dict(a['test'][0]),{'topic':'Unique reviewed alpha','label':'concept'},{'topic':'Unique reviewed alpha','label':'process'}]
m,r=train_reviewed(reviews)
assert r['heldoutTopicsExcluded']==3
assert r['conflictingTopicsExcluded']==1
assert len(set(r['trainingByClass'].values()))==1
assert r['testExamples']==16 and r['independentBenchmark']['testExamples']==48
assert r['validation']['testExamples']==32
assert r['topicOverlap']==0
assert r['splitHashes']['benchmark']
assert r['candidateCount']==9\nassert r['bloomEvaluation']['testExamples']==24\nassert m['bloomModel']['labels']==['K1','K2','K3','K4','K5','K6']
print(json.dumps({'parity':[{'topic':row['topic'],'predicted':predict(m,row['topic'])} for row in b['benchmark']]}))`;
 const run=spawnSync(process.env.PYTHON_COMMAND || 'python',['-c',code],{cwd:fileURLToPath(new URL('../ml/',import.meta.url)),encoding:'utf8',windowsHide:true});
 assert.equal(run.status,0,run.stderr);
 for(const row of JSON.parse(run.stdout).parity)assert.equal(classifyTopic(row.topic),row.predicted,'Python/JavaScript prediction mismatch: '+row.topic);
});
