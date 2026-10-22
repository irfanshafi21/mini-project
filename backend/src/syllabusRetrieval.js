const tokens = value => String(value || '').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
const unitHeading = /^\s*unit\s*[-:]?\s*(1|2|3|4|5|I|II|III|IV|V)\b\s*[:.\-–—]?/i;
const unitNumber = value => ({ I: 1, II: 2, III: 3, IV: 4, V: 5 }[String(value).toUpperCase()] || Number(value));
const metadataLine = /^(?:recommended|suggested|prescribed|reference|text) *(?:books?|texts?|readings?|resources?)\b|^(?:authors?|publishers?|edition|isbn|doi)\s*[:\-]/i;

export function syllabusPassages(text) {
  let unit = 1;
  const passages = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    let line = raw.trim().replace(/^#{1,6}\s*/, '').replace(/^[-*•\d.)]+\s*/, '').replace(/\s+/g, ' ');
    if (!line) continue;
    const heading = line.match(unitHeading);
    if (heading) {
      unit = unitNumber(heading[1]);
      line = line.replace(unitHeading, '').trim();
      if (!line) continue;
    }
    if (metadataLine.test(line) || line.length < 12) continue;
    for (const sentence of line.split(/(?<=[.;])\s+(?=[A-Z0-9])/)) {
      const passage = sentence.trim().slice(0, 700);
      if (passage.length >= 12) passages.push({ unit, text: passage });
    }
  }
  return passages;
}

function bm25Score(queryTokens, passageTokens, documentFrequency, count, averageLength) {
  const k1 = 1.2, b = 0.75, length = passageTokens.length;
  const frequencies = new Map();
  for (const token of passageTokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  let score = 0;
  for (const token of queryTokens) {
    const frequency = frequencies.get(token) || 0;
    if (!frequency) continue;
    const documents = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (count - documents + 0.5) / (documents + 0.5));
    score += idf * (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * length / Math.max(averageLength, 1)));
  }
  return score;
}

export function retrieveSyllabusEvidence(text, topic, { limit = 2 } = {}) {
  const passages = syllabusPassages(text).filter(item => item.unit === topic.unit);
  if (!passages.length) return [String(topic.topic || '').slice(0, 700)].filter(Boolean);
  const indexed = passages.map(item => ({ ...item, terms: tokens(item.text) }));
  const documentFrequency = new Map();
  for (const item of indexed) for (const token of new Set(item.terms)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const averageLength = indexed.reduce((sum, item) => sum + item.terms.length, 0) / indexed.length;
  const queryTokens = [...new Set(tokens(topic.topic))];
  const ranked = indexed.map((item, index) => ({ item, index, score: bm25Score(queryTokens, item.terms, documentFrequency, indexed.length, averageLength) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item.text);
  return ranked.length ? ranked : [String(topic.topic || '').slice(0, 700)].filter(Boolean);
}
