import { randomInt } from 'node:crypto';

const n=(a,b)=>randomInt(a,b+1);
const fmt=x=>String(Number(x.toFixed(4)));
const factories=[
  {key:'decimal-binary',match:/decimal.*binary|number.*(conversion|system)|base conversion|data representation/i,make(){
    const a=n(12,250),b=n(6,60);
    return {stem:`Convert the decimal number ${a} to binary.`,answer:a.toString(2),wrong:[a+1,a+2,a-1].map(x=>x.toString(2)),
      extra:[[`Convert the binary number ${b.toString(2)} to decimal.`,String(b)],[`Add the binary numbers ${a.toString(2)} and ${b.toString(2)}.`,(a+b).toString(2)]]};
  }},
  {key:'binary-addition',match:/binary (addition|arithmetic)|binary number/i,make(){
    const a=n(8,90),b=n(3,50),sum=a+b;
    return {stem:`Add the binary numbers ${a.toString(2)} and ${b.toString(2)}.`,answer:sum.toString(2),wrong:[sum+1,sum+2,sum-1].map(x=>x.toString(2)),
      extra:[[`Convert the sum to decimal.`,String(sum)],[`Subtract ${b.toString(2)} from the binary sum and verify the result.`,a.toString(2)]]};
  }},
  {key:'cpu-time',match:/execution time|cpu.*(performance|time)|processor performance/i,make(){
    const instructions=n(2,15)*1000,cpi=n(1,5),ghz=n(1,5),cycles=instructions*cpi,time=cycles/(ghz*1000);
    return {stem:`A CPU executes ${instructions} instructions with an average CPI of ${cpi} at ${ghz} GHz. Calculate execution time in microseconds.`,answer:fmt(time)+' microseconds',wrong:[time+.5,time+1,time+1.5].map(x=>fmt(x)+' microseconds'),
      extra:[[`Calculate the total clock cycles required.`,String(cycles)],[`If clock frequency doubles with the same CPI, calculate the new execution time and speedup.`,fmt(time/2)+' microseconds; speedup = 2'] ]};
  }},
  {key:'cache-access',match:/effective.*access time|average.*access time|cache.*(hit|miss|performance)|memory.*access time/i,make(){
    const hit=n(12,19)*5,cache=n(1,5),penalty=n(3,15)*10,time=cache+(1-hit/100)*penalty;
    return {stem:`Cache hit time is ${cache} ns, hit rate is ${hit}%, and additional miss penalty is ${penalty} ns. Calculate average memory access time.`,answer:fmt(time)+' ns',wrong:[time+2,time+4,time+6].map(x=>fmt(x)+' ns'),
      extra:[[`Find the miss rate.`,String(100-hit)+'%'],[`Recalculate average access time if hit rate improves to ${Math.min(99,hit+3)}%, with other values unchanged.`,fmt(cache+(1-Math.min(99,hit+3)/100)*penalty)+' ns']]};
  }},
  {key:'conditional-probability',match:/conditional probability/i,make(){
    const joint=n(1,6)/10,given=n(7,9)/10,value=joint/given;
    return {stem:`Given P(A intersect B) = ${joint} and P(B) = ${given}, calculate P(A | B).`,answer:fmt(value),wrong:[value+.03,value+.06,value+.09].map(fmt),
      extra:[[`Find P(not A | B).`,fmt(1-value)],[`For 100 independent observations under condition B, find the expected number for which A occurs.`,fmt(100*value)]]};
  }},
  {key:'linear-prediction',match:/linear regression/i,make(){
    const a=n(1,8),b=n(-8,9),x=n(1,12),value=a*x+b,eq=`y = ${a}x ${b<0?'-':'+'} ${Math.abs(b)}`;
    return {stem:`A linear regression model is ${eq}. Predict y when x = ${x}.`,answer:String(value),wrong:[value+1,value+2,value-1].map(String),
      extra:[[`Predict y when x = ${x+2}.`,String(a*(x+2)+b)],[`Find the change in predicted y when x increases by 3.`,String(a*3)]]};
  }},
  {key:'matrix-determinant',match:/determinant/i,make(){
    let a,b,c,d;do{a=n(1,9);b=n(1,9);c=n(1,9);d=n(1,9);}while(a*d===b*c);
    const det=a*d-b*c;
    return {stem:`Calculate the determinant of the matrix [[${a}, ${b}], [${c}, ${d}]].`,answer:String(det),wrong:[det+1,det+2,det-1].map(String),
      extra:[[`Find the trace of the matrix.`,String(a+d)],[`Find its inverse, giving entries as exact fractions.`,`[[${d}/${det}, ${-b}/${det}], [${-c}/${det}, ${a}/${det}]]`]]};
  }},
  {key:'mean-variance',match:/\bmean\b|\bvariance\b|standard deviation/i,make(){
    const values=Array.from({length:4},()=>n(2,24)),mean=values.reduce((a,b)=>a+b)/4,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/4;
    return {stem:`Calculate the arithmetic mean of the data ${values.join(', ')}.`,answer:fmt(mean),wrong:[mean+1,mean+2,mean-1].map(fmt),
      extra:[[`Calculate the population variance of the same data.`,fmt(variance)],[`Calculate the population standard deviation.`,fmt(Math.sqrt(variance))]]};
  }},
];
export function numericalCandidates(topic,unit,marks,oneMarkType='MCQ'){
  return factories.filter(f=>f.match.test(topic)).flatMap(factory=>Array.from({length:8},(_,pattern)=>{
    const problem=factory.make(),options=[problem.answer,...problem.wrong];
    for(let i=3;i>0;i--){const j=randomInt(i+1);[options[i],options[j]]=[options[j],options[i]];}
    let text=problem.stem,answer=problem.answer;
    if(marks>=10){const allocation=marks===10?[2,4,4]:[4,6,6];text=`(a) ${text} (${allocation[0]} marks)\n`+problem.extra.map(([part],i)=>`(${String.fromCharCode(98+i)}) ${part} (${allocation[i+1]} marks)`).join('\n');answer=[problem.answer,...problem.extra.map(e=>e[1])].join('; ');}
    if(marks===1 && oneMarkType==='FILL_BLANK')text+=' Answer: ______.';
    return {topic:topic.slice(0,200),subtopic:'numerical',unit,marks,pattern,text,answer,
      questionType:marks===1?oneMarkType:'SHORT',options:marks===1 && oneMarkType==='MCQ'?options:[],
      syllabusReference:topic,reuseKey:`numerical:${factory.key}:${marks}`,numericalVariant:true};
  }));
}
