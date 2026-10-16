import { LEVELS } from './blooms'
import ReviewLearning from './ReviewLearning'
import { useEffect, useState } from 'react'
import PaperEditor from './PaperEditor'
import PdfDownload from './PdfDownload'
import { formatQuestion, bloomLabel } from './paperText'

async function call(apiUrl, path, body, signal) {
  const response = await fetch(apiUrl + path, { signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not complete this request.')
  return data
}
export function SubjectQuestions({ apiUrl, subject }) {
  return <QuestionPicker key={subject} apiUrl={apiUrl} subject={subject} />
}
function QuestionPicker({ apiUrl, subject, selected, toggle }) {
  const [page, setPage] = useState(1), [unit, setUnit] = useState(''), [marks, setMarks] = useState(''), [bloom,setBloom]=useState(''), [search, setSearch] = useState('')
  const [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState(''), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => { if (!controller.signal.aborted) setLoading(true) })
    const params = new URLSearchParams({ page, limit: 20 })
    if(subject.trim()) params.set('subject',subject.trim())
    if (unit) params.set('unit', unit)
    if (marks) params.set('marks', marks)
    if(bloom)params.set('bloomLevel',bloom)
    if (search.trim()) params.set('q', search.trim())
    call(apiUrl, `/questions?${params}`, null, controller.signal).then(d => { setData(d); setError('') })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [apiUrl, subject, page, unit, marks, bloom, search, retry])
  const filter = setter => e => { setter(e.target.value); setPage(1) }
  return <div className="subject-question-table"><div className="filter-bar"><input aria-label="Search subject questions" placeholder="Search questions" maxLength="200" value={search} onChange={filter(setSearch)} /><select aria-label="Question unit" value={unit} onChange={filter(setUnit)}><option value="">All units</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Unit {n}</option>)}</select><select aria-label="Question marks" value={marks} onChange={filter(setMarks)}><option value="">All marks</option>{[1, 2, 5, 10, 16].map(n => <option key={n} value={n}>{n} marks</option>)}</select><select aria-label="Question K level" value={bloom} onChange={filter(setBloom)}><option value="">All K levels</option>{Object.entries(LEVELS).map(([k,n])=><option key={k} value={k}>{k} - {n}</option>)}</select></div>
    {error ? <div role="alert"><p className="error">{error}</p><button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry</button></div> : loading ? <p role="status">Loading questions...</p> : <><div className="table-scroll"><table><caption>{(subject || 'All subjects').replaceAll('_', ' ')} — {data.total} stored questions</caption><thead><tr>{toggle && <th scope="col">Select</th>}<th scope="col">Code</th><th scope="col">Question</th><th scope="col">Unit</th><th scope="col">Marks</th><th scope="col">Difficulty</th><th scope="col">K level</th></tr></thead><tbody>{data.items.map(q => <tr key={q.id} className={selected?.some(s => s.id === q.id) ? 'selected-row' : ''}>{toggle && <td><input type="checkbox" aria-label={`Select ${q.code}`} checked={selected.some(s => s.id === q.id)} disabled={selected.length >= 50 && !selected.some(s => s.id === q.id)} onChange={() => toggle(q)} /></td>}<td>{q.code}</td><td>{formatQuestion(q)}</td><td>{q.unit}</td><td>{q.marks}</td><td>{q.difficulty.toLowerCase()}</td><td>{q.bloomLevel}</td></tr>)}</tbody></table></div>{!data.total && <p className="muted">No matching questions. Add questions to this subject first.</p>}<div className="pagination"><button className="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous questions</button><span>Page {page}</span><button className="secondary" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next questions</button></div></>}
  </div>
}
export default function ManualPaper({ apiUrl, subjects, onGenerated }) {
  const [subject, setSubject] = useState(''), [selected, setSelected] = useState([]), [title, setTitle] = useState('Question paper')
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const total = selected.reduce((sum, q) => sum + q.marks, 0)
  async function create() {
    setBusy(true); setError('')
    try { setResult(await call(apiUrl, '/papers/manual', { subject:subject.trim() || undefined, title, questionIds: selected.map(q => q.id) })); onGenerated?.() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const paper = result?.paper
  const sections = paper ? [...new Set(paper.questions.map(q => q.marks))].sort((a, b) => a - b) : []
  function download() {
    const text = [paper.title, paper.subject.replaceAll('_', ' '), `Total marks: ${paper.totalMarks}`, ...sections.flatMap((m, i) => [`\nSection ${String.fromCharCode(65 + i)} — ${m} ${m===1?'mark':'marks'}`, ...paper.questions.filter(q => q.marks === m).map((q, j) => `${1 + j + paper.questions.filter(q => q.marks < m).length}. ${formatQuestion(q)}`)])].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = 'question-paper.txt'; a.click(); URL.revokeObjectURL(url)
  }
  return <><section className="panel manual-panel"><span className="eyebrow">CHOOSE YOUR OWN QUESTIONS</span><h2>Manual question selection</h2><div className="form-row"><label className="field"><span>Subject (optional)</span><select value={subject} disabled={busy} onChange={e=>{setSubject(e.target.value);setSelected([]);setResult(null);setError('')}}><option value="">All subjects</option>{subjects.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label className="field"><span>Paper title</span><input maxLength="120" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></label></div>
    {<><fieldset disabled={busy}><QuestionPicker key={subject} apiUrl={apiUrl} subject={subject} selected={selected} toggle={q => setSelected(items => items.some(s => s.id === q.id) ? items.filter(s => s.id !== q.id) : [...items, q])} /></fieldset><div className="pattern-summary" aria-live="polite"><strong>{selected.length} selected</strong><strong>{total} marks</strong></div>{selected.length > 0 && <div className="selected-question-list">{selected.map(q => <button key={q.id} className="secondary" disabled={busy} onClick={() => setSelected(items => items.filter(s => s.id !== q.id))} aria-label={`Remove ${q.code}`}>{q.code} · {q.marks} marks ×</button>)}</div>}<div className="form-footer"><button className="secondary" disabled={busy || !selected.length} onClick={() => setSelected([])}>Clear selection</button><button className="primary" disabled={busy || !selected.length || !title.trim() || total > 1000} onClick={create}>{busy ? 'Saving...' : 'Create and save paper'}</button></div></>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>
    {paper && <section className="paper-preview" aria-label="Manual question paper"><div className="section-heading"><h2>{paper.title}</h2><div className="preview-actions"><PaperEditor apiUrl={apiUrl} result={result} onSaved={setResult} /><PdfDownload paper={result.paper} /><button className="secondary" onClick={() => window.print()}>Print</button><button className="primary" onClick={download}>Download TXT</button></div></div><ReviewLearning key={JSON.stringify(result.paper)} result={result} apiUrl={apiUrl} /><div className="paper-sheet"><div className="paper-header"><h2>{paper.subject.replaceAll('_', ' ')}</h2><span>{paper.questions.length} questions | {paper.totalMarks} marks</span></div>{sections.map((m, i) => <section key={m} className="paper-section"><div className="paper-section-heading"><h3>Section {String.fromCharCode(65 + i)} — {m} {m===1?'mark':'marks'}</h3></div><ol className="paper-questions" start={1 + paper.questions.filter(q => q.marks < m).length}>{paper.questions.filter(q => q.marks === m).map((q, j) => <li key={j}><div><p>{formatQuestion(q, { includeBloom: false })}</p></div><strong className="paper-bloom" aria-label={`Bloom level ${bloomLabel(q)}`}>{bloomLabel(q)}</strong></li>)}</ol></section>)}<div className="paper-end">END OF QUESTION PAPER</div></div></section>}
  </>
}
