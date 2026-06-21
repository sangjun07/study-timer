// Study Timer with Stats, per-subject colors, 0.1s precision
const STORAGE_KEY = 'study_timer_records';
const subjectsKey = 'study_timer_subjects';
const colorsKey = 'study_timer_colors';
let subjects = JSON.parse(localStorage.getItem(subjectsKey) || '[]');
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let colorMap = JSON.parse(localStorage.getItem(colorsKey) || '{}');
let active = null;

const el = id => document.getElementById(id);

// format seconds (float) to HH:MM:SS.s
const formatHMSDecimal = secFloat => {
  const totalSec = Math.floor(secFloat);
  const h = String(Math.floor(totalSec/3600)).padStart(2,'0');
  const m = String(Math.floor((totalSec%3600)/60)).padStart(2,'0');
  const s = String(totalSec % 60).padStart(2,'0');
  const dec = String(Math.floor((secFloat - Math.floor(secFloat)) * 10));
  return `${h}:${m}:${s}.${dec}`;
};

function saveSubjects(){ localStorage.setItem(subjectsKey, JSON.stringify(subjects)); }
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function saveColors(){ localStorage.setItem(colorsKey, JSON.stringify(colorMap)); }

function safeId(name){ return name.replace(/[^a-zA-Z0-9_-]/g, '_'); }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function escapeAttr(str){ return String(str).replace(/"/g,'&quot;'); }
function cssEscape(str){ return String(str).replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }

// 랜덤 색상 (과목별 고정)
function getColorForSubject(name){
  if(colorMap[name]) return colorMap[name];
  const hue = Math.floor(Math.abs(hashCode(name)) % 360);
  const sat = 65 + Math.floor(Math.abs(hashCode(name + 's')) % 10);
  const light = 45 + Math.floor(Math.abs(hashCode(name + 'l')) % 10);
  const color = `hsl(${hue} ${sat}% ${light}%)`;
  colorMap[name] = color;
  saveColors();
  return color;
}
function hashCode(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

// --- Home 화면 렌더링 ---
function renderSubjects(){
  const container = el('subjects');
  container.innerHTML = '';
  subjects.forEach(name=>{
    const sid = safeId(name);
    const color = getColorForSubject(name);
    const wrapper = document.createElement('div');
    wrapper.className = 'subject-card flex';
    wrapper.style.border = '1px solid rgba(15,23,42,0.06)';
    wrapper.innerHTML = `
      <div style="width:6px;background:${color};"></div>
      <div class="subject-card-inner" style="flex:1;">
        <div>
          <div class="font-semibold text-lg">${escapeHtml(name)}</div>
          <div class="text-sm text-slate-500">누적: <span id="total-${sid}">00:00:00.0</span></div>
        </div>
        <div class="flex items-center gap-2">
          <span id="timer-${sid}" class="timer-mono text-sm w-28 text-center">00:00:00.0</span>
          <button class="start bg-green-500 text-white px-3 py-1 rounded" data-name="${escapeAttr(name)}">공부 시작</button>
          <button class="stop bg-yellow-500 text-white px-3 py-1 rounded" data-name="${escapeAttr(name)}" disabled>정지</button>
          <button class="delete bg-red-500 text-white px-2 py-1 rounded" data-name="${escapeAttr(name)}">삭제</button>
        </div>
      </div>
    `;
    container.appendChild(wrapper);
  });
  updateTotals();
  attachHandlers();
}

function attachHandlers(){
  document.querySelectorAll('.start').forEach(b=> b.onclick = ()=> startTimer(b.dataset.name));
  document.querySelectorAll('.stop').forEach(b=> b.onclick = ()=> stopTimer(b.dataset.name));
  document.querySelectorAll('.delete').forEach(b=> b.onclick = ()=> deleteSubject(b.dataset.name));
}

function addSubject(name){
  if(!name || !name.trim()) return alert('과목명을 입력하세요.');
  if(subjects.includes(name)) return alert('중복된 과목명입니다.');
  subjects.push(name);
  saveSubjects();
  renderSubjects();
  renderStats();
}

function deleteSubject(name){
  if(confirm(`${name}을(를) 삭제할까요?`)){
    subjects = subjects.filter(s=>s!==name);
    saveSubjects();
    renderSubjects();
    renderStats();
  }
}

// --- Timer ---
function startTimer(name){
  if(active && active.name !== name) stopTimer(active.name);
  if(active && active.name === name) return;
  const startTs = Date.now();
  active = {name, startTs};
  const sid = safeId(name);
  const startBtn = document.querySelector(`.start[data-name="${cssEscape(name)}"]`);
  const stopBtn = document.querySelector(`.stop[data-name="${cssEscape(name)}"]`);
  if(startBtn) startBtn.disabled = true;
  if(stopBtn) stopBtn.disabled = false;
  active.intervalId = setInterval(()=>{
    const elapsedSec = (Date.now() - active.startTs) / 1000;
    const tEl = el(`timer-${sid}`);
    if(tEl) tEl.textContent = formatHMSDecimal(elapsedSec);
  },100);
}

function stopTimer(name){
  if(!active || active.name !== name) return;
  clearInterval(active.intervalId);
  const elapsedSec = (Date.now() - active.startTs) / 1000;
  const date = new Date().toISOString().slice(0,10);
  records.push({subject:name, date, duration: elapsedSec});
  saveRecords();
  const sid = safeId(name);
  el(`timer-${sid}`).textContent = '00:00:00.0';
  document.querySelector(`.start[data-name="${cssEscape(name)}"]`).disabled = false;
  document.querySelector(`.stop[data-name="${cssEscape(name)}"]`).disabled = true;
  active = null;
  updateTotals();
  renderStats();
}

function updateTotals(){
  const today = new Date().toISOString().slice(0,10);
  const todayTotal = records.filter(r=>r.date===today).reduce((s,r)=>s+(r.duration||0),0);
  el('today-total').textContent = `오늘 총 공부 시간: ${formatHMSDecimal(todayTotal)}`;
  subjects.forEach(name=>{
    const sid = safeId(name);
    const total = records.filter(r=>r.date===today && r.subject===name).reduce((s,r)=>s+(r.duration||0),0);
    const elTotal = el(`total-${sid}`);
    if(elTotal) elTotal.textContent = formatHMSDecimal(total);
  });
}

// --- Stats ---
function aggregateBySubject(rangeDays){
  const cutoff = (rangeDays === 'all') ? null : (() => {
    if(rangeDays === 'today') return new Date().toISOString().slice(0,10);
    const days = Number(rangeDays);
    const d = new Date();
    d.setDate(d.getDate()-(days-1));
    return d.toISOString().slice(0,10);
  })();
  const map = {};
  records.forEach(r=>{
    if(cutoff){
      if(rangeDays==='today' && r.date!==cutoff) return;
      if(rangeDays!=='today' && r.date<cutoff) return;
    }
    map[r.subject] = (map[r.subject]||0) + (r.duration||0);
  });
  return map;
}

function renderStats(){
  const range = el('stats-range').value;
  const agg = aggregateBySubject(range);
  const tbody = el('stats-table-body');
  tbody.innerHTML = '';
  const rows = Object.keys(agg).sort((a,b)=>agg[b]-agg[a]);
  rows.forEach(name=>{
    const sec = agg[name];
    const count = records.filter(r=>r.subject===name).length;
    const tr =
