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
      const response=await fetch(`${apiUrl}/papers/saved${result.id?'/'+result.id:''}`,{method:result.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:result.paper.subject,title:plainText(draft.title),questions:draft.questions.map(q=>({...q,unit:q.unit||1,marks:Number(q.marks),text:plainText(q.text)}))})})
      const saved=await response.json()
      if(!response.ok) throw new Error(saved.details?.map(d=>d.message).join(' | ') || saved.error || 'Could not save your edits.')
      onSaved(saved);setDraft(null)
    } catch(err) {setError(err.message==='Failed to fetch'?'Cannot reach the backend. Your edits are still here.':err.message)} finally {setBusy(false)}
  }
  return <div className="paper-edit-actions"><button className="secondary" disabled={busy || !!draft} onClick={start}>Edit paper</button>{draft && <form className="paper-edit-form" onSubmit={save}><fieldset disabled={busy}><h3>Edit question paper</h3><label className="field"><span>Paper title</span><input required maxLength="120" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} /></label>{draft.questions.map((q,i)=><div className="paper-edit-question" key={i}><label className="field"><span>Question {i+1}</span><textarea required rows="3" maxLength="2000" value={q.text} onChange={e=>change(i,'text',e.target.value)} /></label><label className="field"><span>Marks for question {i+1}</span><input required type="number" min="1" max="100" value={q.marks} onChange={e=>change(i,'marks',e.target.value)} /></label></div>)}<p className="muted">{draft.questions.length} questions | {total} marks</p><p className="small muted">Edits update this stored paper. Question bank entries stay separate.</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-footer"><button type="button" className="secondary" onClick={()=>setDraft(null)}>Cancel edits</button><button className="primary" disabled={total<1 || total>1000}>{busy?'Saving edits...':'Save changes'}</button></div></fieldset></form>}</div>
}
