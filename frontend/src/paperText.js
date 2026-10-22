export const plainText = text => String(text || '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()

export const bloomLabel = q => /^K[1-6]$/.test(q.bloomLevel || "") ? q.bloomLevel : "—"

export const formatQuestion = (q, { includeBloom = true } = {}) => [plainText(q.text || `${q.topic} - ${q.subtopic || ''}`), ...(q.questionType==='MCQ' && Array.isArray(q.options) ? q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${plainText(o)}`) : []), ...(includeBloom && q.bloomLevel?[`[${q.bloomLevel}]`]:[])].join('\n')

const STRUCTURED_LABEL = /\b(Schemas?|Expression\s+E\d+|Query\s+Q\d+|Dataset|Data\s+set|Table(?:\s+\w+)?|Equation(?:\s+\w+)?|Given\s+data|Instances?)\s*:/gi

// Keep model-provided technical material readable without interpreting it as HTML.
export function questionBlocks(value) {
  const text = plainText(value).trim()
  if (!text) return []
  const matches = [...text.matchAll(STRUCTURED_LABEL)]
  if (!matches.length) return text.split(/\n+/).map(content => ({ type: 'text', content: content.trim() })).filter(block => block.content)

  const blocks = []
  if (text.slice(0, matches[0].index).trim()) blocks.push({ type: 'text', content: text.slice(0, matches[0].index).trim() })
  matches.forEach((match, index) => {
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const label = match[1].replace(/\s+/g, ' ')
    const content = text.slice(start, end).trim().replace(/[\s.;]+$/, '')
    if (!content) return
    if (/^schemas?$/i.test(label)) {
      const relations = [...content.matchAll(/([A-Za-z_]\w*)\s*\(([^()]*)\)/g)]
      if (relations.length) {
        blocks.push({ type: 'schema', label, relations: relations.map(relation => ({ name: relation[1], columns: relation[2].split(',').map(column => column.trim()).filter(Boolean) })) })
        const remainder = content.replace(/([A-Za-z_]\w*)\s*\(([^()]*)\)/g, '').replace(/^[\s,;]+|[\s,;]+$/g, '')
        if (remainder) blocks.push({ type: 'text', content: remainder })
      } else blocks.push({ type: 'code', label, content })
    } else {
      const trailing = content.match(/\.\s+(?=(?:Evaluate|Compare|Determine|Explain|Assess|Discuss|Find|Calculate|Compute|State|Identify|Interpret|Analyze|Logarithms|Assume|Use)\b)/i)
      if (trailing) {
        const splitAt = trailing.index + 1
        blocks.push({ type: 'code', label, content: content.slice(0, splitAt).trim() })
        blocks.push({ type: 'text', content: content.slice(splitAt).trim() })
      } else {
        blocks.push({ type: 'code', label, content })
      }
    }
  })
  return blocks
}
