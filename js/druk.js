const toast=t=>{const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2200)};
const DPI=300;

/* warianty */
document.querySelectorAll('select[data-variant]').forEach(s=>s.onchange=()=>{
 s.closest('.tpl').querySelectorAll(s.dataset.target).forEach(a=>{[...s.options].forEach(o=>o.value&&a.classList.remove(o.value));if(s.value)a.classList.add(s.value)});
});
document.querySelectorAll('[data-guides]').forEach(b=>b.onclick=()=>b.closest('.tpl').classList.toggle('guides'));
document.querySelectorAll('input[data-ring]').forEach(i=>i.oninput=()=>document.getElementById(i.dataset.ring).textContent=i.value);

/* kody QR */
function qr(){if(!window.qrcode)return setTimeout(qr,300);
 document.querySelectorAll('[data-qr]').forEach(el=>{const q=qrcode(0,'M');q.addData(el.dataset.qr);q.make();el.insertAdjacentHTML('afterbegin',q.createSvgTag({cellSize:4,margin:0,scalable:true}))})}
addEventListener('DOMContentLoaded',qr);

/* eksport: symbole <use> i ścieżki textPath wklejamy do środka (biblioteka klonuje tylko sam projekt) */
function inlineSvg(){
 document.querySelectorAll('.art use').forEach(u=>{
  const sym=document.querySelector(u.getAttribute('href'));if(!sym)return;
  const par=u.parentNode;
  if(par.tagName==='svg'&&par.children.length===1){par.setAttribute('viewBox',sym.getAttribute('viewBox'));par.innerHTML=sym.innerHTML;return}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',sym.getAttribute('viewBox'));svg.innerHTML=sym.innerHTML;u.replaceWith(svg);
 });
}
inlineSvg();

async function render(art,ratio){
 const lib=window.htmlToImage;if(!lib){toast('Biblioteka eksportu jeszcze się ładuje…');throw 0}
 await document.fonts.ready;
 const sec=art.closest('.tpl'),g=sec.classList.contains('guides');sec.classList.remove('guides');
 art.querySelectorAll('[contenteditable]').forEach(e=>e.blur());
 try{return await lib.toPng(art,{pixelRatio:ratio,cacheBust:true,filter:n=>!(n.classList&&n.classList.contains('safe'))})}
 finally{if(g)sec.classList.add('guides')}
}
/* zapis pliku: w podglądzie Claude przez okno zapisu, na stronie zwykłe pobieranie */
let DL=null;if(window.claude&&claude.use)claude.use('downloads').then(d=>DL=d).catch(()=>{});
async function dl(data,name){
 const blob=typeof data==='string'?await (await fetch(data)).blob():data;
 if(DL){try{await DL.save({filename:name,data:blob})}catch(e){if(e&&e.code!=='declined')toast('Nie udało się zapisać pliku')}return}
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),4000);
}
const rgb=c=>(c.match(/\d+/g)||[247,247,246]).slice(0,3).map(Number);
document.querySelectorAll('.tpl').forEach(sec=>{
 const arts=[...sec.querySelectorAll('.art')],id=sec.id.replace('t-','foxfix-'),mm=sec.dataset.mm,ratio=mm?DPI/96:1;
 const name=i=>`${id}${arts.length>1?'-'+(i?'tyl':'przod'):''}`;
 sec.querySelector('[data-png]')?.addEventListener('click',async()=>{
  toast('Renderuję…');
  for(const [i,a] of arts.entries())await dl(await render(a,ratio),name(i)+(mm?'-300dpi':'')+'.png');
  toast('Gotowe');
 });
 sec.querySelector('[data-pdf]')?.addEventListener('click',async()=>{
  if(!window.jspdf)return toast('Biblioteka PDF jeszcze się ładuje…');
  toast('Składam PDF…');const [w,h]=mm.split('x').map(Number),b=document.getElementById('bleed').checked?2:0,W=w+2*b,H=h+2*b,o=W>H?'landscape':'portrait';
  const pdf=new jspdf.jsPDF({unit:'mm',format:[W,H],orientation:o});
  for(const [i,a] of arts.entries()){
   if(i)pdf.addPage([W,H],o);
   if(b){pdf.setFillColor(...rgb(getComputedStyle(a).backgroundColor));pdf.rect(0,0,W,H,'F')}
   pdf.addImage(await render(a,ratio),'PNG',b,b,w,h);
  }
  await dl(pdf.output('blob'),id+(b?'-spad2mm':'')+'.pdf');toast('Gotowe');
 });
 sec.querySelector('[data-print]')?.addEventListener('click',()=>{
  const [w,h]=mm.split('x').map(Number),slot=document.getElementById('print-slot');
  slot.innerHTML='';arts.forEach(a=>slot.append(a.closest('.frame').cloneNode(true)));
  document.getElementById('page-size').textContent=`@page{size:${w}mm ${h}mm;margin:0}`;
  print();
 });
});
