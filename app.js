/* PRD 기반 Study Timer
   - 과목 관리 (추가/삭제)
   - 과목별 타이머 (1초 단위)
   - 기록 저장: LocalStorage (subject, date(YYYY-MM-DD), durationSeconds)
   - 통계: 일/주/월/전체 집계, 차트(Chart.js), 상세 모달(Pie)
*/

const STORAGE_KEY = 'study_timer_records';
const SUBJECTS_KEY = 'study_timer_subjects';
const COLORS_KEY = 'study_timer_colors';

let subjects = JSON.parse(localStorage.getItem(SUBJECTS_KEY) || '[]');
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let colorMap = JSON.parse(localStorage.getItem(COLORS_KEY) || '{}');

let active = null; // {name, startTs, intervalId}

const el = id => document.getElementById(id);

// 시간 포맷 HH:MM:SS
function formatHMS(sec){
  sec = Math.floor(sec);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

function saveSubjects(){ localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects)); }
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function saveColors(){ localStorage.setItem(COLORS_KEY, JSON.stringify(colorMap)); }

function safeId(name){ return name.replace(/[^a-zA-Z0-9_-]/g, '_'); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// 색상 생성 (과목별 고정)
function hashCode(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
  return h >>> 0;
}
function getColorForSubject(name){
  if(colorMap[name]) return colorMap[name];
  const hue = Math.floor(Math.abs(hashCode(name)) % 360);
  const sat = 60 + Math.floor(Math.abs(hashCode(name+'s')) % 15);
  const light = 45 + Math.floor(Math.abs(hashCode(name+'l')) % 10);
  const color = `hsl(${hue} ${sat}% ${light}%)`;
  colorMap[name] = color;
  saveColors();
  return color;
}

/* ---------- Home: 과목 렌더링 및 관리 ---------- */
function renderSubjects(){
  const container = el('subjects');
  container.innerHTML = '';
  subjects.forEach(name=>{
    const sid = safeId(name);
    const color = getColorForSubject(name);
    const wrapper = document.createElement('div');
    wrapper.className = 'subject-card';
    wrapper.innerHTML = `
      <div style="width:6px;background:${color};"></div>
      <div class="subject-card-inner">
        <div>
          <div class="font-semibold text-lg">${escapeHtml(name)}</div>
          <div class="text-sm text-slate-500">오늘 누적: <span id="total-${sid}">00:00:00</span></div>
        </div>
        <div class="controls flex items-center gap-2">
          <div class="timer timer-mono text-sm w-28 text-center" id="timer-${sid}">00:00:00</div>
          <button class="start bg-green-500 text-white px-3 py-1 rounded" data-name="${escapeHtml(name)}">공부 시작</button>
          <button class="stop bg-yellow-500 text-white px-3 py-1 rounded" data-name="${escapeHtml(name)}" disabled>정지</button>
          <button class="delete bg-red-500 text-white px-2 py-1 rounded" data-name="${escapeHtml(name)}">삭제</button>
        </div>
      </div>
    `;
    container.appendChild(wrapper);
  });
  attachSubjectHandlers();
  updateTotals();
}

function attachSubjectHandlers(){
  document.querySelectorAll('.start').forEach(b=>{
    b.onclick = ()=> startTimer(b.dataset.name);
  });
  document.querySelectorAll('.stop').forEach(b=>{
    b.onclick = ()=> stopTimer(b.dataset.name);
  });
  document.querySelectorAll('.delete').forEach(b=>{
    b.onclick = ()=> deleteSubject(b.dataset.name);
  });
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
  if(!confirm(`${name}을(를) 삭제하시겠습니까? (기록은 유지됩니다)`)) return;
  // 삭제 시 당일 타이머 인스턴스는 중지
  if(active && active.name === name) stopTimer(name);
  subjects = subjects.filter(s=>s!==name);
  saveSubjects();
  renderSubjects();
  renderStats();
}

/* ---------- Timer 로직 (1초 단위) ---------- */
function startTimer(name){
  if(active && active.name !== name) stopTimer(active.name);
  if(active && active.name === name) return;
  active = { name, startTs: Date.now() };
  const sid = safeId(name);
  const startBtn = document.querySelector(`.start[data-name="${name}"]`);
  const stopBtn = document.querySelector(`.stop[data-name="${name}"]`);
  if(startBtn) startBtn.disabled = true;
  if(stopBtn) stopBtn.disabled = false;

  active.intervalId = setInterval(()=>{
    const elapsedSec = Math.floor((Date.now() - active.startTs) / 1000);
    const tEl = el(`timer-${sid}`);
    if(tEl) tEl.textContent = formatHMS(elapsedSec);
  }, 1000);
}

function stopTimer(name){
  if(!active || active.name !== name) return;
  clearInterval(active.intervalId);
  const elapsedSec = Math.floor((Date.now() - active.startTs) / 1000);
  const date = new Date().toISOString().slice(0,10);
  // 기록 저장
  records.push({ subject: name, date, duration: elapsedSec });
  saveRecords();

  const sid = safeId(name);
  const tEl = el(`timer-${sid}`);
  if(tEl) tEl.textContent = '00:00:00';
  const startBtn = document.querySelector(`.start[data-name="${name}"]`);
  const stopBtn = document.querySelector(`.stop[data-name="${name}"]`);
  if(startBtn) startBtn.disabled = false;
  if(stopBtn) stopBtn.disabled = true;

  active = null;
  updateTotals();
  renderStats();
}

/* ---------- Totals & Aggregation ---------- */
function updateTotals(){
  const today = new Date().toISOString().slice(0,10);
  const todayTotal = records.filter(r=>r.date===today).reduce((s,r)=>s + (r.duration||0),0);
  el('today-total').textContent = `오늘 총 공부 시간: ${formatHMS(todayTotal)}`;
  subjects.forEach(name=>{
    const sid = safeId(name);
    const total = records.filter(r=>r.date===today && r.subject===name).reduce((s,r)=>s + (r.duration||0),0);
    const elTotal = el(`total-${sid}`);
    if(elTotal) elTotal.textContent = formatHMS(total);
  });
}

// range: 'day'|'week'|'month'|'all'
function aggregateBySubject(range){
  const map = {};
  const today = new Date();
  records.forEach(r=>{
    if(range === 'day'){
      if(r.date !== today.toISOString().slice(0,10)) return;
    } else if(range === 'week'){
      // 최근 7일 포함 (오늘 포함)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 6);
      if(r.date < cutoff.toISOString().slice(0,10)) return;
    } else if(range === 'month'){
      const ym = today.toISOString().slice(0,7); // YYYY-MM
      if(!r.date.startsWith(ym)) return;
    }
    map[r.subject] = (map[r.subject] || 0) + (Number(r.duration) || 0);
  });
  return map; // seconds per subject
}

/* ---------- Charts (Chart.js) ---------- */
let statsChart = null;
let subjectChart = null;
let modalPie = null;

function renderBarChart(canvasId, labels, data, colors, labelSuffix='초'){
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(statsChart) statsChart.destroy();
  statsChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: `총 시간 (${labelSuffix})`, data, backgroundColor: colors }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
  });
}

