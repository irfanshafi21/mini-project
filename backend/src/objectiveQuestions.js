import { randomInt } from 'node:crypto';

// Reviewed definitions, grouped so distractors remain in the same subject area.
const groups = [
  [
    ['Stack','last-in-first-out data access','stacks'],
    ['Queue','first-in-first-out data access','queues'],
    ['Binary search','finding an item by repeatedly halving a sorted search interval'],
    ['Linear search','finding an item by examining elements sequentially'],
    ['Merge sort','sorting by merging sorted sublists'],
    ['Hash table','mapping keys to array positions using a hash function','hash tables'],
  ],
  [
    ['Program counter','the register holding the address of the next instruction','program counter,pc'],
    ['Instruction register','the register holding the currently decoded instruction','instruction register'],
    ['Cache memory','a small fast memory that stores frequently accessed data','cache'],
    ['Virtual memory','a memory abstraction that maps virtual addresses to physical storage'],
    ['ALU','the processor component that performs arithmetic and logical operations','arithmetic logic unit'],
    ['RAM','volatile main memory used for active programs and data','random access memory'],
  ],
  [
    ['Conditional probability','the probability of an event given that another event has occurred'],
    ['Variance','the expected squared deviation of a random variable from its mean'],
    ['Covariance','the expected product of two variables\' deviations from their respective means'],
    ['Correlation','a normalised measure of the strength and direction of a linear relationship'],
    ['Median','the middle value of an ordered data set'],
    ['Mode','the most frequently occurring value in a data set'],
  ],
  [
    ['Linear regression','modelling a continuous response using a linear combination of predictors'],
    ['Logistic regression','modelling binary class probabilities using a logistic function'],
    ['K-means','clustering observations by assigning them to the nearest centroid','k means,k-means'],
    ['Principal component analysis','finding orthogonal directions that successively maximise data variance','pca,principal component'],
    ['Naive Bayes','classification using Bayes theorem with conditional independence assumptions','naive bayes'],
    ['Ridge regression','linear regression with an L2 penalty on coefficients'],
  ],
  [
    ['Primary key','a chosen attribute or attribute set that uniquely identifies each table row','primary key'],
    ['Foreign key','an attribute or attribute set that references a key in another or the same table','foreign key'],
    ['SELECT','the SQL statement used to retrieve rows','sql,select'],
    ['INSERT','the SQL statement used to add rows','sql,insert'],
    ['UPDATE','the SQL statement used to modify existing rows','sql,update'],
    ['DELETE','the SQL statement used to remove rows','sql,delete'],
  ],
  [
    ['Eigenvalue','a scalar by which a square matrix scales a corresponding nonzero eigenvector','eigenvalues'],
    ['Determinant','a scalar associated with a square matrix that is zero exactly when the matrix is singular','determinants'],
    ['Matrix rank','the number of linearly independent columns of a matrix','rank'],
    ['Matrix inverse','a matrix that multiplies with the original matrix to give the identity matrix','inverse,inverses'],
  ],
];
const contains=(text,term)=>new RegExp('\\b'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'s?\\b','i').test(text);
export function objectiveCandidates(topics, type) {
  return groups.flatMap(group=>group.flatMap(([term,definition,aliases=''])=>{
    const source=topics.find(t=>[term,...aliases.split(',').filter(Boolean)].some(a=>contains(t.topic,a)));
    if(!source)return [];
    const distractors=group.filter(g=>g[0]!==term).map(g=>g[0]);
    for(let i=distractors.length-1;i>0;i--){const j=randomInt(i+1);[distractors[i],distractors[j]]=[distractors[j],distractors[i]];}
    const options=[term,...distractors.slice(0,3)];
    for(let i=options.length-1;i>0;i--){const j=randomInt(i+1);[options[i],options[j]]=[options[j],options[i]];}
    return [0,1,2].map(pattern=>({
      topic:term,subtopic:'FOUNDATION',unit:source.unit,syllabusReference:source.topic,
      marks:1,pattern,questionType:type,options:type==='MCQ'?options:[],answer:term,
      text:type==='MCQ' ? [
        `Which term describes ${definition}?`,
        `Identify the term associated with ${definition}.`,
        `Which of the following corresponds to ${definition}?`,
      ][pattern] : [
        `The term for ${definition} is ______.`,
        `______ refers to ${definition}.`,
        `Complete the statement: ${definition} is described by the term ______.`,
      ][pattern],
    }));
  }));
}
