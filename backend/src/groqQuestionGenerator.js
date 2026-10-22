import 'dotenv/config';
import { HttpError } from './errors.js';
import { BLOOM_VERBS, classifyBloom, startsWithBloomVerb } from './blooms.js';
import { classifySourceQuestionStyle, syllabusTopics } from './localModel.js';
import { retrieveSyllabusEvidence } from './syllabusRetrieval.js';

const bloomLevels = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];
// Bloom level determines the displayed difficulty exactly.
const bloomDifficulty = { K1: 'EASY', K2: 'EASY', K3: 'MEDIUM', K4: 'MEDIUM', K5: 'HARD', K6: 'HARD' };
function difficultyForBloom(difficulty, bloomLevel) {
  return bloomDifficulty[bloomLevel] || difficulty;
}
// Keep only verbs that form natural exam-question openings. The source Bloom
// vocabulary also contains nouns and phrases that produce malformed stems.
const questionOpeningVerbs = {
  K1: ['Choose', 'Define', 'Find', 'Label', 'List', 'Match', 'Name', 'Recall', 'Select', 'Show', 'Spell', 'What', 'When', 'Where', 'Which', 'Who', 'Why'],
  K2: ['Classify', 'Compare', 'Contrast', 'Demonstrate', 'Explain', 'Illustrate', 'Infer', 'Interpret', 'Outline', 'Summarize'],
  // Keep K3 openings aligned with the college Bloom vocabulary used by
  // startsWithBloomVerb; otherwise a valid numerical question can be rejected.
  K3: ['Apply', 'Experiment with', 'Make use of', 'Build', 'Choose', 'Construct', 'Develop', 'Identify', 'Model', 'Organize', 'Plan', 'Select', 'Solve', 'Utilize'],
  K4: ['Analyze', 'Categorize', 'Compare', 'Contrast', 'Debug', 'Distinguish', 'Examine', 'Inspect', 'Simplify'],
  K5: ['Assess', 'Compare', 'Conclude', 'Criticize', 'Decide', 'Defend', 'Determine', 'Evaluate', 'Judge', 'Justify', 'Prioritize', 'Prove', 'Rate', 'Recommend', 'Support', 'Value'],
  K6: ['Adapt', 'Build', 'Combine', 'Compile', 'Compose', 'Construct', 'Create', 'Design', 'Develop', 'Implement', 'Formulate', 'Improve', 'Invent', 'Modify', 'Originate', 'Plan', 'Propose', 'Solve', 'Write'],
};
const mathTopic = /\b(math(?:ematics)?|algebra|equation|calculus|integral|integration|differentiat(?:ion|e)|matrix|matrices|determinant|probability|statistics|numerical method|number system|boolean algebra|logic design|circuit|ohm|voltage|current|resistance|force|motion|kinematic|stress|strain|thermodynamic|heat transfer|pressure|fluid mechanics|beam|scheduling|subnet|network address|entropy|information gain|gini|feature scaling|normalization|normalisation|standardization|standardisation|distance|regression|gradient descent|loss function)\b/i;
const mathTask = /\b(apply|calculate|compute|solve|evaluate|find|determine|derive|simplify|differentiate|integrate|trace|convert|estimate|prove)\b/i;
const bannedGenericWording = /\b(?:of your choice|your own example|own example|relevant example|support your response|develop your response|clear reasoning|as an example of your choice|an application of your choice|a practical example of your choice|give (?:one|an?) (?:relevant |suitable )?example|provide (?:one|an?) (?:relevant |suitable )?example|with (?:one|an?) relevant example)\b/i;
const bannedDocumentMetaWording = /\b(?:syllabus|course outline|course structure|course content|academic year|examination year|exam year|author|publisher|textbook|reference book|book title|isbn|reading list|learning outcomes?|listed subjects?|subjects? (?:covered|included|offered)|topics? (?:covered|included|listed|in the syllabus)|topic coverage|across (?:both |multiple )?(?:academic |examination )?years?)\b/i;
const stopWords = new Set(['about','after','against','along','among','based','before','between','during','from','into','over','through','under','using','with','within','your','what','which','that','this','their','there','these','those','such','main','basic','introduction','concept','concepts','topic','unit']);
const questionStyleOf = question => classifySourceQuestionStyle(question.text);

