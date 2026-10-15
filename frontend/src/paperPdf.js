import { plainText, formatQuestion } from './paperText.js'

let fontPromise
async function fontData() {
  fontPromise ||= fetch(new URL('./assets/NotoSans-Regular.ttf',import.meta.url)).then(async r=>{
    if(!r.ok)throw new Error('Could not load the PDF font.')
    const bytes=new Uint8Array(await r.arrayBuffer())
    let binary=''
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
    return btoa(binary)
  }).catch(error=>{fontPromise=null;throw error})
  return fontPromise
}
export async function createPaperPdf(paper, fontBase64) {
  const {jsPDF}=await import('jspdf')
  const doc=new jsPDF({unit:'mm',format:'a4'})
  doc.addFileToVFS('NotoSans.ttf',fontBase64 || await fontData())
  doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans')
  const title=plainText(paper.title || 'Question paper'), subject=plainText((paper.subject || 'GENERAL').replaceAll('_',' '))
  doc.setProperties({title,subject,creator:'Question Bank'})
  let y=22,number=0
  function page() {doc.addPage();y=20;doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('QUESTION PAPER - CONTINUED',20,y);y+=12}
  function space(height) {if(y+height>275)page()}
  function lines(text,size=11,width=170) {
    doc.setFontSize(size);doc.setTextColor(30,46,60)
    for(const line of doc.splitTextToSize(plainText(text),width)) {space(6);doc.text(line,20,y);y+=6}
  }
  lines(title,16);y+=2;lines(subject,12);y+=2
  lines(`${paper.questions.length} questions | Total marks: ${paper.questions.reduce((n,q)=>n+q.marks,0)}`,10);y+=8
  const marks=[...new Set(paper.questions.map(q=>q.marks))].sort((a,b)=>a-b)
  marks.forEach((mark,index)=>{
    const questions=paper.questions.filter(q=>q.marks===mark)
    space(50);doc.setFillColor(234,244,252);doc.rect(18,y-5,174,10,'F');doc.setTextColor(35,92,134);doc.setFontSize(11)
    doc.text(`Section ${String.fromCharCode(65+index)} - ${mark} ${mark===1?'mark':'marks'}`,21,y+1);y+=14
    for(const q of questions) {
      doc.setFontSize(11)
      const wrapped=doc.splitTextToSize(formatQuestion(q),142)
      space(Math.min(wrapped.length*6+6,35));doc.setTextColor(30,46,60)
      doc.text(`${++number}.`,20,y);doc.setFontSize(9);doc.text(`${mark} ${mark===1?'mark':'marks'}`,190,y,{align:'right'});doc.setFontSize(11)
      for(const line of wrapped) {space(5.2);doc.text(line,29,y);y+=5.2}
      y+=2
    }
    y+=2
  })
  space(12);doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('END OF QUESTION PAPER',105,y+3,{align:'center'})
  const count=doc.getNumberOfPages()
  for(let i=1;i<=count;i++){doc.setPage(i);doc.setFontSize(9);doc.setTextColor(100,115,130);doc.text(`Page ${i} of ${count}`,105,288,{align:'center'})}
  return doc
}
export async function downloadPaperPdf(paper) {
  const doc=await createPaperPdf(paper)
  doc.save((plainText(paper.title || 'question-paper').replace(/[^a-z0-9 -]/gi,'').trim().slice(0,80) || 'question-paper')+'.pdf')
}
