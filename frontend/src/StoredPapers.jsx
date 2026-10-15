import { useEffect, useState } from 'react'
import PaperEditor from './PaperEditor'
import PdfDownload from './PdfDownload'
import { plainText, formatQuestion } from './paperText'

const pretty = text => String(text || '').replaceAll('_', ' ')
export function StoredPaperPreview({ result, apiUrl, onSaved }) {
  const paper = result.paper
  const sections = [...new Set(paper.questions.map(q => q.marks))].sort((a,b) => a-b)
  function download() {
    let number = 0
    const text = [paper.title, pretty(paper.subject), `Total: ${paper.totalMarks} marks`, ...sections.flatMap((m,i) => [`\nSECTION ${String.fromCharCode(65+i)} - ${m} MARKS`, ...paper.questions.filter(q=>q.marks===m).map(q=>`${++number}. ${formatQuestion(q)} [${m} {m===1?'mark':'marks'}]`)])].join('\n')
    const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'})), a=document.createElement('a')
    a.href=url; a.download=`question-paper-${result.id}.txt`; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="paper-preview" aria-label="Retrieved question paper"><div className="section-heading"><div><span className="eyebrow">STORED PAPER {result.id}</span><h2>{plainText(paper.title)}</h2><p className="muted small">Saved {new Date(result.createdAt).toLocaleString()}</p></div><div className="preview-actions"><PaperEditor apiUrl={apiUrl} result={result} onSaved={onSaved} /><PdfDownload paper={paper} /><button className="secondary" onClick={()=>window.print()}>Print</button><button className="primary" onClick={download}>Download TXT</button></div></div><div className="paper-sheet"><div className="paper-header"><h2>{pretty(paper.subject)}</h2><span>{paper.questions.length} questions | {paper.totalMarks} marks</span></div>{sections.map((m,i)=><section className="paper-section" key={m}><div className="paper-section-heading"><h3>Section {String.fromCharCode(65+i)} - {m} {m===1?'mark':'marks'}</h3><span>{paper.questions.filter(q=>q.marks===m).length} questions</span></div><ol className="paper-questions" start={1+paper.questions.filter(q=>q.marks<m).length}>{paper.questions.filter(q=>q.marks===m).map((q,j)=><li key={j}><div><p>{formatQuestion(q)}</p></div><strong>{m}<span>{m===1?'mark':'marks'}</span></strong></li>)}</ol></section>)}<div className="paper-end">END OF QUESTION PAPER</div></div></section>
}
export default function StoredPapers({ apiUrl, subjects }) {
  const [subject,setSubject]=useState(''), [search,setSearch]=useState(''), [page,setPage]=useState(1), [refresh,setRefresh]=useState(0)
  const [data,setData]=useState({items:[],total:0}), [error,setError]=useState(''), [loading,setLoading]=useState(true), [result,setResult]=useState(null)
  const [paperId,setPaperId]=useState(()=>window.location.hash.match(/^#stored-papers\/(\d+)$/)?.[1] || '')
  useEffect(()=>{
    const changed=()=>setPaperId(window.location.hash.match(/^#stored-papers\/(\d+)$/)?.[1] || '')
    window.addEventListener('hashchange',changed)
    return ()=>window.removeEventListener('hashchange',changed)
  },[])
  useEffect(()=>{
    const controller=new AbortController()
    Promise.resolve().then(()=>{if(!controller.signal.aborted) {setLoading(true);setError('')}})
    const params=new URLSearchParams({page})
    if(subject) params.set('subject',subject)
    if(search.trim()) params.set('q',search.trim())
    const path=paperId?`/papers/saved/${paperId}`:`/papers/saved?${params}`
    fetch(apiUrl+path,{signal:controller.signal}).then(async response=>{
      const body=await response.json()
      if(!response.ok) throw new Error(body.error || 'Could not load stored papers.')
      if(paperId) setResult(body); else {setData(body);setResult(null)}
    }).catch(err=>{if(err.name!=='AbortError')setError(err.message==='Failed to fetch'?'Cannot reach the backend. Please retry.':err.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[apiUrl,subject,search,page,refresh,paperId])
  const filter=setter=>e=>{setter(e.target.value);setPage(1)}
  return <><div className="stored-paper-controls">{paperId ? <button className="secondary" onClick={()=>{window.location.hash='stored-papers'}}>Back to stored papers</button> : <div className="filter-bar"><input aria-label="Search stored papers" maxLength="120" placeholder="Search paper titles" value={search} onChange={filter(setSearch)} /><select aria-label="Stored paper subject" value={subject} onChange={filter(setSubject)}><option value="">All subjects</option>{subjects.map(s=><option value={s} key={s}>{pretty(s)}</option>)}</select><button className="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh papers</button></div>}</div>
    {error ? <div className="empty-state" role="alert"><h2>Could not retrieve papers</h2><p>{error}</p><button className="secondary" onClick={()=>setRefresh(n=>n+1)}>Retry</button></div> : loading ? <p role="status">Loading stored papers...</p> : paperId && result ? <StoredPaperPreview result={result} apiUrl={apiUrl} onSaved={setResult} /> : <><p className="muted small">{data.total} stored papers</p>{data.items.length ? <div className="stored-paper-grid">{data.items.map(p=><article className="panel stored-paper-card" key={p.id}><span className="eyebrow">PAPER {p.id}</span><h2>{plainText(p.title)}</h2><p className="subject-label">{pretty(p.subject)}</p><div className="paper-summary"><span>{p.count} questions</span><strong>{p.totalMarks} marks</strong></div><p className="muted small">{new Date(p.createdAt).toLocaleString()}</p><button className="primary" onClick={()=>{window.location.hash=`stored-papers/${p.id}`}}>Open paper</button></article>)}</div> : <div className="empty-state"><h2>No stored papers</h2><p>{subject || search ? 'Try another subject or search.' : 'Create a question paper. Completed papers are saved here automatically.'}</p></div>}<div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous papers</button><span>Page {page}</span><button className="secondary" disabled={page*20>=data.total} onClick={()=>setPage(p=>p+1)}>Next papers</button></div></>}
  </>
}
