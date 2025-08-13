/* ===== Helpers ===== */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function showScreen(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
function uid(){ return 'u_'+Math.random().toString(36).slice(2,9); }
function norm(s){return (s||'').replace(/\s/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toUpperCase();}

/* ===== Users ===== */
let users = JSON.parse(localStorage.getItem('mg_users')||'[]');
let activeId = localStorage.getItem('mg_active')||null;
function computeAge(dob){ if(!dob) return 0; const d=new Date(dob), n=new Date(); let a=n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) a--; return Math.max(0,a); }
function renderUsers(){
  const box = $('#userList');
  box.innerHTML = users.map(u=>`
    <div class="card">
      <div class="row space-between">
        <div>
          <div style="font-weight:800">${u.name||"بدون اسم"}</div>
          <div class="help">${u.country||"—"} • ${u.age?u.age+" سنة":"—"} • ${u.difficulty||"—"}</div>
        </div>
        <div class="row">
          <button class="btn-primary" onclick="enterAs('${u.id}')">دخول</button>
          <button class="btn" onclick="delUser('${u.id}')">حذف</button>
        </div>
      </div>
    </div>
  `).join('');
}
function enterAs(id){ activeId=id; localStorage.setItem('mg_active',id); showScreen('games'); }
function delUser(id){ users=users.filter(u=>u.id!==id); localStorage.setItem('mg_users',JSON.stringify(users)); renderUsers(); }
function goPrefs(){ showScreen('prefs'); buildTopics(); }
const ALL_TOPICS=["ألغاز ذكاء","ثقافة عامة","تاريخ","جغرافيا","علوم","تكنولوجيا","رياضة","فن","موسيقى","أدب","أفلام ومسلسلات","أعمال","طعام","سفر","طبيعة"];
function buildTopics(){
  const host = $('#topics'); host.innerHTML='';
  ALL_TOPICS.forEach(t=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=t; b.onclick=()=>b.classList.toggle('active'); host.appendChild(b); });
}
function saveUser(){
  const name=$('#name').value.trim();
  const country=$('#countryInput').value.trim();
  const dob=$('#dob').value; const age=computeAge(dob);
  const difficulty=$('#difficulty').value;
  const topics=Array.from($('#topics').querySelectorAll('.pill.active')).map(x=>x.textContent);
  const u={id:uid(),name,country,dob,age,difficulty,topics,games:{}};
  users.push(u); localStorage.setItem('mg_users',JSON.stringify(users)); renderUsers(); showScreen('userSelect');
}

/* ===== Data ===== */
let puzzles = {};
let countries = [];
fetch('puzzles.json').then(r=>r.json()).then(d=>puzzles=d||{});
fetch('countries.json').then(r=>r.json()).then(list=>{
  countries=list||[]; const dl=$('#countryList'); if(dl) dl.innerHTML=countries.map(c=>`<option value="${c}">`).join('');
});

/* ===== ZenFlow Crossword ===== */
let cwSol = [];                 // 2D array
let cwDir = 'across';           // or 'down'
let cwSize = 9;                 // 9 or 5
let gridCells = [];             // [r][c] -> {cell,input}
let activeWord = null;          // {dir,row,col,len,cells[],idx}
let lastTapTime = 0;
let currentClueTab = 'across';
let currentClueIndex = 0;
let pencilMode = false;
let coins = 5; $('#coins') && ($('#coins').textContent = coins);

function showCrossword(){ loadCrosswordMode('standard'); showScreen('scrCrossword'); startTimer(); }

function loadCrosswordMode(mode){
  const btn9=$('#btn9'), btn5=$('#btn5');
  if(mode==='mini'){ btn5.classList.add('active'); btn9.classList.remove('active'); }
  else{ btn9.classList.add('active'); btn5.classList.remove('active'); }
  const set = puzzles.crossword || [];
  const p = (mode==='mini' ? set.find(x=>x.size===5) : set.find(x=>x.size===9)) || set[0];
  if(!p){ alert('لا توجد شبكة متقاطعة'); return; }
  $('#cwTitle').textContent = p.title || 'كلمات متقاطعة';
  cwSol  = (p.solution||[]).map(r=>r.split(''));
  cwSize = cwSol.length;
  buildGrid(p);
  buildClues(p);
  currentClueTab = 'across'; switchClueTab('across');
  if((p.clues?.across||[]).length){ selectClue('across',0); }
}