const normalize = value => String(value || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function selectTopics(text, body) {
  const all = syllabusTopics(text);
  const units = new Set(body.units || [1, 2, 3, 4, 5]);
  let selected = all.filter(item => units.has(item.unit));
  if (body.chapters?.length) {
    const wanted = new Set(body.chapters.map(normalize));
    const found = new Set(selected.map(item => normalize(item.topic)));
    const missing = [...wanted].filter(name => !found.has(name));
    if (missing.length) throw new HttpError(400, `Selected chapter(s) not found in the chosen units: ${missing.join(', ')}.`);
    selected = selected.filter(item => wanted.has(normalize(item.topic)));
  }
  if (!selected.length) throw new HttpError(409, 'No syllabus chapters match the selected units. Choose different units or chapters.');
  return selected;
}

function subtopicsFor(topic) {
  const specific = topic
    .split(/[:;,.]+/g)
    .flatMap(part => part.split(/\s+(?:is|are|was|were|relates?(?:\s+to)?|related(?:\s+to|\s+by)?|refers?(?:\s+to)?|consists?(?:\s+of)?|includes?|uses?|using)\s+/i));
  const parts = specific.flatMap(part => part.split(/\s+(?:and|or)\s+|\s*\/\s*/i));
  const phrases = [...new Set(parts.map(part => part.trim().replace(/^[-–—\s]+|[-–—\s]+$/g, '')).filter(part => part.length >= 4 && part.length <= 120))];
  // Prefer specific concepts over the whole syllabus sentence, which often
  // causes the model to label an entire topic as its subtopic.
  return (phrases.length > 1 ? phrases : [topic, ...phrases]).slice(0, 5);
}

function normalizeSubtopic(topic, candidate, question) {
  const allowed = subtopicsFor(topic);
  if (allowed.some(value => normalize(value) === normalize(candidate))) return candidate;
  const candidateWords = new Set(normalize(candidate).split(' ').filter(word => word.length > 3 && !stopWords.has(word)));
  const questionWords = new Set(normalize(question).split(' ').filter(word => word.length > 3 && !stopWords.has(word)));
  return allowed
    .map((value, index) => {
      const words = normalize(value).split(' ').filter(word => word.length > 3 && !stopWords.has(word));
      const score = words.reduce((total, word) => total + (candidateWords.has(word) ? 3 : 0) + (questionWords.has(word) ? 1 : 0), 0) / Math.max(words.length, 1);
      return { value, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.value || topic;
}

function schemaFor(topics, slots, body, compactShortAnswers = false, simplified = false) {
  const assignedTopics = slots.map(slot => slot.sourceTopic).filter(Boolean);
  const scope = assignedTopics.length ? assignedTopics : topics;
  const subtopicNames = [...new Set(scope.flatMap(item => subtopicsFor(item.topic)))];
  const properties = {
    // Keep dynamic syllabus phrases and the full verb vocabulary in the prompt,
    // not in schema enums. Long enums can exceed Gemini's schema complexity cap.
    // The application normalizes and validates both values after generation.
    subtopic: simplified ? { type: 'string' } : { type: 'string', enum: subtopicNames },
    openingVerb: simplified ? { type: 'string' } : { type: 'string', enum: [...new Set(Object.values(questionOpeningVerbs).flat())] },
    bloomLevel: { type: 'string', enum: bloomLevels },
    questionCore: { type: 'string', maxLength: 200 },
    supportingMaterial: { type: 'string', maxLength: 1400 },
    ...(!compactShortAnswers ? {
      options: { type: 'array', items: { type: 'string', maxLength: 100 } },
      // Needed only to check one-mark objective items; regular questions leave it blank.
      answer: { type: 'string', maxLength: 200 },
    } : {}),
  };
  return { type: 'object', additionalProperties: false, required: ['questions'], properties: {
    // Enforce the slot count so the API cannot silently return a shorter paper.
    questions: { type: 'array', minItems: slots.length, maxItems: slots.length, items: { type: 'object', additionalProperties: false, required: compactShortAnswers ? ['subtopic', 'openingVerb', 'bloomLevel', 'questionCore', 'supportingMaterial'] : Object.keys(properties), properties } },
  } };
}

function checkQuestions(questions, slots, topics, body, selectedUnits) {
  const failures = [];
  if (!Array.isArray(questions) || questions.length !== slots.length) return ['Return exactly the requested number of questions.'];
  const remaining = slots.map((slot, index) => ({ ...slot, _index: index }));
  for (const [index, q] of questions.entries()) {
    if (!q || typeof q.text !== 'string' || q.text.trim().length < 12) { failures.push(`Question ${index + 1} has no complete question text.`); continue; }
    const slotIndex = remaining.findIndex(slot => slot.marks === q.marks && slot.difficulty === q.difficulty && (!slot.bloomLevel || slot.bloomLevel === q.bloomLevel));
    if (slotIndex < 0) failures.push(`Question ${index + 1} does not match an unfilled marks, difficulty, and Bloom slot.`);
    else remaining.splice(slotIndex, 1);
    if (!selectedUnits.includes(q.unit)) failures.push(`Question ${index + 1} uses a unit that was not selected.`);
    const source = topics.find(item => item.unit === q.unit && normalize(item.topic) === normalize(q.syllabusReference));
    if (!source) failures.push(`Question ${index + 1} must cite one exact topic from the selected syllabus units.`);
    if (source && normalize(q.topic) !== normalize(source.topic)) failures.push(`Question ${index + 1} must preserve the exact syllabus topic terminology.`);
    if (bannedGenericWording.test(q.text)) failures.push(`Question ${index + 1} contains generic wording. Write a specific question using the syllabus terminology; do not ask students to invent an example or application.`);
    if (bannedDocumentMetaWording.test(q.text)) failures.push(`Question ${index + 1} asks about document metadata or course coverage. Replace it with a question testing the technical concept itself.`);
    if (!body.subject && !selectedUnits.includes(q.unit)) failures.push(`Question ${index + 1} is outside the uploaded syllabus scope.`);
    if (!bloomLevels.includes(q.bloomLevel) || (q.openingVerb && !questionOpeningVerbs[q.bloomLevel]?.includes(q.openingVerb)) || !startsWithBloomVerb(q.text, q.bloomLevel)) failures.push(`Question ${index + 1} must start with an appropriate verb for its assigned Bloom level.`);
    if (q.questionType === 'MCQ') {
      const options = Array.isArray(q.options) ? q.options.map(x => String(x).trim()) : [];
      if (options.length !== 4 || new Set(options.map(x => x.toLowerCase())).size !== 4 || !options.includes(q.answer)) failures.push(`Question ${index + 1} must have four unique options and one exact correct answer.`);
    } else if (q.questionType === 'FILL_BLANK') {
      if (!q.text.includes('____') || (q.options || []).length || !q.answer?.trim()) failures.push(`Question ${index + 1} has an invalid fill-in-the-blank format.`);
    } else if ((q.options || []).length) failures.push(`Question ${index + 1} is a short-answer item and must not include options.`);
    if (q.marks !== 1 && q.questionType !== 'SHORT') failures.push(`Question ${index + 1} must be a short-answer question for ${q.marks} marks.`);
    if (q.marks === 1 && q.questionType !== body.oneMarkType) failures.push(`One-mark question ${index + 1} must use the selected ${body.oneMarkType} format.`);
    if (body.questionStyle === 'PROGRAMMING_SQL' && classifySourceQuestionStyle(q.text) !== 'PROGRAMMING_SQL') failures.push(`Question ${index + 1} must be a programming or SQL task as selected.`);
    if (body.questionStyle === 'PROBLEM_SOLVING' && !['PROBLEM_SOLVING', 'PROGRAMMING_SQL'].includes(classifySourceQuestionStyle(q.text))) failures.push(`Question ${index + 1} must require a concrete calculation or procedural solution as selected.`);
    if (body.questionStyle === 'THEORY' && questionStyleOf(q) !== 'THEORY') failures.push(`Question ${index + 1} must be theory only, as selected.`);
    if (q.questionType !== 'SHORT' && !q.answer?.trim()) failures.push(`Question ${index + 1} is missing the answer required to validate its objective format.`);
    const syllabusTopic = source?.topic || q.topic || '';
    // In Mixed mode, K3 does not necessarily mean a numerical task: applying a
    // concept can be a valid theory question. Enforce numeric values only when
    // the user explicitly requested a problem-solving paper.
    if (source && mathTopic.test(syllabusTopic) && q.bloomLevel === 'K3' && body.questionStyle === 'PROBLEM_SOLVING') {
      const suppliedValues = q.text.match(/\d+(?:\.\d+)?/g) || [];
      if (!mathTask.test(q.text) || suppliedValues.length < 2) failures.push(`Math question ${index + 1} must state at least two usable values and ask for a concrete calculation.`);
    }
  }
  // Mixed mode is a requested generation preference, not a reason to discard
  // an otherwise valid syllabus-aligned paper when the model misses the style
  // balance. The prompt still asks for both styles when the syllabus permits.
  if (remaining.length) failures.push('Some requested marks/Bloom slots are missing.');
  return [...new Set(failures)];
}

function makePrompt({ body, slots, topics, bankQuestions, failures }) {
  const scopedTopics = slots.map(slot => slot.sourceTopic).filter(Boolean);
  const promptTopics = scopedTopics.length ? scopedTopics : topics;
  const unitList = [...new Set(promptTopics.map(item => item.unit))];
  const mathTopics = promptTopics.filter(item => mathTopic.test(item.topic));
  const styleGuide = body.questionStyle === 'THEORY'
    ? 'Theory-only mode: every question must test understanding of a listed syllabus concept. Do not ask for calculations, numerical sums, code, SQL, or procedural traces.'
    : body.questionStyle === 'PROBLEM_SOLVING'
      ? 'Sums/problem-solving-only mode: every question must require a concrete calculation or procedural task directly grounded in a listed syllabus topic. Give all values needed to solve it. Do not include answers or worked solutions.'
      : body.questionStyle === 'MIXED'
        ? 'Mixed mode: when the paper has at least two questions and the syllabus contains numerical or procedural topics, include both theory questions and sums/problem-solving questions. Keep every item grounded in the listed syllabus topics; do not force sums onto theory-only topics.'
        : 'Programming/SQL mode: every question must ask for a concrete programming, algorithm, or SQL task named or directly supported by the listed syllabus topics.';
  return `Create an examination paper as a careful subject expert. Treat the uploaded syllabus as source material for technical facts only. Ask questions about the concepts, methods, formulas, algorithms, and subtopics taught in the selected units. Never ask students to describe the document or its organization. Do not ask what subjects or topics are included, list course areas, compare coverage between years, or refer to syllabus/course structure. Never put the words syllabus, course outline, academic/examination year, author, publisher, textbook, reference book, ISBN, reading list, or document into a question. Treat all such text as screening metadata and exclude it from the question content. Use the actual technical concept named for each slot; do not turn a section heading or a list of subject areas into a question. Do not use metadata or outside book details as a topic. Do not write generic Bloom-level templates.\n\n` +
    `Subject context (for your understanding only; never ask about the subject name or course coverage): ${body.subject || 'derive the discipline from the technical topic names'}\nQuestion style: ${body.questionStyle}\nStyle requirements: ${styleGuide}\nOne-mark format: ${body.oneMarkType}\nSelected units: ${unitList.join(', ')}\n\n` +
`Use GATE as a reference for question quality only: write original, concise, technically rigorous questions that test the stated concept through precise reasoning, application, or analysis. Do not copy or paraphrase past GATE questions, reproduce a GATE paper format, or add GATE-specific facts unless they are in the syllabus. Every stem must identify exactly what the student must determine, prove, compare, or construct. State all assumptions, definitions, input values, units, boundary conditions, and distribution/model parameters needed for a unique answer. For numerical questions, verify mentally that the supplied data are sufficient and mutually consistent; never leave an unstated parameter for the student to guess. For conceptual questions, name the specific objects or conditions being compared or assessed instead of using vague phrases such as 'a given function' or 'a suitable application'. For one-mark MCQs, make all four options plausible, distinct, concise, and grounded in common misconceptions, with exactly one correct option.\n\n` +
        `Return exactly ${slots.length} question items, one for each slot, in order. Do not omit, combine, or add items. The application assigns each item's unit, exact syllabus topic, marks, and base difficulty. If a Bloom level is supplied for a slot, preserve it; otherwise select an appropriate K1-K6 level and return it as bloomLevel. Bloom level controls the cognitive operation AND exact difficulty: K1 Remember = direct retrieval or recognition (EASY); K2 Understand = explain, classify, summarize, or interpret a taught concept (EASY); K3 Apply = use a taught rule, formula, or procedure in a concrete case (MEDIUM); K4 Analyze = distinguish components, trace behavior, or reason through relationships or multiple steps (MEDIUM); K5 Evaluate = judge or defend a conclusion using named technical criteria (HARD); K6 Create = construct or design a coherent solution under explicit constraints drawn from the syllabus (HARD). Never assign a higher K level just to make an item sound difficult: K1/K2 must not require extended derivation; K3/K4 require actual application or analysis; K5/K6 require justified judgment or constrained design. The application maps K1/K2 to EASY, K3/K4 to MEDIUM, and K5/K6 to HARD, regardless of the requested difficulty-mix label. Do not fake a higher level by changing only the opening verb. Set subtopic to a listed phrase, openingVerb to an allowed verb for that Bloom level, and questionCore to one clear, specific exam question (8–18 words). The application adds the opening verb to questionCore, so do not repeat it there. Set supportingMaterial to an empty string when no stimulus is useful. When a question genuinely needs one, put only a concise, self-contained, printable plain-text aid there: for an ML/data problem use a small synthetic dataset with labelled columns and enough rows/values to solve the task; for a diagram-dependent topic use a simple labelled ASCII diagram or an unambiguous list of connections. Include units, labels, class values, and assumptions needed to interpret the aid. Keep every aid within the selected syllabus topic, do not reveal the answer, and do not use markdown fences or external images. The application appends this field below the stem. Return only question data. Never include an explanation, answer, worked solution, marking guide, or extra commentary for SHORT questions. For one-mark MCQs only, include exactly four short options (1–6 words each, no explanations) and set answer to only the correct option letter A, B, C, or D. For fill-in-the-blank items, provide the missing word or value as answer. For SHORT questions omit options and answer entirely.\n\n` +
    `Write like a university examiner preparing a clean, printable paper. Match scope to marks: 1 mark tests one precise fact, term, or objective response; 2 marks asks for a concise definition, distinction, reason, or short calculation; 5 marks asks for a focused explanation, comparison, trace, or complete problem prompt (without its solution); 10 marks asks for a substantial, clearly bounded multi-part or multi-step response; 16 marks asks for an integrated technical response with explicit parts or constraints. These are stem expectations, not boilerplate to append. Every item must be answerable from its assigned syllabus concept and contain enough information to make the task unambiguous. Before returning each item, silently solve or verify its premise: confirm that no essential parameter, condition, input, or definition is missing, and that the requested conclusion follows from the stated facts. Avoid duplicate questions and vary subtopics and task types when scope permits. Never add paper headings, introductions, student instructions, solutions, or answer keys to question text.\n\n` +
    `Never write phrases such as “of your choice”, “your own example”, “one relevant example”, or “support your response”. Do not ask students to invent a topic, example, application, inputs, or scenario. Give a specific question. Avoid vague criteria without naming the syllabus concept being evaluated, and do not append repeated boilerplate to stems. Do not ask about course identity, the subject name, the syllabus/document itself, its units as a document, course coverage, academic/exam years, authors, publishers, or books; these are metadata, never examinable content. Do not introduce facts, terminology, formulas, or applications absent from the selected technical syllabus evidence. If evidence is too broad for a precise question, narrow the task to a named concept actually present; never fill gaps with generic textbook knowledge.\n\n` +
    `Before writing, map each question to one specific syllabus subtopic, using the syllabus's exact technical terminology. Prefer coverage of distinct listed subtopics before repeating one. When a selected subtopic is mathematical or numerical and the Bloom level calls for application/problem solving, create a genuine numerical question: provide at least two concrete values, include units where applicable, and ask for a calculation. Do not include the answer or working. Do not substitute a definition or generic explanation for a requested sum. Do not invent a formula or unrelated application. K1/K2 slots may test the named mathematical concept or formula instead. For non-numerical subjects, do not force a calculation. Use questionType SHORT except one-mark questions, where use ${body.oneMarkType}. MCQs must have four plausible distinct options and exactly one correct option; the answer key must match one option exactly. Fill-in blanks must contain ____ and provide the missing text as the answer key. Return no answer or explanation for short-answer items.\n\n` +
    `Syllabus topic assigned to each question (use its exact terminology):\n${slots.map((slot, index) => { const item = slot.sourceTopic; return `Question ${index + 1}: Unit ${item?.unit || ''}: ${item?.topic || topics[index % topics.length]?.topic || ''}\n  Subtopics: ${subtopicsFor(item?.topic || topics[index % topics.length]?.topic || '').join(' | ')}\n  Retrieved syllabus evidence: ${(item?.evidence || []).join(' | ')}`; }).join('\n')}\n\n` +
    `Mathematics/numerical topics in scope:\n${mathTopics.map(item => `Unit ${item.unit}: ${item.topic}`).join('\n') || '(none)'}\n\n` +
    `Existing saved questions for style only; never copy them:\n${bankQuestions.slice(0, 4).map(q => `U${q.unit}/${q.marks}m: ${String(q.text).slice(0, 100)}`).join('\n') || '(none)'}\n\n` +
    `Slots in order (preserve marks and any supplied Bloom level; derive difficulty from the exact K-level mapping above; choose a listed opening verb):\n${JSON.stringify(slots.map(({ marks, difficulty, bloomLevel }) => ({ marks, bloomLevel: bloomLevel || 'choose suitable level', requestedDifficulty: difficulty, verbs: (questionOpeningVerbs[bloomLevel] || Object.values(questionOpeningVerbs).flat()).slice(0, 6) })))}\n` +
    (failures?.length ? `\nPrevious validation failed. Correct every issue: ${failures.join(' ')}\n` : '');
}

function parseStructuredContent(content, provider, metadata = {}) {
  const cleaned = String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try { return JSON.parse(cleaned); } catch { /* Try to recover a JSON object wrapped in model chatter. */ }
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* Report a concise error below. */ }
  }
  const truncated = metadata.doneReason === 'length' || (metadata.evalCount && metadata.outputLimit && metadata.evalCount >= metadata.outputLimit - 2);
  const detail = truncated
    ? 'The response reached its output limit before the JSON was complete.'
    : 'The model response was not valid JSON.';
  throw new HttpError(502, `${providerName(provider)} could not complete the question data. ${detail} Try fewer questions or a smaller syllabus selection.`);
}

const providerName = provider => ({ gemini: 'Gemini', groq: 'Groq' }[provider] || 'AI provider');

function geminiCompatibleSchema(schema) {
  if (Array.isArray(schema)) return schema.map(geminiCompatibleSchema);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema)
    // responseJsonSchema supports JSON Schema. Drop maxLength because the
    // generated question length is checked by the application after parsing.
    .filter(([key]) => key !== 'maxLength')
    .map(([key, value]) => [key, geminiCompatibleSchema(value)]));
}

