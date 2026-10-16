import BloomCounts from './BloomCounts'
import ReviewLearning from './ReviewLearning'
import { useState } from 'react'
import PaperEditor from './PaperEditor'
import PdfDownload from './PdfDownload'
import { formatQuestion } from './paperText'
export default function SyllabusPaper({ apiUrl, subjects = [], source = 'syllabus', onGenerated }) {
  const [bankSubject,setBankSubject]=useState('')
  const [bloomCounts,setBloomCounts]=useState({})
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [saveMessage, setSaveMessage] = useState('')
  const syllabus = source === 'syllabus'
  const [file, setFile] = useState(null), [drag, setDrag] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null)
  const [form, setForm] = useState({ subject: '', units: [], topic: '', totalMarks: 50, m1:0, oneMarkType:'MCQ', m2: 0, m5: 0, m10: 0, m16: 0, easy: 40, medium: 40, hard: 20 })
  const change = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); if (e.target.name === 'subject') { setResult(null) } }
  const selectedCount = [1, 2, 5, 10, 16].reduce((sum, mark) => sum + (Number(form['m' + mark]) || 0), 0)
  const selectedMarks = [1, 2, 5, 10, 16].reduce((sum, mark) => sum + mark * (Number(form['m' + mark]) || 0), 0)
  const difficultyTotal = Number(form.easy) + Number(form.medium) + Number(form.hard)
  function choose(value) { setError(''); setResult(null); if (!value || !/\.(pdf|txt)$/i.test(value.name) || !value.size || value.size > 5 * 1024 * 1024) { setFile(null); setError('Choose a non-empty PDF or TXT syllabus, up to 5 MB.'); return } setFile(value) }
  async function generate(e) {
    e.preventDefault(); setError('')
    if (Number(form.easy) + Number(form.medium) + Number(form.hard) !== 100) return setError('Difficulty percentages must total 100%.')
    if (syllabus && !file) return setError('Choose your syllabus file first.')
    const markCounts = Object.fromEntries([1, 2, 5, 10, 16].map(m => [m, Number(form['m' + m]) || 0]))
    if (selectedCount && (selectedCount > 50 || selectedMarks !== Number(form.totalMarks))) return setError('Selected questions must total the requested marks, with no more than 50 questions.')
    if(selectedCount && [1,2,5,10,16].some(m=>Object.values(bloomCounts[m] || {}).reduce((n,c)=>n+c,0)!==(Number(form['m'+m]) || 0)))return setError('Allocate exactly the selected question count across K1-K6 for every mark category.')
    const questionCount = selectedCount
    setBusy(true); setResult(null); setSaveMessage(''); setSaveError('')
    try {
      const body = { ...(selectedCount?{bloomCounts:Object.fromEntries([1,2,5,10,16].filter(m=>Number(form['m'+m])>0).map(m=>[m,bloomCounts[m]]))}:{}),subject: form.subject.trim() || undefined, markCounts, oneMarkType:form.oneMarkType, count: questionCount, totalMarks: Number(form.totalMarks), split: { easy: Number(form.easy), medium: Number(form.medium), hard: Number(form.hard) } }
      if (syllabus) { const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = () => reject(new Error('Could not read your file.')); r.readAsDataURL(file) }); Object.assign(body, { fileName: file.name, mimeType: /\.pdf$/i.test(file.name) ? 'application/pdf' : 'text/plain', data, count: questionCount }) }
      else { if (form.units.length) body.units = form.units; if (form.topic.trim()) body.topic = form.topic.trim() }
      const r = await fetch(`${apiUrl}/papers/${syllabus ? 'from-syllabus' : 'generate'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), response = await r.json()
      if (!r.ok) {
        // Keep service/configuration diagnostics on the server; show task-focused messages here.
        const message = syllabus && r.status === 429 ? 'Generation limit reached. Please try again later.'
          : syllabus && r.status === 503 ? 'Paper generation is temporarily unavailable. Please try again later.'
          : syllabus && r.status === 502 ? 'Could not generate the paper. Try again with a clearer syllabus or fewer questions.'
          : response.error;
        throw new Error(response.details?.map(d => d.message).join(' | ') || message)
      }
      setResult(response); onGenerated?.()
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'Cannot reach the API. Please try again.' : err.message) } finally { setBusy(false) }
  }
  async function saveQuestions() {
    if(!form.subject && !bankSubject) {setSaveError('Choose an existing subject before adding questions to the bank.');return}
    setSaving(true); setSaveError('')
    try {
      const response = await fetch(`${apiUrl}/papers/save-syllabus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: form.subject || bankSubject, questions: result.paper.questions }) })
      const saved = await response.json()
      if (!response.ok) throw new Error(saved.details?.map(d => d.message).join(' | ') || saved.error || 'Could not save questions.')
      setSaveMessage(`${saved.savedToBank} question${saved.savedToBank === 1 ? '' : 's'} saved to the question bank.${saved.alreadyInBank ? ` ${saved.alreadyInBank} already existed.` : ''}`)
      onGenerated?.()
    } catch (err) { setSaveError(err.message === 'Failed to fetch' ? 'Could not reach the backend. Your paper is still available; retry saving.' : err.message) }
    finally { setSaving(false) }
  }
  const marks = [1, 2, 5, 10, 16]
  const sections = result ? [...marks, ...new Set(result.paper.questions.map(q => q.marks).filter(m => !marks.includes(m)))].map((mark, index) => ({
    mark, letter: String.fromCharCode(65 + index), questions: result.paper.questions.filter(q => q.marks === mark),
  })).filter(section => section.questions.length) : []
  sections.forEach((s,i)=>{s.letter=String.fromCharCode(65+i)})
  let questionNumber = 0
  function download() {
    const paper = result.paper
    let number = 0
    const text = ['QUESTION PAPER', `Subject: ${paper.subject.replaceAll('_', ' ')}`, `Total marks: ${paper.totalMarks} / ${paper.requestedMarks}`, '',
      ...sections.flatMap(section => [`SECTION ${section.letter} - ${section.mark} MARKS`, `${section.questions.length} questions x ${section.mark} ${section.mark===1?'mark':'marks'} = ${section.questions.length * section.mark} marks`, '',
        ...section.questions.map(q => `${++number}. ${formatQuestion(q)}\n[${q.marks} marks | ${q.difficulty}]\n`), '']), 'END OF QUESTION PAPER'].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'question-paper.txt'; a.click(); URL.revokeObjectURL(url)
  }
  return <><section className="panel generation-panel"><span className="eyebrow">STEP 02 / CONFIGURE</span><h2>{syllabus ? 'Generate from syllabus' : 'Generate from question bank'}</h2><p className="muted">{syllabus ? 'Create a balanced question paper based on the topics in your syllabus.' : 'Choose a subject. We will select suitable questions from your saved collection.'}</p><form onSubmit={generate}><fieldset disabled={busy}>
    <label className="field"><span>Subject (optional)</span><select name="subject" value={form.subject} onChange={change}><option value="">{syllabus?'No subject - unassigned paper':'All subjects'}</option>{subjects.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label>
    {syllabus ? <><label className={`upload-zone ${drag ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) choose(e.dataTransfer.files[0]) }}><span className="upload-icon">Upload</span><strong>{file ? file.name : 'Drop your syllabus here'}</strong><span>{file ? `${(file.size / 1024).toFixed(0)} KB | Click to replace` : 'or click to browse | PDF or TXT | up to 5 MB'}</span><input aria-label="Upload syllabus" type="file" accept=".pdf,.txt" onChange={e => choose(e.target.files[0])} /></label><p className="small muted">After generation, use Add to question bank to keep the questions for reuse.</p></> : <div className="form-row"><div className="field"><span>Units</span><div className="unit-picker" role="group" aria-label="Choose units"><label><input type="checkbox" checked={!form.units.length} onChange={() => setForm(f => ({ ...f, units: [] }))} />All units</label>{[1,2,3,4,5].map(n => <label key={n}><input type="checkbox" checked={form.units.includes(n)} onChange={e => setForm(f => ({...f,units:e.target.checked ? [...f.units,n].sort() : f.units.filter(v => v !== n)}))} />Unit {n}</label>)}</div></div><label className="field"><span>Topic (optional)</span><input name="topic" maxLength="60" value={form.topic} onChange={change} placeholder="All topics" /></label></div>}
    <div className="form-row"><label className="field"><span>Total marks</span><input name="totalMarks" type="number" min="1" max="1000" required value={form.totalMarks} onChange={change} /></label><label className="field"><span>Number of questions</span><input className="calculated-count" name="count" type="number" readOnly value={selectedCount} aria-label="Number of questions" /></label></div><h3>Questions by marks</h3><div className="form-row marks-grid">{[1, 2, 5, 10, 16].map((m, index) => <label className="field mark-tile" key={m}><span className="mark-tile-heading"><span>{m} {m===1?'mark':'marks'}</span><span className="mark-section">Section {String.fromCharCode(65 + index)}</span></span><input name={'m' + m} type="number" min="0" max="50" required value={form['m' + m]} onChange={e=>{change(e);setBloomCounts(b=>({...b,[m]:{}}))}} aria-label={`${m}-mark questions`} /><span className="mark-subtotal">{m * (Number(form['m' + m]) || 0)} marks</span></label>)}</div>{[1,2,5,10,16].filter(m=>Number(form['m'+m])>0).map(m=><BloomCounts key={m} marks={m} count={Number(form['m'+m])} value={bloomCounts[m]} onChange={value=>setBloomCounts(b=>({...b,[m]:value}))}/>)}<div className={`pattern-summary ${selectedCount && selectedMarks !== Number(form.totalMarks) ? 'incomplete' : ''}`} aria-live="polite"><span><strong>{selectedCount}</strong> questions</span><span><strong>{selectedMarks}</strong> / {form.totalMarks || 0} marks</span></div>{Number(form.m1)>0 && <label className="field"><span>1-mark question type</span><select name="oneMarkType" value={form.oneMarkType} onChange={change}><option value="MCQ">Multiple choice</option><option value="FILL_BLANK">Fill in the blanks</option></select></label>}<h3>Difficulty mix</h3><div className="form-row difficulty-grid">{['easy', 'medium', 'hard'].map(l => <label className="field" key={l}><span>{l[0].toUpperCase() + l.slice(1)} %</span><input name={l} type="number" min="0" max="100" required value={form[l]} onChange={change} /></label>)}</div><div className="form-footer"><span className={`allocation-badge ${difficultyTotal === 100 ? 'complete' : 'incomplete'}`}>{difficultyTotal}% allocated</span><button className="primary">{busy ? 'Creating your paper...' : syllabus ? 'Generate question paper ' : 'Generate question paper '}</button></div>
    </fieldset></form><div aria-live="polite">{busy && <p className="generation-status"><span className="spinner" />{syllabus ? 'Reading your syllabus and writing questions. This may take up to 90 seconds.' : 'Selecting and balancing your saved questions...'}</p>}{error && <p className="error" role="alert">{error}</p>}</div></section>
    {result && <section className="paper-preview" aria-label="Generated question paper"><div className="section-heading"><div><span className="eyebrow">STEP 03 / YOUR PAPER</span><h2>Question paper preview</h2><p className="muted small">Review every question before sharing with your class.</p></div><div className="preview-actions"><PaperEditor apiUrl={apiUrl} result={result} onSaved={updated => { setResult(updated); setSaveMessage('') }} />{syllabus && <button className="secondary" disabled={saving || !!saveMessage} onClick={saveQuestions}>{saving ? 'Adding...' : saveMessage ? 'Added to question bank' : 'Add to question bank'}</button>}<PdfDownload paper={result.paper} /><button className="secondary" onClick={() => window.print()}>Print</button><button className="primary" onClick={download}>Download TXT </button></div></div>{syllabus && !form.subject && <label className="field"><span>Question bank subject</span><select value={bankSubject} onChange={e=>setBankSubject(e.target.value)}><option value="">Choose an existing subject to add questions</option>{subjects.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label>}{syllabus && saveMessage && <p className="saved-notice" role="status">{saveMessage}</p>}{saveError && <p className="error" role="alert">{saveError}</p>}{result.warning && <p className="warning" role="status">{result.warning}</p>}<ReviewLearning key={JSON.stringify(result.paper)} result={result} apiUrl={apiUrl} /><div className="paper-sheet"><div className="paper-header"><span className="eyebrow">EXAMINATION QUESTION PAPER</span><h2>{result.paper.subject?.replaceAll('_', ' ') || 'General'}</h2><div><span>{result.paper.questions.length} questions</span><span>Total: {result.paper.totalMarks} marks</span></div></div>{sections.map(section => {
      const start = questionNumber + 1
      questionNumber += section.questions.length
      return <section className="paper-section" key={section.mark} aria-label={`Section ${section.letter}`}><div className="paper-section-heading"><h3>Section {section.letter} - {section.mark} {section.mark===1?'mark':'marks'}</h3><span>{section.questions.length} x {section.mark} = {section.questions.length * section.mark} marks</span></div><ol className="paper-questions" start={start}>{section.questions.map((q, i) => <li key={q.id || i}><div><p>{formatQuestion(q)}</p></div><strong>{q.marks}<span>{q.marks===1?'mark':'marks'}</span></strong></li>)}</ol></section>
    })}<div className="paper-end">END OF QUESTION PAPER</div></div></section>}
  </>
}
