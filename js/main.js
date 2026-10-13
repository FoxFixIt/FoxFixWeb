/* ===== DANE DIAGNOSTY: ceny według cennika (orientacyjne, „od”), sprawdź i popraw =====
   [id (punkt na modelu 3D, nie zmieniaj), nazwa, cena, czas, opis] */
const D={
 telefon:{n:'Telefon',ic:'i-phone',it:[
  ['ekran','Pęknięty ekran','od 410 zł','1-2 h','Spadł? Zdarza się najlepszym. Wymieniamy szybkę albo cały wyświetlacz, do wyboru kilka opcji.'],
  ['bateria','Bateria','od 240 zł','45 min','Trzyma do obiadu albo puchnie? Nowe ogniwo i znowu cały dzień.'],
  ['port','Gniazdo ładowania','od 200 zł','1 h','Ładuje tylko pod kątem? Często wystarczy czyszczenie, a jak nie, wymieniamy gniazdo.'],
  ['aparat','Aparat i szkiełko','wycena przy ladzie','1 h','Rozmazane zdjęcia albo pęknięte szkiełko obiektywu. Cena zależy od modelu.'],
  ['zalanie','Zalanie','od 400 zł','24-72 h','Kąpiel w toalecie? Nie susz w ryżu, przynieś od razu. Rozbieramy, czyścimy płytę, ratujemy.'],
  ['przyciski','Przyciski','wycena przy ladzie','1 h','Power albo głośność nie klika? Wymieniamy taśmę lub przycisk.'],
  ['glosnik','Głośnik i mikrofon','od 40 zł','15 min','Nikt Cię nie słyszy? Czyszczenie siateczek od ręki, wymiana po wycenie.'],
  ['oprogramowanie','System i dane','od 50 zł','1-3 h','Zawieszki, przeniesienie danych na nowy telefon, kopia zdjęć.']]},
 tablet:{n:'Tablet',ic:'i-tablet',it:[
  ['ekran','Pęknięty ekran','wycena przy ladzie','1-2 dni','Dotyk szaleje albo szyba w pajęczynę. Cena zależy od modelu.'],
  ['bateria','Bateria','wycena przy ladzie','2 h','Tablet umiera po jednej bajce? Nowe ogniwa.'],
  ['port','Gniazdo ładowania','od 200 zł','2 h','Nie ładuje albo kabel wypada. Naprawiamy gniazdo.'],
  ['przyciski','Przyciski','wycena przy ladzie','2 h','Nie włącza się z przycisku? Sprawdzimy.'],
  ['oprogramowanie','System i konto','od 50 zł','1-3 h','Aktualizacje i konfiguracja dla dziecka albo seniora.']]},
 laptop:{n:'Laptop',ic:'i-laptop',it:[
  ['matryca','Matryca','od 590 zł','1-3 dni','Pęknięta, paski, ciemny obraz? Nowa matryca.'],
  ['klawiatura','Klawiatura','wycena przy ladzie','1-2 dni','Brak literki ł albo klawisze się kleją? Wymieniamy.'],
  ['zawiasy','Zawiasy i obudowa','od 350 zł','1-2 dni','Klapa lata, obudowa pęka przy otwieraniu. Pełna rozbiórka i wzmocnienie.'],
  ['chlodzenie','Czyszczenie i pasta','300 zł','24 h','Startuje jak odrzutowiec? Czyszczenie i nowa pasta. Cisza i chłód.'],
  ['bateria','Bateria','wycena przy ladzie','1 dzień','Trzyma pół godziny albo puchnie i unosi klawiaturę? Nowa bateria.'],
  ['zalanie','Zalanie','od 400 zł','2-5 dni','Kawa na klawiaturze? Wyłącz, odwróć, przynieś. Czyścimy płytę.'],
  ['zasilanie','Gniazdo zasilania','od 300 zł','1-2 dni','Ładuje tylko w jednej pozycji? Wymiana gniazda.'],
  ['upgrade','Dysk SSD i RAM','od 150 zł + części','1 h','Druga młodość: SSD i więcej pamięci. System i dane przeniesiemy.'],
  ['dane','Odzyskiwanie danych','od 100 zł','1-3 dni','Laptop nie startuje, a na dysku są zdjęcia? Wyciągamy, co się da.'],
  ['system','Windows i programy','150 zł','3 h','Instalacja, sterowniki, programy, usuwanie wirusów.']]},
 pc:{n:'Komputer',ic:'i-pc',it:[
  ['czyszczenie','Czyszczenie','150 zł','24 h','Kurz to wróg numer jeden. Czyścimy, wymieniamy pastę, mierzymy temperatury.'],
  ['upgrade','Modernizacja komputera','wycena przy ladzie','1 h','Więcej pamięci, szybszy dysk, mocniejsza karta. Dobierzemy części do budżetu.'],
  ['gpu','Karta graficzna i składanie','wycena przy ladzie','1-2 dni','Montaż karty graficznej i składanie zestawów do gier i pracy.'],
  ['zasilacz','Nie startuje','diagnoza 100-150 zł','24 h','Cisza po wciśnięciu power? Zasilacz, płyta, kondensatory. Znajdziemy.'],
  ['dane','Odzyskiwanie danych','wycena przy ladzie','1-3 dni','Dysk padł albo komputer nie startuje? Wyciągamy pliki, ile się da.'],
  ['system','Windows i optymalizacja','150 zł','3 h','Czysty system, sterowniki, BIOS i porządek w autostarcie.']]},
 zegarek:{n:'Smartwatch',ic:'i-watch',it:[
  ['ekran','Pęknięte szkiełko','wycena przy ladzie','1-2 dni','Uderzenie o framugę? Wymieniamy szkło albo wyświetlacz.'],
  ['bateria','Bateria','wycena przy ladzie','1 dzień','Nie dożywa do wieczora albo puchnie. Nowe ogniwo.'],
  ['pasek','Pasek','od ręki','od ręki','Pęknięty albo nudny? Paski mamy na miejscu.'],
  ['koronka','Przyciski i koronka','wycena przy ladzie','1-2 dni','Koronka się zacina albo przycisk nie klika. Czyścimy lub wymieniamy.'],
  ['oprogramowanie','Parowanie','od 50 zł','1 h','Nie łączy się z telefonem? Reset, aktualizacja, parowanie.']]}
};
const $=s=>document.querySelector(s),L='ABCDEFGHIJKL';
const tabs=$('#tabs'),list=$('#issues'),stage=$('#stage');
let dev='telefon',sel=null,studio=null;
const letter=id=>L[D[dev].it.findIndex(i=>i[0]===id)];
const item=id=>D[dev].it.find(i=>i[0]===id);