function buildGrid(p){
  const grid = $('#cwGrid'); grid.innerHTML=''; gridCells=[];
  grid.style.gridTemplateColumns = `repeat(${cwSize}, ${cwSize===5?50:42}px)`;
  const numMap = new Map();
  (p.clues?.across||[]).forEach(c=>numMap.set(`${c.row},${c.col}`,c.num));
  (p.clues?.down||[]).forEach(c=>{ if(!numMap.has(`${c.row},${c.col}`)) numMap.set(`${c.row},${c.col}`,c.num); });

  for(let r=0;r<cwSize;r++){
    gridCells[r]=[];
    for(let c=0;c<cwSize;c++){
      const sol = cwSol[r]?.[c] || '#';
      const cell = document.createElement('div');
      if(sol==='#'){
        cell.className='cw-cell cw-black';
        grid.appendChild(cell);
        gridCells[r][c]={cell,input:null};
        continue;
      }
      cell.className='cw-cell';
      const num = numMap.get(`${r},${c}`);
      if(num){ const s=document.createElement('span'); s.className='cw-num'; s.textContent=num; cell.appendChild(s); }
      const inp=document.createElement('input');
      inp.className='cw-input'; if(pencilMode) inp.classList.add('pencil');
      inp.maxLength=1; inp.autocomplete='off'; inp.autocapitalize='none'; inp.spellcheck=false; inp.inputMode='text';
      inp.addEventListener('input',e=>{
        e.target.value=e.target.value.replace(/\s/g,'');
        moveCaret(e.target, +1);
      });
      inp.addEventListener('keydown',e=>{
        if(e.key==='Backspace' && !e.target.value) moveCaret(e.target,-1,true);
      });
      cell.addEventListener('click',()=>onCellTap(r,c));
      cell.appendChild(inp);
      grid.appendChild(cell);
      gridCells[r][c]={cell,input:inp};
    }
  }
  activeWord=null; paintActive(null);
}

function buildClues(p){
  const aBox = $('#cwAcross'), dBox=$('#cwDown');
  aBox.innerHTML = (p.clues?.across||[]).map((it,i)=> `<li class="clue-item" onclick="selectClue('across',${i})"><b>${it.num}</b> — ${it.clue} (${it.answer.length})</li>`).join('');
  dBox.innerHTML = (p.clues?.down||[]).map((it,i)=>   `<li class="clue-item" onclick="selectClue('down',${i})"><b>${it.num}</b> — ${it.clue} (${it.answer.length})</li>`).join('');
}

function onCellTap(r,c){
  if(!gridCells[r][c].input) return;
  const t=Date.now();
  if(t-lastTapTime<300) toggleDir();
  lastTapTime=t;
  setActiveWordFromCell(r,c);
}

function toggleDir(){
  cwDir = (cwDir==='across')?'down':'across';
  if(activeWord) setActiveWordFromCell(activeWord.row, activeWord.col);
}

function setActiveWordFromCell(r,c){
  if(!gridCells[r][c].input) return;
  const start = findStart(r,c,cwDir);
  const cells = collectCells(start.r,start.c,cwDir);
  activeWord = {dir:cwDir,row:start.r,col:start.c,len:cells.length,cells};
  paintActive(activeWord);
  activeWord.cells[0]?.input?.focus();
}

function findStart(r,c,dir){
  if(dir==='across'){ while(c>0 && cwSol[r][c-1]!=='#') c--; return {r,c}; }
  else{ while(r>0 && cwSol[r-1][c]!=='#') r--; return {r,c}; }
}

