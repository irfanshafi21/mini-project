import { bloomLabel, plainText, questionBlocks } from './paperText'

export default function QuestionContent({ question, includeBloom = true }) {
  const text = question.text || `${question.topic || ''}${question.subtopic ? ` - ${question.subtopic}` : ''}`
  const blocks = questionBlocks(text)
  const options = question.questionType === 'MCQ' && Array.isArray(question.options) ? question.options : []
  return <div className="question-content">
    {blocks.map((block, index) => block.type === 'schema'
      ? <div className="question-schema-list" key={index} aria-label="Relational schemas">
          {block.relations.map(relation => <div className="question-schema" key={`${index}-${relation.name}`}>
            <strong className="question-schema-name">{relation.name}</strong>
            <div className="question-schema-columns">{relation.columns.map((column, columnIndex) => <span key={`${column}-${columnIndex}`}>{column}</span>)}</div>
          </div>)}
        </div>
      : block.type === 'code'
        ? <div className="question-data-block" key={index}><span>{block.label}</span><pre>{block.content}</pre></div>
        : <p className="question-text-block" key={index}>{block.content}</p>)}
    {options.length > 0 && <ol className="question-options" type="A">{options.map((option, index) => <li key={index}>{plainText(option)}</li>)}</ol>}
    {includeBloom && question.bloomLevel && <span className="question-content-bloom">{bloomLabel(question)}</span>}
  </div>
}
