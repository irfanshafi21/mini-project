import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewLocally } from '../src/automaticLearning.js';
test('our local classifiers review without network and exclude unverified manual questions',async()=>{
 const rows=await reviewLocally({questions:[{topic:'CPU registers',text:'Define the program counter.',marks:2,unit:1,bloomLevel:'K1',bloomSource:'local-model',questionType:'SHORT'}, {topic:'CPU registers',text:'Describe everything about processors.',marks:2,unit:1,bloomSource:'assigned',questionType:'SHORT'}]});
 assert.equal(rows[0].approved,true);assert.equal(rows[0].bloomLevel,'K1');assert.equal(rows[1].approved,false);
});
