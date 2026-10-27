// ================== 1. 数据存储 ==================
// 数据存在手机浏览器的 localStorage 里（只在这台手机上，不上传任何服务器）
// 格式：{ goal: 4, records: { "2026-10-26": { parts: ["胸","背"], weight: 65.5 } } }
const STORE_KEY = 'fitlog-v1';
const PARTS = ['胸', '背', '腿', '肩', '手臂', '核心', '有氧'];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.records) return saved;
  } catch (e) { /* 数据损坏或读不到时，用空数据 */ }
  return { goal: 4, records: {} };
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

let data = load();

// ================== 2. 日期小工具 ==================
// 用「本地时间」生成 "2026-10-26" 这样的字符串当 key。
// 不用 toISOString()：它是 UTC 时间，在中国早上 8 点前会被算成前一天。
function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const todayKey = () => dateKey(new Date());

// ================== 3. 页面状态 ==================
let selectedKey = todayKey();      // 表单正在编辑哪一天
let viewMonth = new Date();        // 日历显示哪个月
viewMonth.setDate(1);
let pickedParts = new Set();       // 当前选中的部位

const $ = (id) => document.getElementById(id);

// ================== 4. 打卡表单 ==================
function renderChips() {
  const box = $('parts');
  box.innerHTML = '';
  for (const p of PARTS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = p;
    b.setAttribute('aria-pressed', pickedParts.has(p));
    b.onclick = () => {
      if (pickedParts.has(p)) pickedParts.delete(p);
      else pickedParts.add(p);
      renderChips();
    };
    box.appendChild(b);
  }
}

// 把选中那天的记录填进表单
function loadForm() {
  const rec = data.records[selectedKey];
  pickedParts = new Set(rec ? rec.parts : []);
  $('weight').value = rec && rec.weight != null ? rec.weight : '';

  const d = parseKey(selectedKey);
  $('formTitle').textContent = selectedKey === todayKey()
    ? '今天练了什么？'
    : `${d.getMonth() + 1}月${d.getDate()}日 练了什么？`;
  $('saveBtn').textContent = rec ? '更新记录' : '打卡';
  $('deleteBtn').hidden = !rec;
  $('hint').textContent = '';
  renderChips();
}

$('saveBtn').onclick = () => {
  if (pickedParts.size === 0) {
    $('hint').textContent = '至少选一个部位哦';
    return;
  }
  const w = parseFloat($('weight').value);
  data.records[selectedKey] = {
    parts: PARTS.filter((p) => pickedParts.has(p)), // 按固定顺序保存
    weight: Number.isFinite(w) ? w : null,
  };
  save();
  renderAll();
  $('hint').textContent = '已保存 💪';
};

$('deleteBtn').onclick = () => {
  if (!confirm('确定删除这一天的记录吗？')) return;
  delete data.records[selectedKey];
  save();
  renderAll();
};

// ================== 5. 连续天数 & 每周目标 ==================
function calcStreak() {
  let d = new Date();
  // 今天还没打卡不算断，从昨天开始往回数
  if (!data.records[dateKey(d)]) d = addDays(d, -1);
  let n = 0;
  while (data.records[dateKey(d)]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function calcWeekCount() {
  const today = new Date();
  const monday = addDays(today, -((today.getDay() + 6) % 7)); // getDay() 周日是 0，换算成周一为一周开始
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (data.records[dateKey(addDays(monday, i))]) n++;
  }
  return n;
}

function renderStats() {
  const done = calcWeekCount();
  $('streak').textContent = calcStreak();
  $('weekDone').textContent = done;
  $('weekGoal').textContent = data.goal;
  $('weekBar').style.width = Math.min(100, (done / data.goal) * 100) + '%';
}

function changeGoal(delta) {
  data.goal = Math.min(7, Math.max(1, data.goal + delta));
  save();
  renderStats();
}
$('goalMinus').onclick = () => changeGoal(-1);
$('goalPlus').onclick = () => changeGoal(1);

// ================== 6. 日历格子 ==================
function renderCalendar() {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  $('monthTitle').textContent = `${y}年${m + 1}月`;

  const grid = $('calGrid');
  grid.innerHTML = '';

  // 1 号前面空几格（周一开头）
  const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < blanks; i++) grid.appendChild(document.createElement('div'));

  const daysInMonth = new Date(y, m + 1, 0).getDate(); // 下个月第 0 天 = 本月最后一天
  const today = todayKey();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(new Date(y, m, day));
    const cell = document.createElement('button');
    cell.className = 'cal-day';
    cell.textContent = day;
    if (key === today) cell.classList.add('today');
    if (data.records[key]) cell.classList.add('done');
    if (key === selectedKey) cell.classList.add('selected');
    if (key > today) cell.disabled = true; // 未来的日子不能打卡（"YYYY-MM-DD" 格式可以直接比大小）
    cell.onclick = () => {
      selectedKey = key;
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    grid.appendChild(cell);
  }
}