async function callProvider(prompt, units, slots, body, questionCount, signal, provider) {
  if (provider === 'gemini') {
    const keys = [...new Set([
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALLBACK_1,
      process.env.GEMINI_API_KEY_FALLBACK_2,
    ].map(key => String(key || '').trim()).filter(Boolean))];
    const model = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').replace(/^models\//, '');
    if (!keys.length) throw new HttpError(503, 'Gemini is selected but no Gemini API key is configured in backend/.env.');
    if (!/^[A-Za-z0-9._-]+$/.test(model)) throw new HttpError(503, 'GEMINI_MODEL contains an invalid model name.');
    // The prior limit truncated otherwise-valid multi-question JSON responses.
    const outputLimit = Math.min(16000, 1200 + questionCount * 900 + slots.filter(slot => slot.marks === 1).length * 300);
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: 'You are an expert university examiner. Use only the supplied syllabus as factual source material. Use original GATE-like precision and technical rigor as a quality reference, never copy past questions. State all assumptions and data needed for a unique answer. Follow the Bloom cognitive level and exact difficulty requirements. Return only valid JSON matching the response schema.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: outputLimit,
        responseMimeType: 'application/json',
        responseJsonSchema: geminiCompatibleSchema(schemaFor(units, slots, body, slots.every(slot => slot.marks !== 1), true)),
      },
    });
    let response;
    let data = {};
    let lastNetworkError = false;
    const failedStatuses = [];
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys[keyIndex] },
          body: requestBody,
        });
        lastNetworkError = false;
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
        lastNetworkError = true;
        console.error('[Gemini API network error]', JSON.stringify({ keySlot: keyIndex + 1 }));
        if (keyIndex + 1 < keys.length) continue;
        throw new HttpError(503, 'Could not connect to Gemini using the configured API keys. Check the network and try again.');
      }
      data = await response.json().catch(() => ({}));
      if (response.ok) break;
      failedStatuses.push(response.status);
      console.error('[Gemini API error]', JSON.stringify({ keySlot: keyIndex + 1, status: response.status, error: data.error }));
      const retryable = response.status === 401 || response.status === 403 || response.status === 429 || (response.status >= 500 && response.status < 600);
      if (retryable && keyIndex + 1 < keys.length) continue;
      break;
    }
    if (lastNetworkError) throw new HttpError(503, 'Could not connect to Gemini using the configured API keys. Check the network and try again.');
    if (!response?.ok) {
      if (failedStatuses.length && failedStatuses.every(status => status === 401 || status === 403)) throw new HttpError(502, 'Gemini rejected the configured API key(s). Check the Gemini keys in backend/.env.');
      if (failedStatuses.includes(429)) throw new HttpError(503, 'Gemini quota or rate limit was reached for one or more configured keys. Check the project quotas and try again later.');
      if (failedStatuses.length && failedStatuses.every(status => status >= 500 && status < 600)) throw new HttpError(503, 'Gemini is temporarily unavailable for the configured API keys. Try again later.');
      const violations = (data.error?.details || [])
        .flatMap(detail => detail.fieldViolations || [])
        .map(item => `${item.field}: ${item.description}`)
        .join('; ');
      const reason = String(violations || data.error?.message || '').replace(/\s+/g, ' ').slice(0, 420);
      throw new HttpError(502, `Gemini question generation failed (HTTP ${response?.status || 'unknown'}).${reason ? ` ${reason}` : ''}`);
    }
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.map(part => part.text || '').join('');
    if (typeof content !== 'string' || !content.trim()) {
      const reason = candidate?.finishReason;
      throw new HttpError(502, `Gemini returned no question data${reason ? ` (${reason})` : ''}. Try fewer questions or check the syllabus selection.`);
    }
    return parseStructuredContent(content, provider, { doneReason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : undefined });
  }
  const model = process.env.GROQ_MODEL;
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new HttpError(503, 'Groq is selected but GROQ_API_KEY is not configured in backend/.env.');
  if (!model) throw new HttpError(503, 'Groq is selected but GROQ_MODEL is not configured in backend/.env.');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an exacting university examiner and subject-matter expert. Use original GATE-like precision and technical rigor as a quality reference, never copy past questions. Use only supplied syllabus evidence; state sufficient assumptions and data for every solvable stem. Match the assigned Bloom operation and exact difficulty. Return only schema-valid question data. Never claim certainty when the syllabus lacks enough information.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      reasoning_effort: 'low',
      max_completion_tokens: Math.min(16000, 2400 + questionCount * 320),
      response_format: { type: 'json_schema', json_schema: { name: 'question_paper', strict: true, schema: schemaFor(units, slots, body) } },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new HttpError(502, 'Groq rejected the configured API key. Check backend/.env and restart the backend.');
    if (response.status === 429) throw new HttpError(503, 'Groq rate limit reached. Wait briefly and try again.');
    if (response.status === 400) {
      const reason = String(data.error?.message || '').replace(/\s+/g, ' ').slice(0, 240);
      throw new HttpError(502, `Groq rejected the generation request for model ${model}.${reason ? ` ${reason}` : ' Check model support and generation limits.'}`);
    }
    throw new HttpError(502, `Groq question generation failed (HTTP ${response.status}).`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new HttpError(502, 'Groq returned an empty question response. Try again.');
  return parseStructuredContent(content, provider, { doneReason: data.choices?.[0]?.finish_reason });
}