Object.entries(D).forEach(([k,v])=>{
 const b=document.createElement('button');b.role='tab';b.type='button';b.dataset.dev=k;b.setAttribute('aria-selected',k===dev);
 b.innerHTML=`<svg aria-hidden="true"><use href="#${v.ic}"/></svg>${v.n}`;b.onclick=()=>setDev(k);tabs.append(b);
});
function callout(id){if(!id)return;$('#co-l').textContent=letter(id);$('#co-t').textContent=item(id)[1]}
function pick(id){
 sel=id;const it=item(id);
 list.querySelectorAll('.issue').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===id));
 $('#k-iss').textContent=it[1];$('#k-desc').textContent=it[4];
 $('#k-sms').href='sms:+48572571704?body='+encodeURIComponent(`Hej FoxFix! ${D[dev].n}, ${it[1].toLowerCase()}. Kiedy mogę wpaść?`);
 callout(id);studio?.setIssue(id);boot();
}
function hover(id){const s=id||sel;callout(s);if(studio&&studio.issue!==s)studio.setIssue(s)}
function setDev(k){
 dev=k;sel=null;
 tabs.querySelectorAll('button').forEach(t=>t.setAttribute('aria-selected',t.dataset.dev===k));
 $('#loader-ico').setAttribute('href','#'+D[k].ic);
 list.innerHTML='';
 D[k].it.forEach(([id,n],i)=>{
  const li=document.createElement('li');
  li.innerHTML=`<button class="issue" type="button" data-id="${id}" aria-pressed="false"><span class="l">${L[i]}</span>${n}</button>`;
  const b=li.firstChild;b.onclick=()=>pick(id);b.onmouseenter=b.onfocus=()=>hover(id);b.onmouseleave=b.onblur=()=>hover(null);
  list.append(li);
 });
 $('#k-iss').textContent='Wybierz usterkę';$('#k-desc').textContent='Kliknij literę na modelu albo pozycję z listy powyżej.';
 studio?.setDevice(k);
}
document.querySelectorAll('[data-go]').forEach(a=>a.addEventListener('click',()=>setDev(a.dataset.go)));
setDev(dev);