function collectCells(r,c,dir){
  const list=[];
  if(dir==='across'){ for(let cc=c; cc<cwSize && cwSol[r][cc]!=='#'; cc++) list.push({r,c:cc,cell:gridCells[r][cc].cell,input:gridCells[r][cc].input}); }
  else{ for(let rr=r; rr<cwSize && cwSol[rr][c]!=='#'; rr++) list.push({r:rr,c,cell:gridCells[rr][c].cell,input:gridCells[rr][c].input}); }
  return list;
}

function paintActive(word){
  for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++) gridCells[r][c].cell.classList.remove('cw-active');
  if(!word) return;
  word.cells.forEach(x=>x.cell.classList.add('cw-active'));
}

function moveCaret(target, step, clearPrev=false){
  if(!activeWord) return;
  const idx = activeWord.cells.findIndex(x=>x.input===target);
  if(idx===-1) return;
  const next = activeWord.cells[idx+step];
  if(next && next.input){
    if(step<0 && clearPrev){ next.input.value=''; }
    next.input.focus();
  }
}

/* Clue Dock */
function switchClueTab(tab){
  currentClueTab = tab;
  $('#tabAcross').classList.toggle('active',tab==='across');
  $('#tabDown').classList.toggle('active',tab==='down');
  $('#cwAcross').style.display = tab==='across'?'block':'none';
  $('#cwDown').style.display   = tab==='down'  ?'block':'none';
}
function selectClue(tab, idx){
  const p = puzzles.crossword && puzzles.crossword.find(x=>x.size===cwSize) || puzzles.crossword[0];
  const list = p?.clues?.[tab] || []; if(!list.length) return;
  const cl = list[(idx%list.length+list.length)%list.length];
  currentClueIndex = idx; currentClueTab = tab; cwDir = tab==='across'?'across':'down';
  setActiveWordFromCell(cl.row, cl.col);
  const listEl = tab==='across'?$('#cwAcross'):$('#cwDown');
  listEl.querySelectorAll('li').forEach((li,i)=> li.style.background = (i===((idx%list.length+list.length)%list.length))?'rgba(0,188,212,.22)':'transparent');
}
function nextClue(){ const p = puzzles.crossword.find(x=>x.size===cwSize)||puzzles.crossword[0]; const list=p?.clues?.[currentClueTab]||[]; if(!list.length) return; selectClue(currentClueTab,currentClueIndex+1); }
function prevClue(){ const p = puzzles.crossword.find(x=>x.size===cwSize)||puzzles.crossword[0]; const list=p?.clues?.[currentClueTab]||[]; if(!list.length) return; selectClue(currentClueTab,currentClueIndex-1); }

/* Checks */
function checkLetter(){
  const el = document.activeElement;
  if(el && el.classList.contains('cw-input')){
    const pos = findInputPos(el);
    if(!pos) return;
    const g = norm(cwSol[pos.r][pos.c]); const v = norm(el.value);
    markCell(pos.r,pos.c, v===g);
  }
}
function checkWord(){
  if(!activeWord) return;
  let ok=true;
  activeWord.cells.forEach(x=>{
    const g=norm(cwSol[x.r][x.c]), v=norm(x.input.value);
    markCell(x.r,x.c, v===g); if(v!==g) ok=false;
  });
}
function checkGrid(){
  for(let r=0;r<cwSize;r++){
    for(let c=0;c<cwSize;c++){
      const ref = gridCells[r][c]; const sol=cwSol[r]?.[c]||'#';
      if(sol==='#' || !ref.input) continue;
      const v=norm(ref.input.value), g=norm(sol);
      markCell(r,c, v===g);
    }
  }
}
function markCell(r,c, isCorrect){
  const cell = gridCells[r][c].cell;
  cell.classList.remove('cw-correct','cw-wrong');
  if(gridCells[r][c].input?.classList.contains('pencil')) return; // لا نعلّم في وضع الرصاص
  cell.classList.add(isCorrect?'cw-correct':'cw-wrong');
}
function findInputPos(input){
  for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++) if(gridCells[r][c].input===input) return {r,c};
  return null;
}