export async function generateGroqQuestions({ body, text, slots, bankQuestions = [] }) {
  return generateQuestionsWithProvider({ body, text, slots, bankQuestions, provider: 'groq' });
}

export async function generateGeminiQuestions({ body, text, slots, bankQuestions = [] }) {
  return generateQuestionsWithProvider({ body, text, slots, bankQuestions, provider: 'gemini' });
}

async function generateQuestionsWithProvider({ body, text, slots, bankQuestions, provider }) {
  const topics = selectTopics(text, body);
  const selectedUnits = [...new Set(topics.map(item => item.unit))];
  const topicsByUnit = new Map(selectedUnits.map(unit => [unit, topics.filter(item => item.unit === unit)]));
  const unitPositions = new Map(selectedUnits.map(unit => [unit, 0]));
  const plannedSlots = slots.map((slot, index) => {
    const unit = selectedUnits[index % selectedUnits.length];
    const unitTopics = topicsByUnit.get(unit);
    const position = unitPositions.get(unit) || 0;
    unitPositions.set(unit, position + 1);
    const sourceTopic = unitTopics[position % unitTopics.length];
    return { ...slot, sourceTopic: { ...sourceTopic, evidence: retrieveSyllabusEvidence(text, sourceTopic) } };
  });
  // Small structured-output batches limit truncation risk for larger papers.
  const batchSize = provider === 'gemini' && slots.length > 10 ? 10 : slots.length;
  const generated = [];
  for (let offset = 0; offset < plannedSlots.length; offset += batchSize) {
    let pendingBatch = plannedSlots.slice(offset, offset + batchSize);
    let accepted = [];
    let attempts = 0;
    let failures = [];
    while (pendingBatch.length) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider === 'gemini' ? 120000 : 90000);
      try {
        const response = await callProvider(makePrompt({ body, slots: pendingBatch, topics, bankQuestions, failures }), topics, pendingBatch, body, pendingBatch.length, controller.signal, provider);
        const returned = Array.isArray(response.questions) ? response.questions : [];
        const usableCount = Math.min(returned.length, pendingBatch.length);
        const returnedSlots = pendingBatch.slice(0, usableCount);
        const preparedQuestions = returned.slice(0, usableCount).map((q, index) => {
          const slot = returnedSlots[index];
          const source = slot?.sourceTopic;
          const core = String(q.questionCore || '').trim();
          // Bloom levels are optional in the UI. When they are automatic, use
          // the level returned by the model to select a compatible opening
          // verb; otherwise a valid K3/K4 response could be prefixed with a
          // verb from another level and rejected for the whole batch.
          const bloomLevel = slot?.bloomLevel || q.bloomLevel || classifyBloom(core);
          const allowedVerbs = questionOpeningVerbs[bloomLevel] || [];
          const modelVerb = String(q.openingVerb || '').trim();
          const beginsWith = candidate => candidate && core.slice(0, candidate.length).toLowerCase() === candidate.toLowerCase()
            && (core.length === candidate.length || /\s/.test(core[candidate.length]));
          const coreVerb = allowedVerbs.find(beginsWith);
          const verb = allowedVerbs.includes(modelVerb) ? modelVerb : coreVerb || allowedVerbs[0] || modelVerb;
          const leadingVerb = [modelVerb, ...allowedVerbs].find(beginsWith);
          const remainder = leadingVerb ? core.slice(leadingVerb.length).trim() : core;
          const continuation = remainder && !/^I\b/.test(remainder) ? `${remainder[0].toLowerCase()}${remainder.slice(1)}` : remainder;
          const stem = `${verb} ${continuation}`.trim();
          const supportingMaterial = String(q.supportingMaterial || '').trim().slice(0, 1400);
          const text = supportingMaterial ? `${stem}\n${supportingMaterial}` : stem;
          const options = Array.isArray(q.options) ? q.options.map(option => String(option).trim()) : [];
          const answerText = String(q.answer || '').trim();
          const answerLetter = answerText.match(/^([A-D])(?:[).:]|\s|$)/i)?.[1]?.toUpperCase();
          const matchedAnswer = options.find(option => option.toLocaleLowerCase() === answerText.toLocaleLowerCase());
          const answer = matchedAnswer || (answerLetter ? options['ABCD'.indexOf(answerLetter)] || answerText : answerText);
          return {
            ...q,
            openingVerb: verb,
            text,
            unit: source?.unit,
            topic: source?.topic,
            syllabusReference: source?.topic,
            marks: slot?.marks,
            difficulty: difficultyForBloom(slot?.difficulty, bloomLevel),
            bloomLevel,
            bloomSource: provider,
            questionType: slot?.marks === 1 ? body.oneMarkType : 'SHORT',
            options: slot?.marks === 1 ? options : [],
            answer: slot?.marks === 1 ? answer : '',
            ...(source ? { subtopic: normalizeSubtopic(source.topic, q.subtopic, text) } : {}),
          };
        });
        const checkedSlots = returnedSlots.map((slot, index) => ({ ...slot, difficulty: preparedQuestions[index]?.difficulty || slot.difficulty }));
        failures = usableCount
          ? checkQuestions(preparedQuestions, checkedSlots, topics, body, selectedUnits)
          : ['The model returned no questions. Retry the remaining slots.'];
        if (!failures.length && usableCount) {
          const acceptedPart = preparedQuestions.map(q => {
            const topic = topics.find(item => item.unit === q.unit && normalize(item.topic) === normalize(q.syllabusReference));
            const storedQuestion = { ...q };
            delete storedQuestion.openingVerb;
            delete storedQuestion.questionCore;
            delete storedQuestion.supportingMaterial;
            delete storedQuestion.solution;
            if (storedQuestion.questionType === 'SHORT') storedQuestion.answer = '';
            return { ...storedQuestion, topic: topic.topic, subtopic: q.subtopic.slice(0, 200), bloomSource: 'requested-llm' };
          });
          accepted.push(...acceptedPart);
          pendingBatch = pendingBatch.slice(usableCount);
          attempts = 0;
          failures = [];
        } else {
          attempts++;
          if (attempts >= 2) throw new HttpError(502, `${providerName(provider)} returned questions that failed quality checks: ${failures.slice(0, 4).join(' ')}`);
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (error.name === 'AbortError' || error.name === 'TimeoutError') throw new HttpError(504, `${providerName(provider)} question generation timed out. Reduce the question count and try again.`);
        throw new HttpError(502, `Could not connect to ${providerName(provider)}. Check the service and try again.`);
      } finally { clearTimeout(timeout); }
    }
    generated.push(...accepted);
  }
  const wholePaperFailures = checkQuestions(generated, plannedSlots.map((slot, index) => ({ ...slot, difficulty: generated[index]?.difficulty || slot.difficulty })), topics, body, selectedUnits);
  if (wholePaperFailures.length) throw new HttpError(502, `${providerName(provider)} returned questions that failed quality checks: ${wholePaperFailures.slice(0, 4).join(' ')}`);
  return generated.map((question, index) => ({ ...question, id: `${provider.toUpperCase()}${index + 1}` }));
}