/* ===== 3D: three.js wczytuje się dopiero, gdy diagnosta jest blisko ekranu ===== */
let booting=false;
function boot(){
 if(booting)return;booting=true;
 const ok=(()=>{try{return !!document.createElement('canvas').getContext('webgl2')}catch(e){return false}})();
 if(!ok){$('#loader span').textContent='Ta przeglądarka nie pokaże 3D, lista obok działa normalnie';return}
 import('./fox3d.js').then(m=>document.fonts.ready.then(()=>{
  studio=m.createStudio({stage,canvas:$('#gl'),pinsEl:$('#pins'),svgEl:$('#leader'),callout:$('#callout'),
   onPick:pick,onHover:hover,letters:(id,full)=>full?`${letter(id)}: ${item(id)[1]}`:letter(id)});
  studio.setDevice(dev);if(sel)studio.setIssue(sel);stage.classList.add('ready');
 })).catch(e=>{console.warn(e);$('#loader span').textContent='Nie udało się wczytać modelu 3D'});
}
new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){o.disconnect();boot()}},{rootMargin:'400px'}).observe(stage);

/* ===== obramowanie nawigacji po przewinięciu ===== */
const sent=document.createElement('div');sent.style.cssText='position:absolute;top:8px;height:1px;width:1px';document.body.prepend(sent);
new IntersectionObserver(([e])=>$('#top').classList.toggle('scrolled',!e.isIntersecting)).observe(sent);

/* ===== klik w status: przewiń do godzin i podświetl ramkę ===== */
$('#status').addEventListener('click',e=>{e.preventDefault();const b=$('#godziny');b.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
 b.classList.remove('flash');setTimeout(()=>{void b.offsetWidth;b.classList.add('flash')},450);});

/* ===== MAPA: ładowana dopiero po kliknięciu (bez ciasteczek Google na starcie) ===== */
$('#map-load').addEventListener('click',()=>{const f=document.createElement('iframe');f.title='Mapa dojazdu do FoxFix, ul. Lubelska 21, Kurów';f.src='https://www.google.com/maps?q=FoxFix%2C+Lubelska+21%2C+24-170+Kur%C3%B3w&z=16&output=embed';f.referrerPolicy='no-referrer-when-downgrade';$('#map-ph').replaceWith(f)});

