const STORAGE_KEY = 'study_timer_records';
const subjectsKey = 'study_timer_subjects';
let subjects = JSON.parse(localStorage.getItem(subjectsKey) || '[]');
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let active = null;
const el = id => document.getElementById(id);
const formatHMS = s => {
  const h = String(Math.floor(s/3600)).padStart(2,'0');
  const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const sec = String(s%60).padStart(2,'0');
  return `${h}:${m}:${sec}`;
};
function saveSubjects(){ localStorage.setItem(subjectsKey, JSON.stringify(subjects)); }
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function renderSubjects(){
  const container = document.getElementById('subjects');
  container.innerHTML = '';
  subjects.forEach(name=>{
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div>
        <div><strong>${name}</strong></div>
        <div class="small">누적: <span class="total-${name}">00:00:00</span></div>
      </div>
      <div>
        <span class="timer timer-${name}">00:00:00</span>
        <button class="start" data-name="${name}">공부 시작</button>
        <button class="stop" data-name="${name}" disabled>정지</button>
        <button class="delete" data-name="${name}">삭제</button>
      </div>
    `;
    container.appendChild(card);
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
}
function deleteSubject(name){
  if(confirm(`${name}을(를) 삭제할까요? 관련 당일 기록은 유지됩니다.`)){
    subjects = subjects.filter(s=>s!==name);
    saveSubjects();
    renderSubjects();
  }
}
function startTimer(name){
  if(active && active.name !== name) stopTimer(active.name);
  if(active && active.name === name) return;
  const startTs = Date.now();
  active = {name, startTs, elapsed:0};
  document.querySelector(`.start[data-name="${name}"]`).disabled = true;
  document.querySelector(`.stop[data-name="${name}"]`).disabled = false;
  active.intervalId = setInterval(()=>{
    const elapsed = Math.floor((Date.now() - active.startTs)/1000);
    document.querySelector(`.timer-${name}`).textContent = formatHMS(elapsed);
  },1000);
}
function stopTimer(name){
  if(!active || active.name !== name) return;
  clearInterval(active.intervalId);
  const elapsed = Math.floor((Date.now() - active.startTs)/1000);
  const date = new Date().toISOString().slice(0,10);
  records.push({subject:name, date, duration: elapsed});
  saveRecords();
  document.querySelector(`.timer-${name}`).textContent = '00:00:00';
  document.querySelector(`.start[data-name="${name}"]`).disabled = false;
  document.querySelector(`.stop[data-name="${name}"]`).disabled = true;
  active = null;
  updateTotals();
}
function updateTotals(){
  const today = new Date().toISOString().slice(0,10);
  const todayTotal = records.filter(r=>r.date===today).reduce((s,r)=>s+r.duration,0);
  el('today-total').textContent = `오늘 총 공부 시간: ${formatHMS(todayTotal)}`;
  subjects.forEach(name=>{
    const total = records.filter(r=>r.date===today && r.subject===name).reduce((s,r)=>s+r.duration,0);
    const elTotal = document.querySelector(`.total-${name}`);
    if(elTotal) elTotal.textContent = formatHMS(total);
  });
}
document.getElementById('add-subject').onclick = ()=>{
  const v = document.getElementById('subject-input').value.trim();
  addSubject(v);
  document.getElementById('subject-input').value = '';
};
renderSubjects();
