import { useState } from 'react'
import { downloadPaperPdf } from './paperPdf'
export default function PdfDownload({ paper }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function download(){setBusy(true);setError('');try{await downloadPaperPdf(paper)}catch(error){console.error('Question paper PDF export failed:',error);setError('PDF could not be created. Please check your browser download settings and try again.')}finally{setBusy(false)}}
  return <div className="pdf-download-control"><button className="primary" disabled={busy} aria-busy={busy} onClick={download}>{busy?'Preparing PDF...':'Download PDF'}</button>{error&&<span role="alert" className="pdf-download-error">{error}</span>}</div>
}
