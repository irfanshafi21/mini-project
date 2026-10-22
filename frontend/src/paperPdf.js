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
  const questionX=34,questionWidth=142,boxX=34,boxWidth=148,boxTextX=38,boxTextWidth=140
  function page() {doc.addPage();y=20;doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('QUESTION PAPER - CONTINUED',20,y);y+=12}
  function space(height) {if(y+height>275)page()}
  function lines(text,size=11,width=170,x=20,leading=5.8) {
    doc.setFontSize(size);doc.setTextColor(30,46,60)
    for(const line of doc.splitTextToSize(plainText(text),width)) {space(leading);doc.text(line,x,y);y+=leading}
  }
  function getQuestionBlocks(q) {
    return questionBlocks(q.text || `${q.topic || ''} - ${q.subtopic || ''}`)
  }
  function estimateQuestionHeight(q,blocks) {
    let height=6
    blocks.forEach(block=>{
      if(block.type==='schema') {
        block.relations.forEach(relation=>{
          doc.setFontSize(8.5)
          const wrapped=doc.splitTextToSize(relation.columns.join('   |   '),boxTextWidth)
          height+=13+wrapped.length*5.2
        })
      } else if(block.type==='code') {
        doc.setFontSize(8.5)
        const wrapped=doc.splitTextToSize(plainText(block.content),boxTextWidth)
        height+=14+wrapped.length*5.2
      } else {
        doc.setFontSize(11)
        block.content.split(/\n+/).filter(Boolean).forEach(paragraph=>{
          height+=doc.splitTextToSize(plainText(paragraph),questionWidth).length*6+2
        })
      }
    })
    if(q.questionType==='MCQ'&&Array.isArray(q.options)) {
      doc.setFontSize(10)
      q.options.forEach((option,index)=>{height+=doc.splitTextToSize(`${String.fromCharCode(65+index)}. ${plainText(option)}`,questionWidth).length*5.5})
    }
    return height+4
  }
  function drawQuestion(q,blocks) {
    blocks.forEach(block=>{
      if(block.type==='schema') {
        block.relations.forEach(relation=>{
          const attributes=relation.columns.join('   |   ')
          doc.setFontSize(8.5);const wrapped=doc.splitTextToSize(attributes,boxTextWidth)
          const height=12+wrapped.length*5.2
          space(height+4);doc.setDrawColor(205,220,231);doc.setFillColor(248,251,253);doc.roundedRect(boxX,y-5,boxWidth,height,2,2,'FD')
          doc.setTextColor(49,95,128);doc.setFontSize(9);doc.text(relation.name,boxTextX,y+1)
          y+=6;doc.setTextColor(38,63,87);doc.setFontSize(8.5)
          wrapped.forEach(line=>{doc.text(line,boxTextX,y);y+=5.2})
          y+=7
        })
      } else if(block.type==='code') {
        const label=plainText(block.label);doc.setFontSize(8.5)
        const wrapped=doc.splitTextToSize(plainText(block.content),boxTextWidth)
        const height=13+wrapped.length*5.2
        space(height+4);doc.setDrawColor(205,220,231);doc.setFillColor(248,251,253);doc.roundedRect(boxX,y-5,boxWidth,height,2,2,'FD')
        doc.setTextColor(49,95,128);doc.setFontSize(8);doc.text(label.toUpperCase(),boxTextX,y+1);y+=6
        doc.setTextColor(38,63,87);doc.setFontSize(8.5)
        wrapped.forEach(line=>{doc.text(line,boxTextX,y);y+=5.2})
        y+=8
      } else {
        block.content.split(/\n+/).filter(Boolean).forEach(paragraph=>lines(paragraph,11,questionWidth,questionX,6))
        y+=2
      }
    })
    if(q.questionType==='MCQ'&&Array.isArray(q.options)) q.options.forEach((option,index)=>lines(`${String.fromCharCode(65+index)}. ${option}`,10,questionWidth,questionX,5.5))
  }
  lines(title,16);y+=2;lines(subject,12);y+=2
  lines(`${paper.questions.length} questions | Total marks: ${paper.questions.reduce((n,q)=>n+q.marks,0)}`,10);y+=8
  const marks=[...new Set(paper.questions.map(q=>q.marks))].sort((a,b)=>a-b)
  marks.forEach((mark,index)=>{
    const questions=paper.questions.filter(q=>q.marks===mark)
    space(50);doc.setFillColor(234,244,252);doc.rect(18,y-5,174,10,'F');doc.setTextColor(35,92,134);doc.setFontSize(11)
    doc.text(`Section ${String.fromCharCode(65+index)} - ${mark} ${mark===1?'mark':'marks'}`,21,y+1);y+=14
    for(const q of questions) {
      const blocks=getQuestionBlocks(q)
      space(Math.max(18,estimateQuestionHeight(q,blocks)+2));doc.setTextColor(30,46,60);doc.setFontSize(11)
      doc.text(`${++number}.`,20,y);doc.setFontSize(9);doc.text(bloomLabel(q),190,y,{align:'right'});doc.setFontSize(11);y+=2
      drawQuestion(q,blocks)
      y+=4
    }
    y+=2
  })
  if(y+10>284) page()
  doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('END OF QUESTION PAPER',105,y+5,{align:'center'})
  const count=doc.getNumberOfPages()
  for(let i=1;i<=count;i++){doc.setPage(i);doc.setFontSize(9);doc.setTextColor(100,115,130);doc.text(`Page ${i} of ${count}`,105,288,{align:'center'})}
  return doc
}
export async function downloadPaperPdf(paper) {
  const doc=await createPaperPdf(paper)
  doc.save((plainText(paper.title || 'question-paper').replace(/[^a-z0-9 -]/gi,'').trim().slice(0,80) || 'question-paper')+'.pdf')
}
