import { useState } from 'react'

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Could not read the syllabus file'))
    reader.readAsDataURL(file)
  })
}

export default function SyllabusPaper({ apiUrl }) {
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ totalMarks: 50, count: 10, easy: 40, medium: 40, hard: 20 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paper, setPaper] = useState(null)
  const change = e => setForm(previous => ({ ...previous, [e.target.name]: e.target.value }))

  async function generate(e) {
    e.preventDefault()
    setError('')
    const extension = file?.name.split('.').pop().toLowerCase()
    if (!file || !['pdf', 'txt'].includes(extension)) return setError('Choose a PDF or TXT syllabus.')
    if (!file.size || file.size > 5 * 1024 * 1024) return setError('Choose a non-empty file no larger than 5 MB.')
    const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]))
    if (values.easy + values.medium + values.hard !== 100) return setError('Difficulty percentages must add up to 100.')
    if (values.totalMarks < values.count || values.totalMarks > values.count * 100) return setError('Allow 1–100 marks per question.')
    setBusy(true)
    setPaper(null)
    try {
      const data = await readFile(file)
      const response = await fetch(`${apiUrl}/papers/from-syllabus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: extension === 'pdf' ? 'application/pdf' : 'text/plain', data,
          totalMarks: values.totalMarks, count: values.count,
          split: { easy: values.easy, medium: values.medium, hard: values.hard } }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.details?.map(d => d.message).join('; ') || result.error || 'Generation failed')
      setPaper(result.paper)
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Cannot reach the backend. Make sure it is running.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const text = [`QUESTION PAPER`, `Syllabus: ${paper.fileName}`, `Total marks: ${paper.totalMarks}`, '',
      ...paper.questions.map(q => `${q.number}. ${q.text}\n[${q.marks} marks | ${q.difficulty}]\nTopic: ${q.topic} / ${q.subtopic}\nSyllabus reference: ${q.syllabusReference}\n`)].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'syllabus-question-paper.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <section className="add-section syllabus-section">
    <h2>Generate from Syllabus</h2>
    <p>Upload your syllabus and Gemini will write new questions covering its topics. PDF or TXT, up to 5 MB. The document is sent to Google Gemini for processing.</p>
    <form onSubmit={generate}>
      <fieldset disabled={busy}>
        <div className="form-group">
          <label htmlFor="syllabus-file">Syllabus file</label>
          <input id="syllabus-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" required onChange={e => { setFile(e.target.files[0] || null); setPaper(null) }} />
        </div>
        <div className="form-row">
          {[['totalMarks', 'Total marks', 1, 1000], ['count', 'Number of questions', 1, 50]].map(([name, label, min, max]) =>
            <div className="form-group" key={name}><label htmlFor={`syllabus-${name}`}>{label}</label>
              <input id={`syllabus-${name}`} name={name} type="number" min={min} max={max} required value={form[name]} onChange={change} /></div>)}
        </div>
        <p>Difficulty distribution applies to question counts, rounded to whole questions. Marks are spread evenly across questions.</p>
        <div className="form-row">
          {['easy', 'medium', 'hard'].map(name => <div className="form-group" key={name}>
            <label htmlFor={`syllabus-${name}`}>{name[0].toUpperCase() + name.slice(1)} %</label>
            <input id={`syllabus-${name}`} name={name} type="number" min="0" max="100" required value={form[name]} onChange={change} />
          </div>)}
        </div>
        <button className="save-button" type="submit">{busy ? 'Generating paper…' : 'Generate with Gemini'}</button>
      </fieldset>
    </form>
    <div aria-live="polite">{busy && <p>This can take up to 90 seconds.</p>}{error && <p className="error" role="alert">{error}</p>}</div>
    {paper && <div className="syllabus-result">
      <div className="section-header"><h2>Generated Question Paper</h2><span>{paper.totalMarks} marks</span></div>
      <p>{paper.questions.length} questions · {paper.fileName}</p>
      <p>Review the questions and syllabus references before using the paper.</p>
      <button type="button" onClick={download}>Download paper (.txt)</button>
      <div className="question-list">{paper.questions.map(q => <article className="question-card" key={q.id}>
        <div className="question-top"><strong>Question {q.number}</strong><span className="badge">{q.difficulty} · {q.marks} marks</span></div>
        <p className="question-text">{q.text}</p>
        <div className="question-details"><span>{q.topic}</span><span>{q.subtopic}</span></div>
        <p className="syllabus-reference">Syllabus reference: {q.syllabusReference}</p>
      </article>)}</div>
    </div>}
  </section>
}
