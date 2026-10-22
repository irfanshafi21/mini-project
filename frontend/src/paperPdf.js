import { plainText, questionBlocks, bloomLabel } from './paperText.js'
import notoSansUrl from './assets/NotoSans-Regular.ttf?url'

let fontPromise
async function fontData() {
  fontPromise ||= fetch(notoSansUrl).then(async r=>{
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
  let embeddedFont = fontBase64
  if (!embeddedFont) {
    try { embeddedFont = await fontData() } catch { /* Keep PDF export available if the optional local font cannot load. */ }
  }
  if (embeddedFont) {
    try {
      doc.addFileToVFS('NotoSans.ttf', embeddedFont)
      doc.addFont('NotoSans.ttf', 'NotoSans', 'normal')
      doc.setFont('NotoSans', 'normal')
    } catch {
      doc.setFont('helvetica', 'normal')
    }
  } else {
    doc.setFont('helvetica', 'normal')
  }
  const title=plainText(paper.title || 'Question paper'), subject=plainText((paper.subject || 'GENERAL').replaceAll('_',' '))
  doc.setProperties({title,subject,creator:'Question Bank'})
  let y=22,number=0
  function page() {doc.addPage();y=20;doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('QUESTION PAPER - CONTINUED',20,y);y+=12}
  function space(height) {if(y+height>275)page()}
  function lines(text,size=11,width=170,x=20,leading=5.8) {
    doc.setFontSize(size);doc.setTextColor(30,46,60)
    for(const line of doc.splitTextToSize(plainText(text),width)) {space(leading);doc.text(line,x,y);y+=leading}
  }
  function drawQuestion(q) {
    const blocks=questionBlocks(q.text || `${q.topic || ''} - ${q.subtopic || ''}`)
    blocks.forEach(block=>{
      if(block.type==='schema') {
        block.relations.forEach(relation=>{
          const attributes=relation.columns.join('   |   ')
          doc.setFontSize(9);const wrapped=doc.splitTextToSize(attributes,150)
          const height=8+wrapped.length*5.3
          space(height+3);doc.setDrawColor(205,220,231);doc.setFillColor(248,251,253);doc.roundedRect(29,y-4,161,height,2,2,'FD')
          doc.setTextColor(49,95,128);doc.setFontSize(9);doc.text(relation.name,33,y+2)
          y+=7;doc.setTextColor(38,63,87);doc.setFontSize(8.5)
          wrapped.forEach(line=>{doc.text(line,33,y);y+=5.3})
          y+=3
        })
      } else if(block.type==='code') {
        const label=plainText(block.label),wrapped=doc.splitTextToSize(plainText(block.content),150)
        const height=12+wrapped.length*5.5
        space(height+3);doc.setDrawColor(205,220,231);doc.setFillColor(248,251,253);doc.roundedRect(29,y-4,161,height,2,2,'FD')
        doc.setTextColor(49,95,128);doc.setFontSize(8);doc.text(label.toUpperCase(),33,y+2);y+=7
        doc.setTextColor(38,63,87);doc.setFontSize(9)
        wrapped.forEach(line=>{doc.text(line,33,y);y+=5.5})
        y+=5
      } else {
        block.content.split(/\n+/).filter(Boolean).forEach(paragraph=>lines(paragraph,11,158,29,6))
        y+=1
      }
    })
    if(q.questionType==='MCQ'&&Array.isArray(q.options)) q.options.forEach((option,index)=>lines(`${String.fromCharCode(65+index)}. ${option}`,10,154,32,5.5))
  }
  lines(title,16);y+=2;lines(subject,12);y+=2
  lines(`${paper.questions.length} questions | Total marks: ${paper.questions.reduce((n,q)=>n+q.marks,0)}`,10);y+=8
  const marks=[...new Set(paper.questions.map(q=>q.marks))].sort((a,b)=>a-b)
  marks.forEach((mark,index)=>{
    const questions=paper.questions.filter(q=>q.marks===mark)
    space(50);doc.setFillColor(234,244,252);doc.rect(18,y-5,174,10,'F');doc.setTextColor(35,92,134);doc.setFontSize(11)
    doc.text(`Section ${String.fromCharCode(65+index)} - ${mark} ${mark===1?'mark':'marks'}`,21,y+1);y+=14
    for(const q of questions) {
      space(18);doc.setTextColor(30,46,60);doc.setFontSize(11)
      doc.text(`${++number}.`,20,y);doc.setFontSize(9);doc.text(bloomLabel(q),190,y,{align:'right'});doc.setFontSize(11);y+=2
      drawQuestion(q)
      y+=4
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