/* ===== HERO: uszkodzenia pojawiają się i znikają ===== */
(()=>{
 const F=window.FX_DEV;if(!F||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const svg=$('#dev .dmg'),done=$('#done'),txt=done.lastElementChild,wipe=svg.querySelector('#wipe rect'),scan=svg.querySelector('.scan');
 const H=+svg.viewBox.baseVal.height,sh=+scan.getAttribute('height'),sg=svg.querySelector('.scan-g');let x,y,w,h;
 let i=0,t=[],raf=0;
 const at=(ms,f)=>t.push(setTimeout(f,ms));
 function fix(kb){[x,y,w,h]=kb?F.kb:F.box;kb?sg.removeAttribute('clip-path'):sg.setAttribute('clip-path','url(#scr)');scan.setAttribute('x',x-20);scan.setAttribute('width',w+40);const t0=performance.now();scan.style.opacity=1;
  const step=now=>{const p=Math.min((now-t0)/900,1),e=1-Math.pow(1-p,3),yy=y+e*(h+sh)-sh;
   wipe.setAttribute('y',yy+sh/2);wipe.setAttribute('height',Math.max(H-yy,0));scan.setAttribute('y',yy);
   if(p<1)raf=requestAnimationFrame(step);else scan.style.opacity=0};raf=requestAnimationFrame(step)}
 function run(){
  const [k,msg]=F.sc[i++%F.sc.length],g=svg.querySelector('.g-'+k);
  wipe.setAttribute('y',0);wipe.setAttribute('height',H);g.classList.add('on');
  at(2600,()=>fix(k==='kbwater'));
  at(3500,()=>{g.classList.remove('on');txt.textContent=msg;done.classList.add('on')});
  at(5000,()=>done.classList.remove('on'));
  at(6200,run);
 }
 let vis=true;new IntersectionObserver(([e])=>{if(e.isIntersecting&&!vis){vis=true;run()}else if(!e.isIntersecting&&vis){vis=false;t.forEach(clearTimeout);t=[];cancelAnimationFrame(raf)}}).observe(svg);
 setTimeout(run,1400);
})();

/* ===== MAGIA: przedmioty pojawiają się i znikają ===== */
(()=>{
 const w=$('#wand'),imgs=[...w.querySelectorAll(':scope>img')],cap=$('#wand-cap');let i=-1,timer=0;
 for(let k=0;k<10;k++){const sp=document.createElement('i');sp.className='spark';const a=k/10*6.283;sp.style.cssText=`left:50%;top:50%;--x:${Math.cos(a)*120}px;--y:${Math.sin(a)*110}px`;w.append(sp)}
 function next(){const prev=imgs[i];if(prev){prev.classList.remove('on');prev.classList.add('out');setTimeout(()=>prev.classList.remove('out'),600)}
  i=(i+1)%imgs.length;const n=imgs[i];setTimeout(()=>{n.classList.add('on');cap.textContent=n.dataset.n},220);
  w.classList.remove('poof');void w.offsetWidth;w.classList.add('poof')}
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const loop=()=>{clearInterval(timer);if(!reduce)timer=setInterval(next,2200)};
 new IntersectionObserver(([e])=>{if(e.isIntersecting){if(i<0)next();loop()}else clearInterval(timer)}).observe(w);
 w.addEventListener('click',()=>{next();loop()});
})();

/* ===== STATUS OTWARCIA (czas Warszawy) ===== */
(()=>{
 const H={1:[9,19],2:[9,17],3:[9,17],4:[9,17]},N=['','pon','wt','śr','czw','pt','sob','nd'];
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const d={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[p.weekday],t=+p.hour+(+p.minute)/60,s=$('#status'),h=H[d];
 document.querySelectorAll(`#hours [data-d="${Math.min(d,5)}"]`).forEach(x=>x.classList.add('today'));
 if(h&&t>=h[0]&&t<h[1]){s.classList.add('open');s.lastChild.textContent=`Otwarte do ${h[1]}:00`}
 else{let n=d,first=true;do{if(!first||!(h&&t<h[0]))n=n%7+1;first=false}while(!H[n]);s.lastChild.textContent=`Otwieramy ${N[n]} 9:00`}
 $('#yr').textContent=new Date().getFullYear();
})();

/* ===== SEKRET: wpisz „snake” albo kliknij lisa w magicznym kafelku ===== */
let fon=null;
const dlg=$('#fon');
function openFon(){
 if(dlg.open)return;dlg.showModal();
 const ok=(()=>{try{return !!document.createElement('canvas').getContext('webgl2')}catch(e){return false}})();
 if(!ok){$('#fon-load').textContent='Ta przeglądarka nie obsługuje 3D.';return}
 import('./foxfon.js').then(m=>document.fonts.ready.then(()=>{
  let store;try{store=window.localStorage}catch(e){store={getItem(){return null},setItem(){}}}
  fon=m.createFoxFon({canvas:$('#fon-c'),store});$('#fon-load').hidden=true;
 })).catch(()=>{$('#fon-load').textContent='Nie udało się włączyć telefonu.'});
}
function closeFon(){fon?.destroy();fon=null;$('#fon-load').hidden=false;$('#fon-load').textContent='Włączam telefon…'}
$('#egg-btn').onclick=openFon;$('#fon-x').onclick=()=>dlg.close();dlg.addEventListener('close',closeFon);
let buf='';
addEventListener('keydown',e=>{
 if(dlg.open){
  const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',2:'up',8:'down',4:'left',6:'right',Enter:'ok',' ':'ok',5:'ok',Backspace:'back',c:'back',p:'pause',0:'pause'}[e.key];
  if(k&&fon){e.preventDefault();fon.input(k)}return}
 if(/^[a-z0-9]$/i.test(e.key)&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){buf=(buf+e.key.toLowerCase()).slice(-5);if(buf==='snake')openFon()}
});
