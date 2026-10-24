import Select from './Select'
import BloomCounts from './BloomCounts'
import ReviewLearning from './ReviewLearning'
import { useEffect, useRef, useState } from 'react'
import PaperEditor from './PaperEditor'
import PdfDownload from './PdfDownload'
import { bloomLabel, formatQuestion } from './paperText'
import QuestionContent from './QuestionContent'
export default function SyllabusPaper({ apiUrl, subjects = [], source = 'syllabus', onGenerated }) {
  const [bankSubject,setBankSubject]=useState('')
  const [bloomCounts,setBloomCounts]=useState({})
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [saveMessage, setSaveMessage] = useState('')
  const syllabus = source === 'syllabus'
  const [file, setFile] = useState(null), [drag, setDrag] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [availableUnits, setAvailableUnits] = useState([]), [scanning, setScanning] = useState(false), [uploadData, setUploadData] = useState(null)
  const inspectionController = useRef(null)
  useEffect(() => {
    if (!file?.type.startsWith('image/')) { setPhotoPreview(''); return }
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])
  const [form, setForm] = useState({ subject: '', units: [], topic: '', questionStyle: 'MIXED', totalMarks: 50, m1:0, oneMarkType:'MCQ', m2: 0, m5: 0, m10: 0, m16: 0, easy: 40, medium: 40, hard: 20 })
  const change = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); if (['subject', 'questionStyle'].includes(e.target.name)) { setResult(null) } }
  const selectedCount = [1, 2, 5, 10, 16].reduce((sum, mark) => sum + (Number(form['m' + mark]) || 0), 0)
  const selectedMarks = [1, 2, 5, 10, 16].reduce((sum, mark) => sum + mark * (Number(form['m' + mark]) || 0), 0)
  const difficultyTotal = Number(form.easy) + Number(form.medium) + Number(form.hard)
  async function choose(value) {
    inspectionController.current?.abort()
    setError(''); setResult(null); setAvailableUnits([]); setUploadData(null); setForm(f => ({ ...f, units: [] }))
    if (!value || !/\.(pdf|txt|jpe?g|png|webp)$/i.test(value.name) || !value.size || value.size > 5 * 1024 * 1024) {
      setFile(null); setScanning(false); setError('Choose a non-empty PDF, TXT or syllabus photo (JPEG, PNG or WebP), up to 5 MB.'); return
    }
    setFile(value); setScanning(true)
    const controller = new AbortController()
    inspectionController.current = controller
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = () => reject(new Error('Could not read your file.'))
        reader.readAsDataURL(value)
      })
      const mimeType = value.type || (/\.pdf$/i.test(value.name) ? 'application/pdf' : /\.txt$/i.test(value.name) ? 'text/plain' : /\.png$/i.test(value.name) ? 'image/png' : /\.webp$/i.test(value.name) ? 'image/webp' : 'image/jpeg')
      const response = await fetch(`${apiUrl}/syllabus/inspect`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: value.name, mimeType, data }) })
      const inspected = await response.json()
      if (!response.ok) throw new Error(inspected.details?.map(item => item.message).join(' | ') || inspected.error || 'Could not scan the syllabus.')
      setUploadData({ fileName: value.name, mimeType, data })
      setAvailableUnits(inspected.units || [])
      if (!inspected.units?.length) throw new Error('No numbered units were detected. Check that the syllabus headings use labels such as “Unit 1” or “Unit I”.')
    } catch (scanError) {
      if (scanError.name !== 'AbortError') setError(scanError.message === 'Failed to fetch' ? 'Could not scan the syllabus. Check that the backend is running, then choose the file again.' : scanError.message)
    } finally {
      if (!controller.signal.aborted) setScanning(false)
    }
  }
  async function generate(e) {
    e.preventDefault(); setError('')
    if (Number(form.easy) + Number(form.medium) + Number(form.hard) !== 100) return setError('Difficulty percentages must total 100%.')
    if (syllabus && !file) return setError('Choose your syllabus file first.')
    if (syllabus && scanning) return setError('Wait for the syllabus scan to finish before generating the paper.')
    if (syllabus && (!uploadData || !availableUnits.length)) return setError('Scan a syllabus with detectable unit headings before generating the paper.')
    const markCounts = Object.fromEntries([1, 2, 5, 10, 16].map(m => [m, Number(form['m' + m]) || 0]))
    if (selectedCount && (selectedCount > 100 || selectedMarks !== Number(form.totalMarks))) return setError('Selected questions must total the requested marks, with no more than 100 questions.')
    if(selectedCount && [1,2,5,10,16].some(m=>Object.values(bloomCounts[m] || {}).reduce((n,c)=>n+c,0)!==(Number(form['m'+m]) || 0)))return setError('Allocate exactly the selected question count across K1-K6 for every mark category.')
    const questionCount = selectedCount
    setBusy(true); setResult(null); setSaveMessage(''); setSaveError('')
    try {
      const body = { ...(selectedCount?{bloomCounts:Object.fromEntries([1,2,5,10,16].filter(m=>Number(form['m'+m])>0).map(m=>[m,bloomCounts[m]]))}:{}),subject: form.subject.trim() || undefined, markCounts, oneMarkType:form.oneMarkType, questionStyle:syllabus ? form.questionStyle : undefined, count: questionCount, totalMarks: Number(form.totalMarks), split: { easy: Number(form.easy), medium: Number(form.medium), hard: Number(form.hard) } }
      if (syllabus) { Object.assign(body, uploadData, { count: questionCount }); if(form.units.length)body.units=form.units }
      else { if (form.units.length) body.units = form.units; if (form.topic.trim()) body.topic = form.topic.trim() }
      const r = await fetch(`${apiUrl}/papers/${syllabus ? 'from-syllabus' : 'generate'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), response = await r.json()
      if (!r.ok) {
        // Keep service/configuration diagnostics on the server; show task-focused messages here.
        const message = response.error || 'Could not generate the paper. Please retry.';
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
  const coverageUnits = result ? (result.paper.units || [...new Set(result.paper.questions.map(q => Number(q.unit)).filter(Number.isFinite))]).slice().sort((a, b) => a - b) : []
  const coverageMarks = result ? [...new Set(result.paper.questions.map(q => Number(q.marks)).filter(Number.isFinite))].sort((a, b) => a - b) : []
  const styleLabels = { THEORY: 'Theory only', PROBLEM_SOLVING: 'Sums / problem solving only', MIXED: 'Mixed theory and problem solving', PROGRAMMING_SQL: 'Programming / SQL' }
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
        ...section.questions.map(q => `${++number}. ${formatQuestion(q)}\n`), '']), 'END OF QUESTION PAPER'].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'question-paper.txt'; a.click(); URL.revokeObjectURL(url)
  }
  return <><section className="panel generation-panel"><span className="eyebrow">STEP 02 / CONFIGURE</span><h2>{syllabus ? 'Generate from syllabus' : 'Generate from question bank'}</h2><p className="muted">{syllabus ? 'Create a balanced question paper based on the topics in your syllabus.' : 'Choose a subject. We will select suitable questions from your saved collection.'}</p><form onSubmit={generate}><fieldset disabled={busy}>
    <label className="field"><span>Subject (optional)</span><Select name="subject" value={form.subject} onChange={change}><option value="">{syllabus?'No subject - unassigned paper':'All subjects'}</option>{subjects.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</Select></label>
    {syllabus ? <><label className={`upload-zone ${drag ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) choose(e.dataTransfer.files[0]) }}><span className="upload-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 31V8m0 0-8 8m8-8 8 8M10 27v9a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span className="upload-copy"><strong>{drag ? 'Drop your syllabus to upload' : file ? 'Syllabus ready to process' : 'Upload your syllabus'}</strong><span>{file ? file.name : 'Drag and drop a file here, or browse your device'}</span></span><span className="upload-formats"><span>PDF</span><span>TXT</span><span>JPG · PNG · WebP</span></span><span className="upload-limit">Maximum file size: 5 MB</span><span className="upload-browse">Browse files</span><input aria-label="Upload syllabus" type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp" onChange={e => choose(e.target.files[0])} /></label>{file && <div className="syllabus-file-preview">{photoPreview ? <img src={photoPreview} alt="Preview of uploaded syllabus" /> : <span className="syllabus-file-type" aria-hidden="true">{file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'TXT'}</span>}<span className="syllabus-file-info"><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · {scanning ? 'Scanning syllabus units…' : uploadData ? `${availableUnits.length} unit${availableUnits.length === 1 ? '' : 's'} detected` : 'Choose a file to scan'}</span></span><button type="button" className="text-button" onClick={() => { inspectionController.current?.abort(); setFile(null); setUploadData(null); setAvailableUnits([]); setScanning(false); setForm(f => ({ ...f, units: [] })); setError('') }}>Remove file</button></div>}<div className="field syllabus-unit-field"><span>Generate questions from</span><div className="unit-picker" role="group" aria-label="Choose syllabus units"><label><input type="checkbox" checked={!form.units.length} disabled={!availableUnits.length || scanning} onChange={() => setForm(f => ({ ...f, units: [] }))} />All units</label>{availableUnits.map(unit=><label key={unit}><input type="checkbox" checked={form.units.includes(unit)} disabled={scanning} onChange={e=>setForm(f=>({...f,units:e.target.checked?[...f.units,unit].sort((a,b)=>a-b):f.units.filter(value=>value!==unit)}))} />Unit {unit}</label>)}</div><span className="small muted">{scanning ? 'Reading the uploaded file and detecting its unit headings…' : availableUnits.length ? `Detected ${availableUnits.length} unit${availableUnits.length === 1 ? '' : 's'}. Select any combination, or leave All units selected.` : 'Upload a syllabus to detect its units automatically.'} The selected syllabus content is the only source used for questions.</span></div><p className="small muted">After generation, use Add to question bank to keep the questions for reuse.</p></> : <div className="form-row"><label className="field"><span>Unit number (optional)</span><input type="number" min="1" max="100" value={form.units[0] || ''} onChange={e=>setForm(f=>({...f,units:e.target.value?[Number(e.target.value)]:[]}))} placeholder="All units" /></label><label className="field"><span>Topic (optional)</span><input name="topic" maxLength="60" value={form.topic} onChange={change} placeholder="All topics" /></label></div>}
    {syllabus && <label className="field question-style-field"><span>Question style</span><Select name="questionStyle" value={form.questionStyle} onChange={change}><option value="THEORY">Theory only</option><option value="PROBLEM_SOLVING">Sums / problem solving only</option><option value="MIXED">Mixed theory and problem solving</option></Select><span className="small muted">Questions will follow this style and stay within the selected syllabus units. Mixed mode uses both styles when the syllabus supports them.</span></label>}<div className="form-row marks-entry-row"><label className="field"><span>Total marks</span><input name="totalMarks" type="number" min="1" max="1000" required value={form.totalMarks} onChange={change} /></label><label className="field"><span>Number of questions</span><input className="calculated-count" name="count" type="number" readOnly value={selectedCount} aria-label="Number of questions" /></label></div><div className="builder-step"><span>01</span><h3>Question pattern</h3></div><div className="form-row marks-grid">{[1, 2, 5, 10, 16].map(m => <label className="field mark-tile" key={m}><span className="mark-tile-heading"><span>{m} {m===1?'mark':'marks'}</span><span className="mark-section">Question count</span></span><input name={'m' + m} type="number" min="0" max="100" required value={form['m' + m]} onChange={e=>{change(e);setBloomCounts(b=>({...b,[m]:{}}))}} aria-label={`${m}-mark questions`} /><span className="mark-subtotal">{m * (Number(form['m' + m]) || 0)} marks</span></label>)}</div>{[1,2,5,10,16].filter(m=>Number(form['m'+m])>0).map(m=><BloomCounts key={m} marks={m} count={Number(form['m'+m])} value={bloomCounts[m]} onChange={value=>setBloomCounts(b=>({...b,[m]:value}))}/>)}<div className={`pattern-summary ${selectedCount && selectedMarks !== Number(form.totalMarks) ? 'incomplete' : ''}`} aria-live="polite"><span><strong>{selectedCount}</strong> questions</span><span><strong>{selectedMarks}</strong> / {form.totalMarks || 0} marks</span></div>{Number(form.m1)>0 && <label className="field"><span>1-mark question type</span><Select name="oneMarkType" value={form.oneMarkType} onChange={change}><option value="MCQ">Multiple choice</option><option value="FILL_BLANK">Fill in the blanks</option></Select></label>}<div className="builder-step"><span>02</span><h3>Difficulty mix</h3></div><div className="form-row difficulty-grid">{['easy', 'medium', 'hard'].map(l => <label className="field" key={l}><span>{l[0].toUpperCase() + l.slice(1)} %</span><input name={l} type="number" min="0" max="100" required value={form[l]} onChange={change} /></label>)}</div><div className="form-footer"><span className={`allocation-badge ${difficultyTotal === 100 ? 'complete' : 'incomplete'}`}>{difficultyTotal}% allocated</span><button className="primary">{busy ? 'Creating your paper...' : syllabus ? 'Generate question paper' : 'Generate question paper'}</button></div>
    </fieldset></form><div aria-live="polite">{busy && <p className="generation-status"><span className="spinner" />{syllabus ? `Generating ${questionCount} questions from ${form.units.length || availableUnits.length} unit${(form.units.length || availableUnits.length) === 1 ? '' : 's'} in ${styleLabels[form.questionStyle].toLowerCase()} style…` : 'Selecting and balancing your saved questions...'}</p>}{error && <p className="error" role="alert">{error}</p>}</div></section>
    {result && <section className="paper-preview" aria-label="Generated question paper"><div className="section-heading"><div><span className="eyebrow">STEP 03 / YOUR PAPER</span><h2>Question paper preview</h2><p className="muted small">Review every question before sharing with your class.</p></div><div className="preview-actions"><PaperEditor apiUrl={apiUrl} result={result} onSaved={updated => { setResult(updated); setSaveMessage('') }} />{syllabus && <button className="secondary" disabled={saving || !!saveMessage} onClick={saveQuestions}>{saving ? 'Adding...' : saveMessage ? 'Added to question bank' : 'Add to question bank'}</button>}<PdfDownload paper={result.paper} /><button className="secondary" onClick={() => window.print()}>Print</button><button className="primary" onClick={download}>Download TXT </button></div></div>{syllabus && <section className="panel unit-coverage-panel" aria-label="Generated unit coverage"><div className="section-heading"><div><span className="eyebrow">COVERAGE CHECK</span><h3>Unit coverage by question marks</h3><p className="muted small">This shows the actual unit assignment for each marks group. Counts in a group are spread as evenly as the question count allows.</p></div><span className="pill">Style: {styleLabels[result.paper.questionStyle] || styleLabels[form.questionStyle]}</span></div><p className="small muted generated-style-summary">Generated question types: {Object.entries(result.paper.questionStyleCoverage || {}).map(([style,count])=>`${count} ${style.toLowerCase().replaceAll('_',' ')}`).join(' · ') || 'not classified'}</p><div className="table-scroll"><table><thead><tr><th scope="col">Marks</th>{coverageUnits.map(unit=><th key={unit} scope="col">Unit {unit}</th>)}<th scope="col">Group total</th></tr></thead><tbody>{coverageMarks.map(mark=>{const questions=result.paper.questions.filter(q=>Number(q.marks)===mark);return <tr key={mark}><th scope="row">{mark} {mark===1?'mark':'marks'}</th>{coverageUnits.map(unit=><td key={unit}>{questions.filter(q=>Number(q.unit)===unit).length}</td>)}<td>{questions.length}</td></tr>})}</tbody></table></div></section>}{syllabus && !form.subject && <label className="field"><span>Question bank subject</span><Select value={bankSubject} onChange={e=>setBankSubject(e.target.value)}><option value="">Choose an existing subject to add questions</option>{subjects.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</Select></label>}{syllabus && saveMessage && <p className="saved-notice" role="status">{saveMessage}</p>}{saveError && <p className="error" role="alert">{saveError}</p>}{result.warning && <p className="warning" role="status">{result.warning}</p>}<ReviewLearning key={JSON.stringify(result.paper)} result={result} apiUrl={apiUrl} /><div className="paper-sheet"><div className="paper-header"><span className="eyebrow">EXAMINATION QUESTION PAPER</span><h2>{result.paper.subject?.replaceAll('_', ' ') || 'General'}</h2><div><span>{result.paper.questions.length} questions</span><span>Total: {result.paper.totalMarks} marks</span></div></div>{sections.map(section => {
      const start = questionNumber + 1
      questionNumber += section.questions.length
      return <section className="paper-section" key={section.mark} aria-label={`Section ${section.letter}`}><div className="paper-section-heading"><h3>Section {section.letter} - {section.mark} {section.mark===1?'mark':'marks'}</h3><span>{section.questions.length} x {section.mark} = {section.questions.length * section.mark} marks</span></div><ol className="paper-questions" start={start}>{section.questions.map((q, i) => <li key={q.id || i}><span className="paper-question-number">{start + i}.</span><div><QuestionContent question={q} includeBloom={false} /></div><strong className="paper-bloom" aria-label={`Bloom level ${bloomLabel(q)}`}>{bloomLabel(q)}</strong></li>)}</ol></section>
    })}<div className="paper-end">END OF QUESTION PAPER</div></div></section>}
  </>
}