/* Pencil + Reveal */
function togglePencil(){
  pencilMode = !pencilMode;
  $('#pencilBtn').classList.toggle('btn-primary',pencilMode);
  // جميع الحقول الحالية تأخذ/تزيل فئة pencil
  for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++){
    const ip=gridCells[r][c].input; if(!ip) continue;
    ip.classList.toggle('pencil', pencilMode);
  }
}
function revealLetter(){
  if(!activeWord) return;
  if(coins<=0){ alert('لا توجد عملات كافية'); return; }
  const slot = activeWord.cells.find(x=>!x.input.value);
  if(!slot){ alert('لا توجد خانات فارغة في هذه الكلمة'); return; }
  slot.input.value = cwSol[slot.r][slot.c];
  coins--; $('#coins').textContent = coins;
}

/* Timer (بسيط) */
let t0=null, tInt=null;
function startTimer(){
  clearInterval(tInt); t0=Date.now();
  tInt=setInterval(()=>{
    const s = Math.floor((Date.now()-t0)/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    const el=$('#timer'); if(el) el.textContent = `${mm}:${ss}`;
  },1000);
}

/* ===== Other mini games (placeholders) ===== */
function showLogic(){ const q=puzzles.logic?.[0]; if(!q){alert('لا توجد ألغاز منطقية');return;} $('#logicQ').textContent=q.question; $('#logicA').value=''; $('#logicMsg').textContent=''; showScreen('scrLogic'); }
function checkLogic(){ const q=puzzles.logic?.[0]; const a=$('#logicA').value.trim(); $('#logicMsg').textContent = norm(a)===norm(q.answer)?'صحيح ✅':'غير صحيح ❌'; }

function showWordsearch(){ const w=puzzles.wordsearch?.[0]; if(!w){alert('لا توجد بيانات كلمة السر');return;} const host=$('#wsGrid'); host.innerHTML=''; w.grid.forEach(row=>row.forEach(ch=>{const d=document.createElement('div'); d.className='wcell'; d.textContent=ch; host.appendChild(d);})); const wordsBox=$('#wsWords'); wordsBox.innerHTML=''; w.words.forEach(word=>{const b=document.createElement('button'); b.className='btn'; b.textContent=word; b.onclick=()=> b.classList.toggle('btn-primary'); wordsBox.appendChild(b);}); showScreen('scrWordsearch'); }

function showAnagram(){ const a=puzzles.anagram?.[0]; if(!a){alert('لا توجد ألغاز ترتيب');return;} const host=$('#anaLetters'); host.innerHTML=''; a.letters.forEach(ch=>{const b=document.createElement('button'); b.className='btn'; b.textContent=ch; host.appendChild(b);}); $('#anaInput').value=''; $('#anaMsg').textContent=''; showScreen('scrAnagram'); }
function checkAnagram(){ const a=puzzles.anagram?.[0]; const v=$('#anaInput').value.trim(); $('#anaMsg').textContent = norm(v)===norm(a.answer)?'صحيح ✅':'غير صحيح ❌'; }

let spdT=0, spdIdx=0, spdTimer=null, spdScore=0;
function showSpeed(){ $('#spdTime').textContent='30'; $('#spdScore').textContent='0'; $('#spdQ').textContent=''; $('#spdA').value=''; showScreen('scrSpeed'); }
function startSpeed(){ if(!puzzles.speed?.length){alert('لا توجد أسئلة سرعة');return;} spdIdx=0; spdScore=0; spdT=30; $('#spdTime').textContent=spdT; nextSpdQ(); clearInterval(spdTimer); spdTimer=setInterval(()=>{spdT--; $('#spdTime').textContent=spdT; if(spdT<=0){clearInterval(spdTimer);} },1000); }
function nextSpdQ(){ const q=puzzles.speed?.[spdIdx%puzzles.speed.length]; $('#spdQ').textContent=q.question; $('#spdA').value=''; }
function checkSpeed(){ if(spdT<=0) return; const q=puzzles.speed?.[spdIdx%puzzles.speed.length]; const v=$('#spdA').value.trim(); if(norm(v)===norm(q.answer)){ spdScore++; $('#spdScore').textContent=spdScore; } spdIdx++; nextSpdQ(); }

function showQuiz(){ const q=puzzles.quiz?.[0]; if(!q){alert('لا توجد أسئلة');return;} $('#quizQ').textContent=q.question; const box=$('#quizOptions'); box.innerHTML=''; q.options.forEach(opt=>{const div=document.createElement('div'); div.className='option'; div.textContent=opt; div.onclick=()=>{ box.querySelectorAll('.option').forEach(o=>o.classList.remove('correct','wrong')); div.classList.add(norm(opt)===norm(q.answer)?'correct':'wrong'); }; box.appendChild(div);}); showScreen('scrQuiz'); }

function showImage(){ const p=puzzles.image?.[0]; if(!p){alert('لا توجد صور');return;} $('#imgPic').src=p.image||'assets/placeholder.jpg'; $('#imgA').value=''; $('#imgMsg').textContent=''; showScreen('scrImage'); }
function checkImage(){ const p=puzzles.image?.[0]; const v=$('#imgA').value.trim(); $('#imgMsg').textContent = norm(v)===norm(p.answer)?'صحيح ✅':'غير صحيح ❌'; }

/* ===== Boot ===== */
renderUsers();
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); } // إن وجد sw.js
// محفظة
function getWallet(){ return JSON.parse(localStorage.getItem('mg_wallet')||'{"coins":0,"gems":0}'); }
function setWallet(w){ localStorage.setItem('mg_wallet', JSON.stringify(w)); }
function addCoins(n){ const w=getWallet(); w.coins+=n; setWallet(w); }
function spendCoins(n){ const w=getWallet(); if(w.coins<n) return false; w.coins-=n; setWallet(w); return true; }
function addGems(n){ const w=getWallet(); w.gems+=n; setWallet(w); }
function spendGems(n){ const w=getWallet(); if(w.gems<n) return false; w.gems-=n; setWallet(w); return true; }