function renderLineChart(canvasId, labels, data, color){
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(subjectChart) subjectChart.destroy();
  subjectChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'일별 합계(초)', data, borderColor: color, backgroundColor: color, fill:true, tension:0.2 }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
  });
}

function renderPie(canvasId, labels, data, colors){
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(modalPie) modalPie.destroy();
  modalPie = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: { responsive:true }
  });
}

/* ---------- Stats rendering ---------- */
function renderStats(){
  const range = el('stats-range').value;
  const agg = aggregateBySubject(range);
  const rows = Object.keys(agg).sort((a,b)=>agg[b]-agg[a]);

  // table
  const tbody = el('stats-table-body');
  tbody.innerHTML = '';
  rows.forEach(name=>{
    const sec = agg[name];
    const count = records.filter(r=>{
      if(r.subject !== name) return false;
      if(range === 'all') return true;
      if(range === 'day') return r.date === new Date().toISOString().slice(0,10);
      if(range === 'week'){
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-6);
        return r.date >= cutoff.toISOString().slice(0,10);
      }
      if(range === 'month'){
        const ym = new Date().toISOString().slice(0,7);
        return r.date.startsWith(ym);
      }
      return true;
    }).length;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4 font-medium">${escapeHtml(name)}</td>
      <td class="py-2 pr-4">${formatHMS(sec)}</td>
      <td class="py-2 pr-4">${count}</td>
      <td class="py-2 pr-4"><button class="detail-btn text-sm text-blue-600" data-name="${escapeHtml(name)}">상세보기</button></td>
    `;
    tbody.appendChild(tr);
  });

  // chart (bar) - seconds converted to minutes for readability if large
  const labels = rows;
  const data = rows.map(n=> Math.round((agg[n]||0))); // seconds
  const colors = rows.map(n=> getColorForSubject(n));
  renderBarChart('stats-chart', labels, data, colors, '초');

  // subject select
  const sel = el('subject-select');
  sel.innerHTML = '<option value="">과목 선택</option>';
  rows.forEach(n=>{
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });

  // attach detail buttons
  document.querySelectorAll('.detail-btn').forEach(b=>{
    b.onclick = ()=> openDetailModal(b.dataset.name, range);
  });
}

/* ---------- Subject date-series chart ---------- */
function renderSubjectSeries(subject){
  if(!subject) {
    if(subjectChart) subjectChart.destroy();
    return;
  }
  // 날짜별 합계 (모든 기록) -> 정렬된 날짜
  const map = {};
  records.forEach(r=>{
    if(r.subject !== subject) return;
    map[r.date] = (map[r.date] || 0) + (Number(r.duration) || 0);
  });
  const dates = Object.keys(map).sort();
  const labels = dates;
  const data = dates.map(d=> map[d]);
  const color = getColorForSubject(subject);
  renderLineChart('subject-chart', labels, data, color);
}

/* ---------- 상세 모달 (Pie + 리스트) ---------- */
function openDetailModal(subject, range){
  // compute subject vs others for selected range
  const agg = aggregateBySubject(range);
  const total = Object.values(agg).reduce((s,v)=>s+v,0);
  const subjectSec = agg[subject] || 0;
  const others = total - subjectSec;
  const labels = [subject, '기타'];
  const data = [subjectSec, others];
  const colors = [ getColorForSubject(subject), 'hsl(210 10% 80%)' ];

  // pie
  renderPie('modal-pie', labels, data, colors);

  // list: 최근 기록 10개
  const listEl = el('modal-list');
  const recs = records.filter(r=>r.subject===subject).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  let html = `<div class="mb-2 text-sm text-slate-600">총 ${formatHMS(subjectSec)} (${Math.round((subjectSec/Math.max(total,1))*100)}%)</div>`;
  html += '<ul class="text-sm">';
  recs.forEach(r=>{
    html += `<li>${r.date} — ${formatHMS(r.duration)}</li>`;
  });
  html += '</ul>';
  listEl.innerHTML = html;

  // show modal
  el('modal-title').textContent = `${subject} 상세 통계`;
  el('detail-modal').classList.add('show');
}

/* ---------- UI bindings & init ---------- */
function showTab(tab){
  const home = el('view-home'), stats = el('view-stats');
  if(tab === 'home'){
    home.classList.remove('hidden'); stats.classList.add('hidden');
    el('tab-home').classList.add('active'); el('tab-stats').classList.remove('active');
  } else {
    home.classList.add('hidden'); stats.classList.remove('hidden');
    el('tab-home').classList.remove('active'); el('tab-stats').classList.add('active');
    renderStats();
  }
}

el('tab-home').onclick = ()=> showTab('home');
el('tab-stats').onclick = ()=> showTab('stats');

el('add-subject').onclick = ()=>{
  const v = el('subject-input').value.trim();
  addSubject(v);
  el('subject-input').value = '';
};

el('stats-range').onchange = ()=> renderStats();
el('refresh-stats').onclick = ()=> renderStats();
el('refresh-subject-chart').onclick = ()=> {
  const s = el('subject-select').value;
  renderSubjectSeries(s);
};

// modal close
el('modal-close').onclick = ()=> el('detail-modal').classList.remove('show');
el('detail-modal').onclick = (e)=> { if(e.target.id === 'detail-modal') el('detail-modal').classList.remove('show'); };

// initial render
renderSubjects();
showTab('home');
updateTotals();
