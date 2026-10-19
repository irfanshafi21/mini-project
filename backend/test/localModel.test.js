import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTopic, classifySourceQuestionStyle, generateLocalQuestions, syllabusTopics, questionHash, reuseSignature } from '../src/localModel.js';

test('local model predicts learned topic families and reads numeric/roman units', () => {
  assert.equal(classifyTopic('binary addition arithmetic'),'numerical');
  assert.equal(classifyTopic('RISC versus CISC processors'),'comparison');
  assert.deepEqual(syllabusTopics('Unit I: CPU registers\nUnit III: Cache memory').map(t=>t.unit),[1,3]);
  const extracted=syllabusTopics('Course objectives\nLearn concepts\nUnit 1: Memory organisation - 9 hours\nCache memory and\naddress fields.\nLearning outcomes: draw a diagram\nCompare registers\nUnit 2: CPU registers\nAssessment scope\nUnrelated excluded topics');
  assert.ok(extracted.some(t=>t.topic==='Cache memory and address fields'));
  assert.ok(extracted.every(t=>!/hours|diagram|excluded|Compare registers/.test(t.topic)));
});
test('local generation changes questions and reports finite-capacity exhaustion honestly', () => {
  const text='Unit 1: CPU registers\nUnit 3: Cache memory hierarchy';
  const slots=Array.from({length:2},()=>({marks:2,difficulty:'EASY'}));
  const first=generateLocalQuestions(text,slots), hashes=first.map(q=>questionHash(q.text));
  const second=generateLocalQuestions(text,slots,hashes);
  assert.ok(second.every(q=>!hashes.includes(questionHash(q.text))));
  assert.equal(new Set(first.map(q=>q.unit)).size,2);
  const all=generateLocalQuestions('Unit 1: CPU registers\nUnit 3: Virtual memory',Array.from({length:14},()=>slots[0]));
  assert.equal(new Set(all.map(q=>q.text)).size,14);
  assert.throws(()=>generateLocalQuestions('Unit 1: CPU registers\nUnit 3: Virtual memory',slots,all.map(q=>questionHash(q.text)),'MCQ',{previousSignatures:all.map(reuseSignature)}),e=>e.status===409);
});


test('Q103 regression: marks constrain scope independently of difficulty', () => {
  const syllabus='Unit 4: Virtual memory concepts: pages, frames, page tables, translation lookaside buffer and page faults.';
  for (const difficulty of ['EASY','MEDIUM','HARD']) {
    const [short]=generateLocalQuestions(syllabus,[{marks:2,difficulty}]);
    assert.equal(short.topic,'Virtual memory');
    assert.ok(!/pages|frames|page tables|lookaside|and|diagram|analyse/i.test(short.text));
    assert.ok(short.text.split(/\s+/).length<=10);
  }
  for(const marks of [10,16]) {
    const [long]=generateLocalQuestions(syllabus,[{marks,difficulty:'EASY'}]);
    const allocated=[...long.text.matchAll(/\((\d+) marks\)/g)].reduce((n,m)=>n+Number(m[1]),0);
    assert.equal(allocated,marks);
    assert.match(long.text,/\(a\).*\n\(b\).*\n\(c\)/);
  }
});


