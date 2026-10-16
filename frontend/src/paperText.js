export const plainText = text => String(text || '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()

export const formatQuestion = q => [plainText(q.text || `${q.topic} - ${q.subtopic || ''}`), ...(q.questionType==='MCQ' && Array.isArray(q.options) ? q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${plainText(o)}`) : []), ...(q.bloomLevel?[`[${q.bloomLevel}]`]:[])].join('\n')