// جائزة نهاية لغز
function rewardOnComplete({mode="9x9", timeSec=0, hints=0}){
  let base = mode==="mini"? 20 : 50;
  if(timeSec < 90) base += 10;
  if(hints===0) base += 10;
  addCoins(base);
}

// درع السلسلة
function useStreakShield(){
  const inv = JSON.parse(localStorage.getItem('mg_inv')||'{"shields":0}');
  if(inv.shields>0){ inv.shields--; localStorage.setItem('mg_inv', JSON.stringify(inv)); return true; }
  return false;
}
function buyStreakShield(){
  if(spendGems(1) || spendCoins(40)){
    const inv = JSON.parse(localStorage.getItem('mg_inv')||'{"shields":0}');
    inv.shields++; localStorage.setItem('mg_inv', JSON.stringify(inv));
    return true;
  } return false;
}
/* ===== Themes (خفيف) ===== */
let themes = [], currentThemeId = null;

fetch('themes.json')
  .then(r=>r.json())
  .then(t=>{
    themes = t.themes||[];
    const saved = localStorage.getItem('mg_theme') || t.default_theme_id || (themes[0]?.id);
    applyTheme(saved);
  })
  .catch(()=>{ /* إبقاء الثيم الافتراضي من CSS لو فشل التحميل */ });

function applyTheme(id){
  const th = themes.find(x=>x.id===id); if(!th) return;
  currentThemeId = id;
  const root = document.documentElement;
  Object.entries(th.vars).forEach(([k,v])=> root.style.setProperty(k, v));
  localStorage.setItem('mg_theme', id);
}

function cycleTheme(){
  if(!themes.length) return;
  const idx = themes.findIndex(t=>t.id===currentThemeId);
  const next = themes[(idx+1)%themes.length];
  applyTheme(next.id);
  // تحديث بسيط بصريًا (اختياري): وميض صغير على العنوان
  const h = document.querySelector('header h1');
  if(h){ h.style.transition='filter .2s'; h.style.filter='brightness(1.4)'; setTimeout(()=>h.style.filter='', 220); }
}
