import Select from './Select'
import { LEVELS } from './blooms'
import { useState } from 'react'

import { plainText } from './paperText'

export default function PaperEditor({ apiUrl, result, onSaved }) {
  const [draft,setDraft]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState('')
  if(!result) return null
  const total=draft?.questions.reduce((n,q)=>n+(Number(q.marks)||0),0) || 0
  function start() {setDraft({...result.paper,title:plainText(result.paper.title || 'Question paper'),questions:result.paper.questions.map(q=>({...q,text:plainText(q.text)}))});setError('')}
  function change(index,key,value) {setDraft(d=>({...d,questions:d.questions.map((q,i)=>i===index?{...q,[key]:value}:q)}))}
  async function save(e) {
    e.preventDefault();setBusy(true);setError('')
    try {
      const response=await fetch(`${apiUrl}/papers/saved${result.id?'/'+result.id:''}`,{method:result.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:result.paper.subject==='UNASSIGNED'?undefined:result.paper.subject,title:plainText(draft.title),questions:draft.questions.map(q=>({...q,bloomLevel:q.bloomLevel || undefined,unit:q.unit||1,marks:Number(q.marks),text:plainText(q.text)}))})})
      const saved=await response.json()
      if(!response.ok) throw new Error(saved.details?.map(d=>d.message).join(' | ') || saved.error || 'Could not save your edits.')
      onSaved(saved);setDraft(null)
    } catch(err) {setError(err.message==='Failed to fetch'?'Cannot reach the backend. Your edits are still here.':err.message)} finally {setBusy(false)}
  }
  return <div className="paper-edit-actions"><button className="secondary" disabled={busy || !!draft} onClick={start}>Edit paper</button>{draft && <form className="paper-edit-form" onSubmit={save}><fieldset disabled={busy}><h3>Edit question paper</h3><label className="field"><span>Paper title</span><input required maxLength="120" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} /></label>{draft.questions.map((q,i)=><div className="paper-edit-question" key={i}><label className="field"><span>Question {i+1}</span><textarea required rows="3" maxLength="2000" value={q.text} onChange={e=>change(i,'text',e.target.value)} /></label><label className="field"><span>Marks for question {i+1}</span><input required type="number" min="1" max="100" readOnly={q.questionType && q.questionType!=='SHORT'} value={q.marks} onChange={e=>change(i,'marks',e.target.value)} /></label><label className="field"><span>Bloom level for question {i+1}</span><Select value={q.bloomLevel || ''} onChange={e=>change(i,'bloomLevel',e.target.value)}><option value="">Automatic classification</option>{Object.entries(LEVELS).map(([k,n])=><option key={k} value={k}>{k} - {n}</option>)}</Select></label>{q.questionType==='MCQ' && <div className="objective-editor">{q.options.map((option,j)=><label className="field" key={j}><span>Option {String.fromCharCode(65+j)} for question {i+1}</span><input required maxLength="300" value={option} onChange={e=>{const options=[...q.options];options[j]=e.target.value;setDraft(d=>({...d,questions:d.questions.map((item,n)=>n===i?{...item,options,answer:item.answer===option?e.target.value:item.answer}:item)}))}} /></label>)}<label className="field"><span>Correct answer for question {i+1}</span><Select required value={q.answer} onChange={e=>change(i,'answer',e.target.value)}><option value="">Select correct answer</option>{q.options.map((o,j)=><option key={j} value={o}>{String.fromCharCode(65+j)}. {o}</option>)}</Select></label></div>}{(!q.questionType || q.questionType==='SHORT') && <label className="field"><span>Teacher answer for question {i+1} (optional)</span><input maxLength="300" value={q.answer || ''} onChange={e=>change(i,'answer',e.target.value)} /></label>}{q.questionType==='FILL_BLANK' && <label className="field"><span>Answer for question {i+1}</span><input required maxLength="300" value={q.answer} onChange={e=>change(i,'answer',e.target.value)} /></label>}</div>)}<p className="muted">{draft.questions.length} questions | {total} marks</p><p className="small muted">Edits update this stored paper. Question bank entries stay separate.</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-footer"><button type="button" className="secondary" onClick={()=>setDraft(null)}>Cancel edits</button><button className="primary" disabled={total<1 || total>1000}>{busy?'Saving edits...':'Save changes'}</button></div></fieldset></form>}</div>
}