test('syllabus formatting is removed and unit headings do not replace actual topics', () => {
  const text='# GATE Data Science syllabus\n## Unit 1: Probability and Statistics\n- **Conditional probability**\n- Bayes theorem\n## Unit 2: Linear Algebra\nEigenvalues and eigenvectors.';
  const topics=syllabusTopics(text);
  assert.deepEqual(topics.map(t=>t.topic),['Conditional probability','Bayes theorem','Eigenvalues and eigenvectors']);
  assert.deepEqual(topics.map(t=>t.unit),[1,1,2]);
  const questions=generateLocalQuestions(text,[{marks:2,difficulty:'EASY'}]);
  assert.ok(questions.every(q=>!/[#*`]/.test(q.text)));
});


test('PDF bullet headings and page numbers do not become question topics', () => {
  const extracted=syllabusTopics('Probability and Statistics • Bayes theorem • Conditional expectation and variance. Artificial Intelligence • Search. Cross-validation (LOO; k-fold). Singular value decomposition (SVD) 3');
  assert.deepEqual(extracted.map(t=>t.topic),['Bayes theorem','Conditional expectation and variance','Search','Cross-validation (LOO; k-fold)','Singular value decomposition (SVD)']);
});


test('checked objective facts produce one correct option and blanks without revealing answers', () => {
  const text='Unit 1: Data structures\nStacks. Queues. Binary search. Linear search.';
  const mcq=generateLocalQuestions(text,[{marks:1,difficulty:'EASY'}],[],'MCQ')[0];
  assert.equal(mcq.questionType,'MCQ');assert.equal(mcq.options.length,4);
  assert.equal(mcq.options.filter(o=>o===mcq.answer).length,1);
  assert.ok(mcq.options.every(o=>['Stack','Queue','Binary search','Linear search','Merge sort','Hash table'].includes(o)));
  const blank=generateLocalQuestions(text,[{marks:1,difficulty:'EASY'}],[],'FILL_BLANK')[0];
  assert.equal(blank.options.length,0);assert.match(blank.text,/____/);
  assert.ok(!blank.text.toLowerCase().includes(blank.answer.toLowerCase()));
  assert.throws(()=>generateLocalQuestions('Unit 1: Unsupported advanced topic',[{marks:1,difficulty:'EASY'}]),e=>e.status===409);
});

 test('topic labels do not fabricate numerical values; authored numerical problems are preserved',()=>{
 const source='Unit 1: Binary addition arithmetic';
 const slot={marks:2,difficulty:'EASY'};
 const topicOnly=generateLocalQuestions(source,[slot])[0];
 assert.doesNotMatch(topicOnly.text,/\d/);
 const authored='Unit 1: Numerical methods\nCalculate the velocity when distance = 120 m and time = 10 s.';
 const [q]=generateLocalQuestions(authored,[slot]);
 assert.equal(q.text,'Calculate the velocity when distance = 120 m and time = 10 s.');
 });


test('unit and chapter scope excludes every out-of-scope syllabus candidate', () => {
  const text='Unit 1: CPU registers\nProgram counter and instruction register.\nUnit 2: Cache memory\nCache hit rate and miss penalty.';
  const slots=Array.from({length:2},()=>({marks:2,difficulty:'EASY'}));
  const unitOne=generateLocalQuestions(text,slots,[],'MCQ',{units:[1]});
  assert.ok(unitOne.every(q=>q.unit===1));
  const chapter=generateLocalQuestions(text,[slots[0]],[],'MCQ',{units:[2],chapters:['Cache hit rate and miss penalty']});
  assert.ok(chapter.every(q=>q.unit===2 && q.syllabusReference==='Cache hit rate and miss penalty'));
  assert.throws(()=>generateLocalQuestions(text,[slots[0]],[],'MCQ',{units:[1],chapters:['Cache hit rate and miss penalty']}),e=>e.status===400 && /not found/.test(e.message));
  assert.throws(()=>generateLocalQuestions(text,[slots[0]],[],'MCQ',{units:[5]}),e=>e.status===409 && /No syllabus chapters/.test(e.message));
});

test('subject-appropriate source problems preserve math, values, units, code, and short expressions',()=>{
 const theory='Unit 1: Biology\nExplain how photosynthesis converts light energy into chemical energy.';
 const [theoryQ]=generateLocalQuestions(theory,[{marks:5,difficulty:'MEDIUM'}]);
 assert.equal(theoryQ.text,'Explain how photosynthesis converts light energy into chemical energy.');
 const dataStructures='Unit 1: Stacks\nTrace the push(4), push(7), pop() operations and state the final stack.';
 const [stackQ]=generateLocalQuestions(dataStructures,[{marks:5,difficulty:'MEDIUM'}]);
 assert.equal(stackQ.text,'Trace the push(4), push(7), pop() operations and state the final stack.');
 const operation='Unit 1: Stacks\nPush 4 and 7 onto the stack, then pop once. State the resulting stack.';
 const [operationQ]=generateLocalQuestions(operation,[{marks:5,difficulty:'MEDIUM'}]);
 assert.equal(operationQ.text,'Push 4 and 7 onto the stack, then pop once. State the resulting stack.');
 const math='Unit 1: Algebra\nSolve x^2 + 3x + 2 = 0.';
 const [equation]=generateLocalQuestions(math,[{marks:5,difficulty:'MEDIUM'}]);
 assert.equal(equation.text,'Solve x^2 + 3x + 2 = 0.');
 const numerical='Unit 1: Mechanics\nCalculate the force when mass = 4 kg and acceleration = 3 m/s^2.';
 const [calculation]=generateLocalQuestions(numerical,[{marks:5,difficulty:'MEDIUM'}]);
 assert.match(calculation.text,/4 kg and acceleration = 3 m\/s\^2/);
 const wordProblem='Unit 1: Mechanics\nA 10 kg body accelerates at 2 m/s^2. Calculate the force.';
 const [wordCalculation]=generateLocalQuestions(wordProblem,[{marks:5,difficulty:'MEDIUM'}]);
 assert.equal(wordCalculation.text,'Calculate the following problem using the supplied information:\nA 10 kg body accelerates at 2 m/s^2. Calculate the force.');
 const code='Unit 1: Programming\nint add(int a, int b) {\n  return a + b;\n}';
 const [trace]=generateLocalQuestions(code,[{marks:5,difficulty:'MEDIUM'}]);
 assert.match(trace.text,/int add\(int a, int b\)/);
 assert.match(trace.text,/return a \+ b;/);
 const short='Unit 1: Logic\nx = 1';
 const [shortQ]=generateLocalQuestions(short,[{marks:2,difficulty:'EASY'}]);
 assert.match(shortQ.text,/x = 1/);
});

test('generated content respects selected unit and removes duplicate candidate text',()=>{
 const source='Unit 1: Operating systems\nProcess scheduling. Process scheduling.\nUnit 2: Thermodynamics\nFirst law of thermodynamics.';
 const result=generateLocalQuestions(source,[{marks:2,difficulty:'EASY'},{marks:2,difficulty:'EASY'}],[],'MCQ',{units:[2]});
 assert.ok(result.every(q=>q.unit===2));
 assert.ok(result.every(q=>/First law/.test(q.syllabusReference)));
 assert.equal(new Set(result.map(q=>questionHash(q.text))).size,result.length);
});

test('syllabus generation prefers matching stored operation, numerical, and code questions within selected units',()=>{
 const source='Unit 1: Mechanics\nKinematics.\nUnit 2: Programming\nStacks.';
 const bankQuestions=[
  {id:101,code:'Q101',subject:'PHYSICS',unit:1,topic:'Kinematics',subtopic:'Motion',marks:5,difficulty:'MEDIUM',text:'A 10 kg body accelerates at 2 m/s^2. Calculate the force.',questionType:'SHORT',options:[],answer:'',bloomLevel:'K3'},
  {id:102,code:'Q102',subject:'COMPUTING',unit:2,topic:'Stacks',subtopic:'Push and pop',marks:5,difficulty:'MEDIUM',text:'Write a program to push two values and pop the top value.',questionType:'SHORT',options:[],answer:'',bloomLevel:'K3'},
  {id:103,code:'Q103',subject:'PHYSICS',unit:3,topic:'Kinematics',subtopic:'Motion',marks:5,difficulty:'MEDIUM',text:'Out-of-scope unit question',questionType:'SHORT',options:[],answer:'',bloomLevel:'K3'},
  {id:104,code:'Q104',subject:'PHYSICS',unit:1,topic:'Thermodynamics',subtopic:'First law',marks:5,difficulty:'MEDIUM',text:'Unmatched chapter question',questionType:'SHORT',options:[],answer:'',bloomLevel:'K3'},
 ];
 const paper=generateLocalQuestions(source,[{marks:5,difficulty:'MEDIUM'},{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{units:[1,2],chapters:['Kinematics','Stacks'],bankQuestions});
 assert.deepEqual(new Set(paper.map(q=>q.text)),new Set(bankQuestions.slice(0,2).map(q=>q.text)));
 assert.deepEqual(new Set(paper.map(q=>q.unit)),new Set([1,2]));
 assert.ok(paper.every(q=>!('_fromBank' in q)));
});

test('stored numerical and programming questions survive syllabus Bloom-level selection',()=>{
 const source='Unit 1: Mechanics\nKinematics.\nUnit 2: Programming\nStacks.';
 const bankQuestions=[
  {unit:1,topic:'Kinematics',subtopic:'Motion',marks:5,difficulty:'MEDIUM',text:'A 10 kg body accelerates at 2 m/s^2. Calculate the force.',questionType:'SHORT',options:[],answer:'',bloomSource:'local-model'},
  {unit:2,topic:'Stacks',subtopic:'Operations',marks:5,difficulty:'MEDIUM',text:'Write a program to push two values and pop the top value.',questionType:'SHORT',options:[],answer:'',bloomSource:'local-model'},
 ];
 const paper=generateLocalQuestions(source,[{marks:5,difficulty:'MEDIUM',bloomLevel:'K3'},{marks:5,difficulty:'MEDIUM',bloomLevel:'K6'}],[],'MCQ',{bankQuestions});
 assert.ok(paper.some(q=>q.text.includes('10 kg body accelerates')));
 assert.ok(paper.some(q=>q.text.includes('Write a program to push')));
});

test('question styles preserve problem solving, programming, SQL, and theory choices',()=>{
 const styles=[
  ['Solve x^2 + 3x + 2 = 0.','PROBLEM_SOLVING'],
  ['A 12 V source across a 6 ohm resistor: calculate the current.','PROBLEM_SOLVING'],
  ['Write a C program to reverse an array.','PROGRAMMING_SQL'],
  ['SELECT name FROM students WHERE mark > 50;','PROGRAMMING_SQL'],
  ['Explain the purpose of normalization in database design.','THEORY'],
 ];
 for(const [text,expected] of styles)assert.equal(classifySourceQuestionStyle(text),expected);
 const authoredMath=generateLocalQuestions('Unit 1: Algebra\nSolve x^2 + 3x + 2 = 0.',[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{questionStyle:'PROBLEM_SOLVING'});
 assert.match(authoredMath[0].text,/Solve x\^2/);
 const source='Unit 1: Algebra\nQuadratic equations.';
 const bankQuestions=[
  {unit:1,topic:'Quadratic equations',subtopic:'Roots',marks:5,difficulty:'MEDIUM',text:'Solve x^2 + 3x + 2 = 0.',questionType:'SHORT'},
  {unit:1,topic:'Quadratic equations',subtopic:'Roots',marks:5,difficulty:'MEDIUM',text:'Explain the purpose of the quadratic formula.',questionType:'SHORT'},
 ];
 assert.equal(generateLocalQuestions(source,[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{bankQuestions,questionStyle:'PROBLEM_SOLVING'})[0].text,bankQuestions[0].text);
 assert.equal(generateLocalQuestions(source,[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{bankQuestions,questionStyle:'THEORY'})[0].text,bankQuestions[1].text);
 assert.throws(()=>generateLocalQuestions(source,[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{bankQuestions,questionStyle:'PROGRAMMING_SQL'}),e=>e.status===409 && /Insufficient/.test(e.message));
 const sqlSource='Unit 1: Database systems\nSQL queries and relational algebra.';
 const [sqlQuestion]=generateLocalQuestions(sqlSource,[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{questionStyle:'PROGRAMMING_SQL',bankQuestions:[{unit:1,topic:'SQL queries',subtopic:'SELECT statements',marks:5,difficulty:'MEDIUM',text:'SELECT name FROM students WHERE mark > 50;',questionType:'SHORT'}]});
 assert.match(sqlQuestion.text,/SELECT name FROM students/);
 const circuitSource='Unit 1: Circuit analysis\nOhm law and resistive circuits.';
 const [circuitQuestion]=generateLocalQuestions(circuitSource,[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{questionStyle:'PROBLEM_SOLVING',bankQuestions:[{unit:1,topic:'Ohm law',subtopic:'Resistive circuits',marks:5,difficulty:'MEDIUM',text:'A 12 V source is connected across a 6 ohm resistor. Calculate the current.',questionType:'SHORT'}]});
 assert.match(circuitQuestion.text,/12 V source.*6 ohm resistor/);
});

test('two-mark K1 recall generation works across engineering topics and prefers a valid bank stem over a stale Bloom label',()=>{
 const cases=[
  ['Unit 1: Mathematics\nDifferential equations.','differential equations'],
  ['Unit 1: Programming\nFunctions and arrays.','functions'],
  ['Unit 1: Data Structures\nStacks and queue operations.','Stacks'],
  ['Unit 1: DBMS\nRelational keys and normalization.','Relational keys'],
  ['Unit 1: Mechanical Engineering\nThermodynamic cycles.','Thermodynamic cycles'],
 ];
 for(const [syllabus,topic] of cases){
  const questions=generateLocalQuestions(syllabus,[{marks:2,difficulty:'EASY',bloomLevel:'K1'}]);
  assert.equal(questions[0].marks,2);
  assert.equal(questions[0].bloomLevel,'K1');
  assert.match(questions[0].text,new RegExp(topic,'i'));
  assert.match(questions[0].text,/^(Define|List|Name|Recall|Show)\b/);
 }
 const [bankRecall]=generateLocalQuestions('Unit 1: Differential equations.',[{marks:2,difficulty:'EASY',bloomLevel:'K1'}],[],'MCQ',{bankQuestions:[{unit:1,topic:'Differential equations',subtopic:'',marks:2,difficulty:'EASY',text:'Define a differential equation.',questionType:'SHORT',bloomLevel:'K2',bloomSource:'assigned'}]});
 assert.equal(bankRecall.text,'Define a differential equation.');
 assert.equal(bankRecall.bloomLevel,'K1');
});

test('K1 questions stay unique and true source exhaustion reports the valid count',()=>{
 const syllabus='Unit 1: Data Structures\nStacks.';
 const slots=Array.from({length:6},()=>({marks:2,difficulty:'EASY',bloomLevel:'K1'}));
 const generated=generateLocalQuestions(syllabus,slots);
 assert.equal(new Set(generated.map(q=>questionHash(q.text))).size,generated.length);
 assert.equal(new Set(generated.map(q=>reuseSignature(q))).size,generated.length);
 assert.throws(()=>generateLocalQuestions(syllabus,[slots[0]],generated.map(q=>questionHash(q.text))),e=>e.status===409 && /found 0 of 1 valid questions/.test(e.message));
});

test('topic-aware numerical, coding, SQL, and engineering problem candidates respect style, units, marks, and difficulty',()=>{
 const cases=[
  {syllabus:'Unit 1: Calculus\nIntegration.',style:'PROBLEM_SOLVING',slot:{marks:5,difficulty:'MEDIUM',bloomLevel:'K3'},pattern:/integral.*x\^/i},
  {syllabus:'Unit 1: Programming\nArrays and functions.',style:'PROGRAMMING_SQL',slot:{marks:5,difficulty:'HARD',bloomLevel:'K6'},pattern:/pseudocode.*input \[.*\].*time complexity/i},
  {syllabus:'Unit 1: Data Structures\nStack operations.',style:'PROBLEM_SOLVING',slot:{marks:2,difficulty:'EASY',bloomLevel:'K3'},pattern:/Trace.*stack.*push.*pop/i},
  {syllabus:'Unit 1: Database Systems\nSQL queries.',style:'PROGRAMMING_SQL',slot:{marks:5,difficulty:'MEDIUM',bloomLevel:'K6'},pattern:/Student\(student_id, name, mark\).*SQL query/i},
  {syllabus:'Unit 1: Electrical Engineering\nOhm law and resistive circuits.',style:'PROBLEM_SOLVING',slot:{marks:5,difficulty:'MEDIUM',bloomLevel:'K3'},pattern:/\d+ V source.*\d+ Ω resistor.*current/i},
  {syllabus:'Unit 1: Mechanical Engineering\nThermodynamics and heat transfer.',style:'PROBLEM_SOLVING',slot:{marks:5,difficulty:'EASY',bloomLevel:'K3'},pattern:/specific heat capacity.*Q = mcΔT/i},
  {syllabus:'Unit 1: Civil Engineering\nStructural analysis of beams.',style:'PROBLEM_SOLVING',slot:{marks:5,difficulty:'MEDIUM',bloomLevel:'K3'},pattern:/simply supported beam.*bending moment/i},
 ];
 for(const {syllabus,style,slot,pattern} of cases){
  const [q]=generateLocalQuestions(syllabus,[slot],[],'MCQ',{questionStyle:style});
  assert.match(q.text,pattern);
  assert.equal(q.marks,slot.marks);
  assert.equal(q.difficulty,slot.difficulty);
  assert.equal(q.bloomLevel,slot.bloomLevel);
 }
 const mixed=generateLocalQuestions('Unit 1: Calculus\nIntegration.',Array.from({length:10},(_,i)=>({marks:5,difficulty:'MEDIUM'})),[],'MCQ',{questionStyle:'MIXED'});
 assert.equal(mixed.length,10);
 const kinds=mixed.map(q=>classifySourceQuestionStyle(q.text));
 assert.ok(kinds.filter(k=>k==='PROBLEM_SOLVING').length>=6);
 assert.ok(kinds.includes('THEORY'));
 const theory=generateLocalQuestions('Unit 1: Calculus\nIntegration.',[{marks:5,difficulty:'MEDIUM'}],[],'MCQ',{questionStyle:'THEORY'});
 assert.equal(classifySourceQuestionStyle(theory[0].text),'THEORY');
});

test('Numeric and Algorithm section K1 slots receive section-appropriate recall candidates at configured marks',()=>{
 const cases=[
  {syllabus:'Unit 1: Calculus\nIntegration and differentiation.',style:'PROBLEM_SOLVING',slot:{marks:16,difficulty:'MEDIUM',bloomLevel:'K1'},pattern:/^(State|Name|List|Identify|Recall|Show|Find)\b[\s\S]*(?:formula|quantities|units|calculation)/i},
  {syllabus:'Unit 1: Algorithms\nSorting algorithms and time complexity.',style:'PROBLEM_SOLVING',slot:{marks:16,difficulty:'MEDIUM',bloomLevel:'K1'},pattern:/^(State|Name|List|Identify|Recall|Show)\b[\s\S]*(?:steps|condition|input|operations|algorithm|sorting|data structure)/i},
 ];
 for(const {syllabus,style,slot,pattern} of cases){
  const paper=generateLocalQuestions(syllabus,Array.from({length:5},()=>({...slot})),[],'MCQ',{questionStyle:style});
  assert.equal(paper.length,5);
  assert.ok(paper.every(q=>q.marks===16 && q.bloomLevel==='K1' && q.difficulty==='MEDIUM'));
  assert.ok(paper.every(q=>classifySourceQuestionStyle(q.text)==='PROBLEM_SOLVING'));
  assert.ok(paper.every(q=>pattern.test(q.text)));
  assert.equal(new Set(paper.map(q=>reuseSignature(q))).size,5);
 }
});

test('Numeric and Algorithm K1 section recall honors unit filtering and reports genuine shortage',()=>{
 const syllabus='Unit 1: Calculus\nIntegration.\nUnit 2: Algorithms\nSorting algorithms.';
 const slots=Array.from({length:2},()=>({marks:16,difficulty:'EASY',bloomLevel:'K1'}));
 const numeric=generateLocalQuestions(syllabus,slots,[],'MCQ',{questionStyle:'PROBLEM_SOLVING',units:[1]});
 assert.ok(numeric.every(q=>q.unit===1 && /formula|calculation|quantities|units/i.test(q.text)));
 const algorithm=generateLocalQuestions(syllabus,slots,[],'MCQ',{questionStyle:'PROBLEM_SOLVING',units:[2]});
 assert.ok(algorithm.every(q=>q.unit===2 && /algorithm|sorting|steps|condition|input|operations/i.test(q.text)));
 assert.throws(()=>generateLocalQuestions('Unit 1: History\nAncient civilizations.',[slots[0]],[],'MCQ',{questionStyle:'PROBLEM_SOLVING'}),e=>e.status===409 && /found 0 of 1 valid questions/.test(e.message));
});

test('mixed section styles retain the configured Bloom and marks allocation',()=>{
 const paper=generateLocalQuestions('Unit 1: Algorithms\nSorting algorithms and complexity.',[
  {marks:5,difficulty:'EASY',bloomLevel:'K1'},
  {marks:5,difficulty:'MEDIUM',bloomLevel:'K3'},
 ],[],'MCQ',{questionStyle:'MIXED'});
 assert.deepEqual(paper.map(q=>[q.marks,q.bloomLevel]),[[5,'K1'],[5,'K3']]);
});

test('5-mark K2 problem-solving generation supplies distinct syllabus-grounded candidates',()=>{
 const syllabus='Unit 1: Engineering Mathematics\nDifferentiation methods.\nIntegration techniques.';
 const slots=Array.from({length:10},()=>({marks:5,difficulty:'MEDIUM',bloomLevel:'K2'}));
 const paper=generateLocalQuestions(syllabus,slots,[],'MCQ',{questionStyle:'PROBLEM_SOLVING',units:[1]});
 assert.equal(paper.length,10);
 assert.ok(paper.every(q=>q.marks===5 && q.bloomLevel==='K2' && q.unit===1));
 assert.ok(paper.every(q=>classifySourceQuestionStyle(q.text)==='PROBLEM_SOLVING'));
 assert.ok(paper.every(q=>/Differentiation|Integration/i.test(q.text)));
 assert.equal(new Set(paper.map(q=>questionHash(q.text))).size,10);
 assert.equal(new Set(paper.map(q=>reuseSignature(q))).size,10);
});

test('5-mark K2 shortage reports the true remaining deficit when the bank and relevant generation are insufficient',()=>{
 const syllabus='Unit 1: Algorithms\nBinary search algorithm.';
 const slots=Array.from({length:10},()=>({marks:5,difficulty:'MEDIUM',bloomLevel:'K2'}));
 const bankQuestions=[
  {unit:1,topic:'Binary search',subtopic:'Search algorithm',marks:5,difficulty:'MEDIUM',text:'Explain how the binary search algorithm narrows its search interval.',questionType:'SHORT',bloomLevel:'K2',bloomSource:'assigned'},
  {unit:1,topic:'Binary search',subtopic:'Search algorithm',marks:5,difficulty:'MEDIUM',text:'Summarize why the binary search algorithm requires ordered input.',questionType:'SHORT',bloomLevel:'K2',bloomSource:'assigned'},
 ];
 assert.throws(()=>generateLocalQuestions(syllabus,slots,[],'MCQ',{questionStyle:'PROBLEM_SOLVING',bankQuestions}),e=>e.status===409 && /found 7 of 10 valid questions; shortage 3/.test(e.message));
});

test('mixed 5-mark K2 papers preserve both styles, requested units, and Bloom allocation',()=>{
 const syllabus='Unit 1: Engineering Mathematics\nDifferentiation methods.\nIntegration techniques.';
 const slots=Array.from({length:10},()=>({marks:5,difficulty:'MEDIUM',bloomLevel:'K2'}));
 const paper=generateLocalQuestions(syllabus,slots,[],'MCQ',{questionStyle:'MIXED',units:[1]});
 assert.equal(paper.length,10);
 assert.ok(paper.every(q=>q.marks===5 && q.bloomLevel==='K2' && q.unit===1));
 const kinds=new Set(paper.map(q=>classifySourceQuestionStyle(q.text)));
 assert.ok(kinds.has('THEORY'));
 assert.ok(kinds.has('PROBLEM_SOLVING'));
});

test('syllabus extraction discards project prompts, UI directions, test instructions, and errors',()=>{
 const topics=syllabusTopics(`Unit 1: Circuit analysis\nOhm law and resistive circuits.\nDeveloper prompt: preserve existing features and do not modify files.\nClick to browse and upload your syllabus.\nRun the existing test suite before final verification.\nError: insufficient questions.\nCalculate circuit current from supplied voltage and resistance.`);
 assert.deepEqual(topics.map(t=>t.topic),['Ohm law and resistive circuits','Calculate circuit current from supplied voltage and resistance.']);
});
