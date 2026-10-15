import { useState } from 'react'
import { downloadPaperPdf } from './paperPdf'
export default function PdfDownload({ paper }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function download(){setBusy(true);setError('');try{await downloadPaperPdf(paper)}catch{setError('PDF download failed. Please retry.')}finally{setBusy(false)}}
  return <><button className="primary" disabled={busy} onClick={download}>{busy?'Preparing PDF...':'Download PDF'}</button>{error&&<span role="alert" className="error">{error}</span>}</>
}