$('prevMonth').onclick = () => { viewMonth.setMonth(viewMonth.getMonth() - 1); renderCalendar(); };
$('nextMonth').onclick = () => { viewMonth.setMonth(viewMonth.getMonth() + 1); renderCalendar(); };

// ================== 7. 体重曲线（手写 SVG，不依赖任何库） ==================
function renderChart() {
  const pts = Object.keys(data.records)
    .sort()
    .filter((k) => data.records[k].weight != null)
    .slice(-30) // 最近 30 条
    .map((k) => ({ key: k, w: data.records[k].weight }));

  const box = $('chart');
  if (pts.length < 2) {
    box.innerHTML = '<p class="hint">记录 2 天以上的体重后，这里会出现曲线</p>';
    return;
  }

  const W = 320, H = 160, padX = 36, padY = 16;
  const ws = pts.map((p) => p.w);
  const lo = Math.min(...ws), hi = Math.max(...ws);
  // 上下各留一点空，避免线贴边；体重几乎不变时也别让线挤成一条
  const span = Math.max(hi - lo, 1);
  const min = lo - span * 0.15, max = hi + span * 0.15;

  const x = (i) => padX + (i * (W - padX - 8)) / (pts.length - 1);
  const y = (w) => padY + ((max - w) / (max - min)) * (H - padY * 2 - 14);
  const md = (key) => { const d = parseKey(key); return `${d.getMonth() + 1}/${d.getDate()}`; };

  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="3" fill="var(--accent)"/>`).join('');
  const guide = (w) => `
    <line x1="${padX}" x2="${W - 8}" y1="${y(w)}" y2="${y(w)}" stroke="var(--line)" stroke-dasharray="3 3"/>
    <text x="${padX - 6}" y="${y(w) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${w.toFixed(1)}</text>`;

  const first = pts[0].w, last = pts[pts.length - 1].w;
  const diff = last - first;
  const diffText = diff === 0 ? '持平' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;

  box.innerHTML = `
    <p class="chart-summary">最新 <b>${last.toFixed(1)}</b> kg · 较 ${md(pts[0].key)} ${diffText}</p>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="体重变化曲线">
      ${guide(hi)}${hi !== lo ? guide(lo) : ''}
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      <text x="${padX}" y="${H - 2}" font-size="11" fill="var(--muted)">${md(pts[0].key)}</text>
      <text x="${W - 8}" y="${H - 2}" font-size="11" fill="var(--muted)" text-anchor="end">${md(pts[pts.length - 1].key)}</text>
    </svg>`;
}

// ================== 8. 启动 ==================
function renderAll() {
  renderStats();
  loadForm();
  renderCalendar();
  renderChart();
}

renderAll();

// 从后台切回来时（比如隔天再打开）重新计算，保证「今天」是对的
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') renderStats();
});

// 注册离线缓存（sw.js），健身房没信号也能打开
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
