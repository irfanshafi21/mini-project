import { plainText, questionBlocks, bloomLabel } from './paperText.js'
import notoSansUrl from './assets/NotoSans-Regular.ttf?url'

const pdfText = value => plainText(value).replace(/[−–—]/g, '-')

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
  let bodyFont='helvetica'
  let embeddedFont = fontBase64
  if (!embeddedFont) {
    try { embeddedFont = await fontData() } catch { /* Keep PDF export available if the optional local font cannot load. */ }
  }
  if (embeddedFont) {
    try {
      doc.addFileToVFS('NotoSans.ttf', embeddedFont)
      doc.addFont('NotoSans.ttf', 'NotoSans', 'normal')
      doc.setFont('NotoSans', 'normal')
      bodyFont='NotoSans'
    } catch {
      doc.setFont('helvetica', 'normal')
    }
  } else {
    doc.setFont('helvetica', 'normal')
  }
  const title=pdfText(paper.title || 'Question paper'), subject=pdfText((paper.subject || 'GENERAL').replaceAll('_',' '))
  doc.setProperties({title,subject,creator:'Question Bank'})
  let y=25,number=0
  const questionX=34,questionWidth=136,boxX=34,boxWidth=148,boxTextX=38,boxTextWidth=140
  function page() {doc.addPage();y=20;doc.setFont(bodyFont,'normal');doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('QUESTION PAPER - CONTINUED',20,y);y+=12}
  function space(height) {if(y+height>275)page()}
  function lines(text,size=11,width=170,x=20,leading=5.8) {
    doc.setFont(bodyFont,'normal');doc.setFontSize(size);doc.setTextColor(30,46,60)
    for(const line of doc.splitTextToSize(pdfText(text),width)) {space(leading);doc.text(line,x,y);y+=leading}
  }
  function getQuestionBlocks(q) {
    return questionBlocks(q.text || `${q.topic || ''} - ${q.subtopic || ''}`)
  }
  function schemaCardLayout(relation) {
    const available=boxWidth-8,gap=1.5
    doc.setFont(bodyFont,'normal');doc.setFontSize(8.5)
    const chips=relation.columns.map(text=>{
      const wrapped=doc.splitTextToSize(pdfText(text),available-5)
      const width=Math.min(available,Math.max(10,...wrapped.map(line=>doc.getTextWidth(line)+5)))
      return {wrapped,width,height:Math.max(7,wrapped.length*3.7+3)}
    })
    const rows=[];let row=[],rowWidth=0
    chips.forEach(chip=>{
      if(row.length&&rowWidth+gap+chip.width>available) {rows.push(row);row=[];rowWidth=0}
      row.push(chip);rowWidth+=chip.width+(row.length>1?gap:0)
    })
    if(row.length)rows.push(row)
    const rowHeights=rows.map(items=>Math.max(...items.map(item=>item.height)))
    return {rows,rowHeights,height:10+rowHeights.reduce((sum,item)=>sum+item+1.5,0)}
  }
  function estimateQuestionHeight(q,blocks) {
    let height=6
    blocks.forEach(block=>{
      if(block.type==='schema') {
        block.relations.forEach(relation=>{
          height+=schemaCardLayout(relation).height+3
        })
      } else if(block.type==='code') {
        doc.setFont('courier','normal');doc.setFontSize(8.5)
        const wrapped=doc.splitTextToSize(pdfText(block.content),boxTextWidth)
        height+=14+wrapped.length*5.2
      } else {
        doc.setFontSize(11)
        block.content.split(/\n+/).filter(Boolean).forEach(paragraph=>{
          height+=doc.splitTextToSize(pdfText(paragraph),questionWidth).length*6+2
        })
      }
    })
    if(q.questionType==='MCQ'&&Array.isArray(q.options)) {
      doc.setFontSize(10)
      q.options.forEach((option,index)=>{height+=doc.splitTextToSize(`${String.fromCharCode(65+index)}. ${pdfText(option)}`,questionWidth).length*5.5})
    }
    return height+4
  }
  function drawQuestion(q,blocks) {
    blocks.forEach(block=>{
      if(block.type==='schema') {
        block.relations.forEach(relation=>{
          const layout=schemaCardLayout(relation),height=layout.height
          space(height+6);const top=y-5;doc.setDrawColor(217,229,237);doc.setFillColor(248,251,253);doc.roundedRect(boxX,top,boxWidth,height,2,2,'FD')
          doc.setFillColor(237,245,250);doc.roundedRect(boxX+0.3,top+0.3,boxWidth-0.6,7,1.7,1.7,'F')
          doc.setDrawColor(217,229,237);doc.setLineWidth(0.25);doc.line(boxX,top+7.2,boxX+boxWidth,top+7.2)
          doc.setFont('helvetica','bold');doc.setTextColor(49,95,128);doc.setFontSize(9);doc.text(pdfText(relation.name),boxTextX,top+5)
          let rowTop=top+9
          layout.rows.forEach((row,index)=>{
            let chipX=boxTextX
            row.forEach(chip=>{
              doc.setFillColor(255,255,255);doc.setDrawColor(224,232,238);doc.roundedRect(chipX,rowTop,chip.width,chip.height,1.5,1.5,'FD')
              doc.setFont(bodyFont,'normal');doc.setTextColor(52,79,98);doc.setFontSize(8.5)
              chip.wrapped.forEach((line,lineIndex)=>doc.text(line,chipX+2.5,rowTop+3.7+lineIndex*3.7))
              chipX+=chip.width+1.5
            })
            rowTop+=layout.rowHeights[index]+1.5
          })
          y=top+height+8
        })
      } else if(block.type==='code') {
        const label=pdfText(block.label);doc.setFont('courier','normal');doc.setFontSize(8.5)
        const wrapped=doc.splitTextToSize(pdfText(block.content),boxTextWidth)
        const height=11+wrapped.length*5.2
        space(height+6);const top=y-5;doc.setDrawColor(217,229,237);doc.setFillColor(248,251,253);doc.roundedRect(boxX,top,boxWidth,height,2,2,'FD')
        doc.setFillColor(237,245,250);doc.roundedRect(boxX+0.3,top+0.3,boxWidth-0.6,7,1.7,1.7,'F')
        doc.setDrawColor(217,229,237);doc.setLineWidth(0.25);doc.line(boxX,top+7.2,boxX+boxWidth,top+7.2)
        doc.setFont('helvetica','bold');doc.setTextColor(49,95,128);doc.setFontSize(8);doc.text(label.toUpperCase(),boxTextX,top+5)
        doc.setFont('courier','normal');doc.setTextColor(38,63,87);doc.setFontSize(8.5)
        wrapped.forEach((line,index)=>doc.text(line,boxTextX,top+12+index*5.2))
        y=top+height+6
      } else {
        block.content.split(/\n+/).filter(Boolean).forEach(paragraph=>lines(paragraph,11,questionWidth,questionX,6))
        y+=2
      }
    })
    if(q.questionType==='MCQ'&&Array.isArray(q.options)) q.options.forEach((option,index)=>lines(`${String.fromCharCode(65+index)}. ${option}`,10,questionWidth,questionX,5.5))
  }
  doc.setFont('times','normal');doc.setFontSize(20);doc.setTextColor(30,46,60)
  doc.text(subject,105,y,{align:'center'});y+=9
  doc.setFont(bodyFont,'normal');doc.setFontSize(10);doc.setTextColor(82,109,126)
  doc.text(`${paper.questions.length} questions | ${paper.questions.reduce((n,q)=>n+q.marks,0)} marks`,105,y,{align:'center'});y+=7
  doc.setDrawColor(82,110,130);doc.setLineWidth(0.5);doc.line(18,y,192,y);y+=11
  const marks=[...new Set(paper.questions.map(q=>q.marks))].sort((a,b)=>a-b)
  marks.forEach((mark,index)=>{
    const questions=paper.questions.filter(q=>q.marks===mark)
    space(50);doc.setFillColor(241,247,252);doc.roundedRect(18,y-5,174,11,2,2,'F');doc.setDrawColor(92,154,197);doc.setLineWidth(1);doc.line(18.5,y-4,18.5,y+5)
    doc.setTextColor(49,95,128);doc.setFontSize(11)
    doc.text(`Section ${String.fromCharCode(65+index)} - ${mark} ${mark===1?'mark':'marks'}`,22,y+1);y+=14
    for(const q of questions) {
      const blocks=getQuestionBlocks(q)
      space(Math.max(18,estimateQuestionHeight(q,blocks)+2));doc.setFont(bodyFont,'normal');doc.setTextColor(30,46,60);doc.setFontSize(11)
      doc.text(`${++number}.`,29,y,{align:'right'});doc.setFontSize(8);doc.setTextColor(82,109,126);doc.text(`CO${q.unit || '—'}`,177,y,{align:'center'});doc.setFontSize(9);doc.setTextColor(49,95,128);doc.text(bloomLabel(q),190,y,{align:'right'});doc.setFontSize(11);doc.setTextColor(30,46,60);y+=2
      drawQuestion(q,blocks)
      y+=4
    }
    y+=2
  })
  if(y+10>284) page()
  doc.setFont(bodyFont,'normal');doc.setFontSize(9);doc.setTextColor(90,110,130);doc.text('END OF QUESTION PAPER',105,y+5,{align:'center'})
  const count=doc.getNumberOfPages()
  for(let i=1;i<=count;i++){doc.setPage(i);doc.setFont(bodyFont,'normal');doc.setFontSize(9);doc.setTextColor(100,115,130);doc.text(`Page ${i} of ${count}`,105,288,{align:'center'})}
  return doc
}
export async function downloadPaperPdf(paper) {
  const doc=await createPaperPdf(paper)
  doc.save((pdfText(paper.title || 'question-paper').replace(/[^a-z0-9 -]/gi,'').trim().slice(0,80) || 'question-paper')+'.pdf')
}
