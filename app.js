'use strict';
/* 代車管理 — 素のJS + localStorage の試作 */

// ---------- 保存 ----------
const KEY = 'daisha-v1';
const HOUR = 3600e3, DAY = 24 * HOUR, FAR = 3650 * DAY;
let db;

function seed() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const at = (d, h) => toInput(new Date(today.getTime() + d * DAY + h * HOUR));
  const date = (d) => at(d, 0).slice(0, 10);
  return {
    settings: { prepHours: 1, dayStart: 8, dayEnd: 20 },
    staff: ['佐藤', '鈴木', '田中'],
    vehicles: [
      { id: 'V01', name: 'ミライース', plate: '品川 500 あ 12-34', category: '代車', inspection: date(200), active: true, note: '' },
      { id: 'V02', name: 'タント', plate: '品川 580 い 56-78', category: '代車', inspection: date(20), active: true, note: '' },
      { id: 'V03', name: 'フィット', plate: '品川 500 う 90-12', category: 'レンタカー', inspection: date(120), active: true, note: 'レンタカー保険加入' },
      { id: 'V04', name: 'アルト', plate: '品川 580 え 34-56', category: '代車', inspection: date(-3), active: true, note: '車検切れ（要更新）' },
    ],
    loans: [
      { id: 'L1', type: 'loan', vehicleId: 'V01', customer: '山田様', staff: '佐藤', start: at(0, 9), end: at(0, 17), undecided: false, returned: false, cancelled: false, note: '車検入庫' },
      { id: 'L2', type: 'loan', vehicleId: 'V02', customer: '高橋様', staff: '鈴木', start: at(-9, 10), end: '', undecided: true, returned: false, cancelled: false, note: '板金修理' },
      { id: 'L3', type: 'loan', vehicleId: 'V03', customer: '伊藤様', staff: '田中', start: at(1, 13), end: at(3, 12), undecided: false, returned: false, cancelled: false, note: '' },
      { id: 'L4', type: 'loan', vehicleId: 'V01', customer: '渡辺様', staff: '佐藤', start: at(-2, 9), end: at(-1, 12), undecided: false, returned: false, cancelled: false, note: '返却処理漏れ' },
      { id: 'L5', type: 'corp', vehicleId: 'V03', customer: '社用', staff: '田中', start: at(0, 10), end: at(0, 12), undecided: false, returned: false, cancelled: false, note: '' },
    ],
  };
}
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !db.vehicles) { db = seed(); save(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 保存不可の環境ではメモリのみ */ } }

// alert/confirm の代わり（アーティファクトのビューアでは使えないため）
function notify(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(notify.t); notify.t = setTimeout(() => { t.hidden = true; }, 3500);
}
function ask(msg) {
  return new Promise((res) => {
    const d = document.getElementById('askDlg');
    document.getElementById('askMsg').textContent = msg;
    const done = (v) => { d.close(); res(v); };
    document.getElementById('askYes').onclick = () => done(true);
    document.getElementById('askNo').onclick = () => done(false);
    d.oncancel = () => res(false);
    d.showModal();
  });
}

// ---------- 日付 ----------
const pad = (n) => String(n).padStart(2, '0');
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function toInput(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function ymd(d) { return toInput(d).slice(0, 10); }
function parse(s) { return s ? new Date(s) : null; }
function fmt(s) { const d = parse(s); return d ? `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; }
function dayStart(s) { return new Date(s + 'T00:00'); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- ロジック ----------
const vehicle = (id) => db.vehicles.find((v) => v.id === id);
const vLabel = (v) => v ? `${v.id} ${v.name} ${v.plate}` : '(不明な車両)';
const prepMs = () => (Number(db.settings.prepHours) || 0) * HOUR;

// 実際の使用区間
function span(l) {
  const s = parse(l.start).getTime();
  let e;
  if (l.returned) e = l.returnedAt ? parse(l.returnedAt).getTime() : (l.end ? parse(l.end).getTime() : s);
  else if (l.undecided || !l.end) e = Math.max(Date.now(), s) + FAR;
  else e = parse(l.end).getTime();
  return [s, Math.max(e, s)];
}
// 準備時間を含む占有区間
function occ(l) {
  const [s, e] = span(l);
  const p = l.type === 'loan' && !(l.undecided || !l.end) ? prepMs() : 0;
  return [s, e + p];
}
function status(l, now = Date.now()) {
  if (l.cancelled) return '取消';
  if (l.returned) return '返却済';
  if (l.type === 'corp') return '社用';
  if (l.type === 'ng') return '使用不可';
  if (l.undecided || !l.end) return '返却未定';
  if (parse(l.end).getTime() < now) return '遅延';
  if (parse(l.start).getTime() <= now) return '貸出中';
  return '予約';
}
const SCLS = { 貸出中: 'rent', 予約: 'resv', 遅延: 'late', 返却済: 'done', 返却未定: 'tbd', 社用: 'corp', 使用不可: 'ng', 取消: 'cancel' };
const SCODE = { 貸出中: '貸', 予約: '予', 遅延: '遅', 返却済: '済', 返却未定: '未', 社用: '社', 使用不可: '不' };
const badge = (st) => `<span class="badge s-${SCLS[st]}">${st}</span>`;
const catBadge = (c) => `<span class="badge cat-${c}">${c}</span>`;

function overlap(a, b) { return a[0] < b[1] && b[0] < a[1]; }
function conflicts(l) {
  if (l.cancelled) return [];
  const a = occ(l);
  return db.loans.filter((o) => o.id !== l.id && o.vehicleId === l.vehicleId && !o.cancelled && overlap(a, occ(o)));
}
function inspectionIssue(l) {
  const v = vehicle(l.vehicleId);
  if (!v || !v.inspection || l.cancelled || l.type === 'ng') return '';
  const lim = new Date(v.inspection + 'T23:59:59').getTime();
  return span(l)[0] > lim || (!l.undecided && l.end && parse(l.end).getTime() > lim) ? `車検期限（${v.inspection}）を過ぎる期間を含みます` : '';
}
function activeVehicles(cat = '') { return db.vehicles.filter((v) => v.active !== false && (!cat || v.category === cat)); }
function loansOf(vid) { return db.loans.filter((l) => l.vehicleId === vid && !l.cancelled); }

// ---------- UI状態 ----------
const VIEWS = ['dashboard', 'day', 'period', 'ledger', 'search', 'master'];
const ui = { view: 'dashboard', day: ymd(new Date()), pStart: ymd(new Date()), pDays: 14, filter: '', fstatus: '', fveh: '', cat: '', sort: { key: 'start', dir: -1 }, search: {} };
const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const isPhone = () => window.matchMedia('(max-width:760px)').matches;

function catChips() {
  return `<div class="chips">${[['', 'すべて'], ['代車', '代車'], ['レンタカー', 'レンタカー']].map(([v, t]) => `<button class="chip ${ui.cat === v ? 'on' : ''}" data-cat="${v}">${t}</button>`).join('')}</div>`;
}

function render() {
  if (location.hash.slice(1) !== ui.view) history.replaceState(null, '', '#' + ui.view);
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  const t = new Date(); $('#today').textContent = `${t.getMonth() + 1}月${t.getDate()}日（${WD[t.getDay()]}）`;
  const fn = { dashboard, day: dayView, period: periodView, ledger, search: searchView, master }[ui.view];
  const sx = window.scrollX, sy = window.scrollY;
  main.innerHTML = fn();
  window.scrollTo(sx, sy);
  const after = { day: bindBoard, period: bindBoard, ledger: bindLedger, search: bindSearch, master: bindMaster, dashboard: bindLedger }[ui.view];
  if (after) after();
}

// ---------- ダッシュボード ----------
function dashboard() {
  const now = Date.now(), todayS = ymd(new Date());
  const live = db.loans.filter((l) => !l.cancelled && !l.returned);
  const st = (l) => status(l, now);
  const cnt = (n) => live.filter((l) => l.type === 'loan' && st(l) === n).length;
  const busyNow = new Set(db.loans.filter((l) => !l.cancelled).filter((l) => { const o = occ(l); return o[0] <= now && now < o[1]; }).map((l) => l.vehicleId));
  const freeNow = activeVehicles().filter((v) => !busyNow.has(v.id));
  const tbd = live.filter((l) => st(l) === '返却未定');
  const late = live.filter((l) => st(l) === '遅延');
  const todayOut = live.filter((l) => l.type === 'loan' && l.start.slice(0, 10) === todayS);
  const todayIn = live.filter((l) => l.type === 'loan' && l.end && l.end.slice(0, 10) === todayS);
  const soon = activeVehicles().filter((v) => v.inspection && (new Date(v.inspection + 'T23:59:59') - now) / DAY <= 30)
    .sort((a, b) => a.inspection.localeCompare(b.inspection));
  const row = (l, extra = '') => `<li class="click" data-edit="${l.id}">${badge(st(l))}<span class="grow"><b>${esc(vehicle(l.vehicleId)?.name)}</b> <span class="muted">${esc(l.customer)}</span></span><span class="muted">${extra}</span></li>`;
  const empty = '<li class="muted">なし</li>';
  return `
  <div class="cards">
    <div class="card stat"><div class="n">${cnt('貸出中')}</div><div class="l">貸出中</div></div>
    <div class="card stat"><div class="n">${freeNow.length}<span class="muted" style="font-size:16px"> / ${activeVehicles().length}</span></div><div class="l">いま空いている車</div></div>
    <div class="card stat ${late.length ? 'alert' : ''}"><div class="n">${late.length}</div><div class="l">遅延</div></div>
    <div class="card stat"><div class="n">${tbd.length}</div><div class="l">返却未定</div></div>
    <div class="card stat"><div class="n">${cnt('予約')}</div><div class="l">予約</div></div>
  </div>
  <div class="cols">
    <div class="card"><h3>いま空いている車</h3><ul class="list">${freeNow.map((v) => `<li>${catBadge(v.category)}<span class="grow"><b>${esc(v.name)}</b> <span class="muted">${esc(v.plate)}</span></span></li>`).join('') || empty}</ul></div>
    <div class="card"><h3>遅延</h3><ul class="list">${late.map((l) => row(l, `返却予定 ${fmt(l.end)}`)).join('') || empty}</ul></div>
    <div class="card"><h3>返却未定（経過日数）</h3><ul class="list">${tbd.map((l) => {
      const d = Math.floor((now - parse(l.start)) / DAY);
      return row(l, `<span class="${d >= 7 ? 'red' : ''}">${Math.max(d, 0)}日経過</span>`);
    }).join('') || empty}</ul></div>
    <div class="card"><h3>本日の貸出予定</h3><ul class="list">${todayOut.map((l) => row(l, fmt(l.start).split(' ')[1])).join('') || empty}</ul></div>
    <div class="card"><h3>本日の返却予定</h3><ul class="list">${todayIn.map((l) => row(l, fmt(l.end).split(' ')[1])).join('') || empty}</ul></div>
    <div class="card"><h3>車検が近い／切れた車（30日以内）</h3><ul class="list">${soon.map((v) => {
      const d = Math.ceil((new Date(v.inspection + 'T23:59:59') - now) / DAY);
      return `<li>${catBadge(v.category)}<span class="grow"><b>${esc(v.name)}</b> <span class="muted">${esc(v.plate)}</span></span><span class="${d <= 0 ? 'red' : ''}">${v.inspection}${d <= 0 ? '（切れ）' : `（あと${d}日）`}</span></li>`;
    }).join('') || empty}</ul></div>
  </div>`;
}

// ---------- ボード共通 ----------
function legend() {
  return `<div class="legend">${['貸出中', '予約', '遅延', '返却済', '返却未定', '社用', '使用不可'].map((s) => `<span class="badge s-${SCLS[s]}">${SCODE[s]} ${s}</span>`).join('')}<span class="badge s-prep">準 準備時間</span></div>`;
}
function vehCell(v) {
  return `<td class="veh" data-vedit="${esc(v.id)}"><div class="nm">${catBadge(v.category)} ${esc(v.name)}</div><div class="pl">${esc(v.plate)}</div></td>`;
}
// [t0,t1) に重なるもの → {l, kind}
function slotInfo(v, t0, t1) {
  for (const l of loansOf(v.id)) {
    const [s, e] = span(l);
    if (s < t1 && t0 < e) return { l, kind: 'main' };
  }
  for (const l of loansOf(v.id)) {
    const o = occ(l);
    if (o[0] < t1 && t0 < o[1]) return { l, kind: 'prep' };
  }
  return null;
}

// ---------- 日別 ----------
function dayView() {
  const { dayStart: h0, dayEnd: h1 } = db.settings;
  const base = dayStart(ui.day).getTime();
  const hours = []; for (let h = h0; h < h1; h++) hours.push(h);
  const nowT = Date.now();
  const rows = activeVehicles(ui.cat).map((v) => {
    const cells = hours.map((h) => {
      const t0 = base + h * HOUR;
      const info = slotInfo(v, t0, t0 + HOUR);
      return { h, key: info ? info.l.id + info.kind : '', info };
    });
    let html = '';
    for (let i = 0; i < cells.length;) {
      const c = cells[i]; let j = i + 1;
      while (j < cells.length && c.key && cells[j].key === c.key) j++;
      const n = j - i;
      const nowCls = nowT >= base + c.h * HOUR && nowT < base + (c.h + 1) * HOUR ? ' now' : '';
      if (!c.info) html += `<td class="cell empty${nowCls}" data-new="${esc(v.id)}" data-t="${ui.day}T${pad(c.h)}:00"></td>`;
      else if (c.info.kind === 'prep') html += `<td class="cell s-prep" colspan="${n}" data-edit="${c.info.l.id}" title="準備時間">準</td>`;
      else {
        const st = status(c.info.l);
        const tip = `${st} ${c.info.l.customer}\n${fmt(c.info.l.start)} → ${c.info.l.end ? fmt(c.info.l.end) : '未定'}`;
        html += `<td class="cell s-${SCLS[st]}" colspan="${n}" data-edit="${c.info.l.id}" title="${esc(tip)}">${SCODE[st]} ${n > 1 ? esc(c.info.l.customer) : ''}</td>`;
      }
      i = j;
    }
    return `<tr>${vehCell(v)}${html}</tr>`;
  }).join('');
  const nowH = ymd(new Date()) === ui.day ? new Date().getHours() : -1;
  const d = dayStart(ui.day);
  return `
  <div class="toolbar">
    <h2 style="margin:0">日別ビュー</h2>
    <button class="btn" data-step="-1">‹</button>
    <input type="date" id="dayPick" value="${ui.day}">
    <button class="btn" data-step="1">›</button>
    <button class="btn" data-today>今日</button>
    <b>${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）</b>
    <span class="spacer"></span>${catChips()}
  </div>
  <div class="board"><table style="min-width:calc(var(--vw) + ${hours.length * 46}px)">
    <thead><tr><th class="veh">車両</th>${hours.map((h) => `<th class="${h === nowH ? 'today' : ''}">${h}:00</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>${legend()}`;
}

// ---------- 期間 ----------
function periodView() {
  const base = dayStart(ui.pStart).getTime();
  const days = Array.from({ length: ui.pDays }, (_, i) => new Date(base + i * DAY));
  const today = ymd(new Date());
  const rows = activeVehicles(ui.cat).map((v) => {
    const tds = days.map((d) => {
      const t = d.getTime();
      return [0, 12].map((hh) => {
        const info = slotInfo(v, t + hh * HOUR, t + (hh + 12) * HOUR);
        const wk = d.getDay() === 0 || d.getDay() === 6 ? ' wk' : '';
        if (!info) return `<td class="cell empty${wk}" data-new="${esc(v.id)}" data-t="${ymd(d)}T${hh === 0 ? '09' : '13'}:00"></td>`;
        if (info.kind === 'prep') return `<td class="cell s-prep" data-edit="${info.l.id}" title="準備時間"></td>`;
        const st = status(info.l);
        return `<td class="cell s-${SCLS[st]}" data-edit="${info.l.id}" title="${esc(`${st} ${info.l.customer}\n${fmt(info.l.start)} → ${info.l.end ? fmt(info.l.end) : '未定'}`)}">${SCODE[st]}</td>`;
      }).join('');
    }).join('');
    return `<tr>${vehCell(v)}${tds}</tr>`;
  }).join('');
  return `
  <div class="toolbar">
    <h2 style="margin:0">期間ボード</h2>
    <button class="btn" data-step="-7">‹ 1週</button>
    <input type="date" id="pPick" value="${ui.pStart}">
    <button class="btn" data-step="7">1週 ›</button>
    <button class="btn" data-today>今日</button>
    <select id="pDays">${[7, 14, 21, 28].map((n) => `<option value="${n}" ${n === ui.pDays ? 'selected' : ''}>${n}日間</option>`).join('')}</select>
    <span class="hint">各日 左=午前 / 右=午後</span>
    <span class="spacer"></span>${catChips()}
  </div>
  <div class="board"><table style="min-width:calc(var(--vw) + ${ui.pDays * 60}px)">
    <thead><tr><th class="veh" rowspan="1">車両</th>${days.map((d) => `<th colspan="2" class="${ymd(d) === today ? 'today' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' wk' : ''}">${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>${legend()}`;
}

function bindBoard() {
  const step = (n) => {
    if (ui.view === 'day') ui.day = ymd(new Date(dayStart(ui.day).getTime() + n * DAY + 12 * HOUR));
    else ui.pStart = ymd(new Date(dayStart(ui.pStart).getTime() + n * DAY + 12 * HOUR));
    render();
  };
  main.querySelectorAll('[data-step]').forEach((b) => b.onclick = () => step(Number(b.dataset.step) * (ui.view === 'day' ? 1 : 1)));
  main.querySelectorAll('[data-today]').forEach((b) => b.onclick = () => { ui.day = ui.pStart = ymd(new Date()); render(); });
  const dp = $('#dayPick'); if (dp) dp.onchange = () => { if (dp.value) { ui.day = dp.value; render(); } };
  const pp = $('#pPick'); if (pp) pp.onchange = () => { if (pp.value) { ui.pStart = pp.value; render(); } };
  const pd = $('#pDays'); if (pd) pd.onchange = () => { ui.pDays = Number(pd.value); render(); };
  main.querySelectorAll('[data-new]').forEach((c) => c.onclick = () => openLoan(null, { vehicleId: c.dataset.new, start: c.dataset.t }));
  bindLedger();
  main.querySelectorAll('[data-vedit]').forEach((c) => c.onclick = () => openVeh(c.dataset.vedit));
  main.querySelectorAll('[data-cat]').forEach((c) => c.onclick = () => { ui.cat = c.dataset.cat; render(); });
  // 日別ビューは現在時刻の付近が見えるようにスクロール
  const bd = $('.board');
  if (bd && ui.view === 'day' && ui.day === ymd(new Date())) {
    const nowCell = bd.querySelector('.now'); if (nowCell) bd.scrollLeft = Math.max(0, nowCell.offsetLeft - bd.clientWidth / 2);
  }
}

// ---------- 台帳 ----------
const SORT_COLS = [['status', '状態'], ['vehicle', '車両'], ['cat', '登録'], ['customer', 'お客様'], ['staff', '担当'], ['start', '開始'], ['end', '終了'], ['note', 'メモ']];
const STATUS_ORDER = ['遅延', '返却未定', '貸出中', '予約', '社用', '使用不可', '返却済', '取消'];
function sortKey(l, key) {
  const v = vehicle(l.vehicleId);
  switch (key) {
    case 'status': return STATUS_ORDER.indexOf(status(l));
    case 'vehicle': return v ? `${v.name} ${v.plate}` : l.vehicleId;
    case 'cat': return v ? v.category : '';
    case 'customer': return l.customer || '';
    case 'staff': return l.staff || '';
    case 'start': return l.start || '';
    case 'end': return l.undecided || !l.end ? '9999' : l.end;
    default: return l.note || '';
  }
}
function ledger() {
  const q = ui.filter.trim().toLowerCase();
  const { key, dir } = ui.sort;
  const sorter = (a, b) => {
    const x = sortKey(a, key), y = sortKey(b, key);
    const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ja');
    return (c * dir) || b.start.localeCompare(a.start);
  };
  const arrow = (k) => (k === key ? (dir === 1 ? ' ▲' : ' ▼') : '');
  const rows = db.loans.slice().filter((l) => {
    const st = status(l);
    if (ui.fstatus && st !== ui.fstatus) return false;
    if (ui.fveh && l.vehicleId !== ui.fveh) return false;
    const v = vehicle(l.vehicleId);
    return !q || [l.customer, l.staff, l.note, v?.name, v?.plate, v?.id].join(' ').toLowerCase().includes(q);
  }).sort(sorter).map((l) => {
    const v = vehicle(l.vehicleId), st = status(l), c = conflicts(l), ins = inspectionIssue(l);
    return `<tr class="click ${c.length ? 'conflict' : ''}" data-edit="${l.id}">
      <td data-label="状態">${badge(st)}${c.length ? ' <span class="red">時間が重複</span>' : ''}${ins ? ' <span class="red">車検</span>' : ''}</td>
      <td data-label="車両"><b>${esc(v ? `${v.name} ${v.plate}` : l.vehicleId)}</b></td><td data-label="登録">${v ? catBadge(v.category) : ''}</td>
      <td data-label="お客様">${esc(l.customer)}</td><td data-label="担当">${esc(l.staff)}</td><td data-label="開始">${fmt(l.start)}</td>
      <td data-label="終了">${l.undecided || !l.end ? '<span class="muted">未定</span>' : fmt(l.end)}</td>
      <td data-label="メモ" class="muted">${esc(l.note)}</td></tr>`;
  }).join('');
  return `
  <div class="toolbar">
    <h2 style="margin:0">貸出台帳</h2>
    <input id="fq" type="search" placeholder="検索（お客様・車名・ナンバー…）" value="${esc(ui.filter)}" style="min-width:200px;flex:1;max-width:320px">
    <select id="fveh" aria-label="車両で絞り込み"><option value="">すべての車両</option>${db.vehicles.map((v) => `<option value="${esc(v.id)}" ${v.id === ui.fveh ? 'selected' : ''}>${esc(`${v.name} ${v.plate}`)}${v.active === false ? '（停止）' : ''}</option>`).join('')}</select>
    <select id="fst"><option value="">すべてのステータス</option>${Object.keys(SCLS).map((s) => `<option ${s === ui.fstatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <span class="sortbar"><select id="sortKey" aria-label="並び替え">${SORT_COLS.map(([k, t]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${t}で並び替え</option>`).join('')}</select>
      <button class="btn" id="sortDir" aria-label="昇順・降順">${dir === 1 ? '▲ 昇順' : '▼ 降順'}</button></span>
    <span class="spacer"></span>
    <button class="btn" id="btnExport">バックアップ</button>
    <button class="btn" id="btnImport">復元</button><input type="file" id="fileImport" accept=".json" hidden>
  </div>
  <div class="card scroll cardwrap" style="padding:6px 10px"><table class="stack">
    <thead><tr>${SORT_COLS.map(([k, t]) => `<th class="sortable ${k === key ? 'sorted' : ''}" data-sort="${k}" tabindex="0" aria-sort="${k === key ? (dir === 1 ? 'ascending' : 'descending') : 'none'}">${t}${arrow(k)}</th>`).join('')}</tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="muted">該当なし。右上の「＋ 新規貸出」から登録できます。</td></tr>'}</tbody></table></div>`;
}
function bindLedger() {
  main.querySelectorAll('[data-edit]').forEach((r) => r.onclick = () => openLoan(r.dataset.edit));
  const fq = $('#fq'); if (fq) fq.oninput = () => { ui.filter = fq.value; const p = fq.selectionStart; render(); const n = $('#fq'); n.focus(); n.setSelectionRange(p, p); };
  const fveh = $('#fveh'); if (fveh) fveh.onchange = () => { ui.fveh = fveh.value; render(); };
  const fst = $('#fst'); if (fst) fst.onchange = () => { ui.fstatus = fst.value; render(); };
  const setSort = (k) => { ui.sort = k === ui.sort.key ? { key: k, dir: -ui.sort.dir } : { key: k, dir: k === 'start' || k === 'end' ? -1 : 1 }; render(); };
  main.querySelectorAll('th[data-sort]').forEach((th) => {
    th.onclick = () => setSort(th.dataset.sort);
    th.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSort(th.dataset.sort); } };
  });
  const sk = $('#sortKey'); if (sk) sk.onchange = () => { ui.sort = { key: sk.value, dir: sk.value === 'start' || sk.value === 'end' ? -1 : 1 }; render(); };
  const sd = $('#sortDir'); if (sd) sd.onclick = () => { ui.sort.dir *= -1; render(); };
  const ex = $('#btnExport'); if (ex) ex.onclick = exportJson;
  const im = $('#btnImport'); if (im) im.onclick = () => $('#fileImport').click();
  const fi = $('#fileImport'); if (fi) fi.onchange = () => importJson(fi.files[0]);
}
function exportJson() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = `daisha-backup-${ymd(new Date())}.json`; a.click();
}
function importJson(f) {
  if (!f) return;
  f.text().then(async (t) => {
    const d = JSON.parse(t);
    if (!d.vehicles || !d.loans) throw new Error('形式が違います');
    if (!(await ask('現在のデータを上書きして復元します。よろしいですか？'))) return;
    db = d; save(); render();
  }).catch((e) => notify('復元に失敗しました: ' + e.message));
}

// ---------- 空き検索 ----------
function searchView() {
  const s = ui.search;
  if (!s.from) { const n = new Date(); n.setMinutes(0, 0, 0); s.from = toInput(new Date(n.getTime() + HOUR)); s.to = toInput(new Date(n.getTime() + 5 * HOUR)); s.cat = ''; }
  const a = [parse(s.from).getTime(), parse(s.to).getTime()];
  const res = a[1] > a[0] ? activeVehicles().filter((v) => !s.cat || v.category === s.cat).map((v) => {
    const busy = loansOf(v.id).filter((l) => overlap([a[0], a[1] + prepMs()], occ(l)));
    const ng = v.inspection && a[1] > new Date(v.inspection + 'T23:59:59').getTime();
    return { v, busy, ng };
  }) : [];
  return `
  <div class="toolbar"><h2 style="margin:0">空き検索</h2></div>
  <div class="card" style="margin-bottom:16px"><div class="grid3">
    <label>開始 <input type="datetime-local" id="sFrom" value="${s.from}"></label>
    <label>終了 <input type="datetime-local" id="sTo" value="${s.to}"></label>
    <label>登録区分 <select id="sCat"><option value="">すべて</option><option ${s.cat === '代車' ? 'selected' : ''}>代車</option><option ${s.cat === 'レンタカー' ? 'selected' : ''}>レンタカー</option></select></label>
  </div><p class="muted" style="margin-bottom:0">終了後の準備時間（${db.settings.prepHours}時間）も含めて判定します。</p></div>
  <div class="card scroll cardwrap"><table class="stack"><thead><tr><th>判定</th><th>車両</th><th>登録</th><th>備考</th><th></th></tr></thead><tbody>
  ${a[1] <= a[0] ? '<tr><td colspan="5" class="red">終了は開始より後にしてください</td></tr>' : res.map(({ v, busy, ng }) => `<tr>
    <td data-label="判定">${busy.length ? '<span class="badge s-late">埋まり</span>' : ng ? '<span class="badge s-tbd">車検注意</span>' : '<span class="badge s-resv">空き</span>'}</td>
    <td data-label="車両"><b>${esc(v.name)}</b> <span class="muted">${esc(v.plate)}</span></td><td data-label="登録">${catBadge(v.category)}</td>
    <td data-label="備考" class="muted">${busy.length ? busy.map((l) => `${esc(l.customer)} ${fmt(l.start)}〜${l.end && !l.undecided ? fmt(l.end) : '未定'}`).join(' / ') : ng ? `車検期限 ${v.inspection} を過ぎます` : ''}</td>
    <td>${busy.length ? '' : `<button class="btn sm primary" data-book="${esc(v.id)}">この車で予約</button>`}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function bindSearch() {
  const upd = () => { ui.search.from = $('#sFrom').value; ui.search.to = $('#sTo').value; ui.search.cat = $('#sCat').value; render(); };
  ['#sFrom', '#sTo', '#sCat'].forEach((id) => $(id).onchange = upd);
  main.querySelectorAll('[data-book]').forEach((b) => b.onclick = () => openLoan(null, { vehicleId: b.dataset.book, start: ui.search.from, end: ui.search.to }));
}

// ---------- 車両マスタ ----------
function master() {
  const rows = db.vehicles.map((v) => `<tr class="click" data-vedit="${esc(v.id)}">
    <td data-label="ID">${esc(v.id)}</td><td data-label="車名"><b>${esc(v.name)}</b></td><td data-label="ナンバー">${esc(v.plate)}</td><td data-label="登録区分">${catBadge(v.category)}</td>
    <td data-label="車検期限">${v.inspection ? `<span class="${new Date(v.inspection + 'T23:59:59') < Date.now() ? 'red' : ''}">${v.inspection}</span>` : ''}</td>
    <td data-label="履歴">${loansOf(v.id).filter((l) => l.type === 'loan').length}件</td>
    <td data-label="状態">${v.active === false ? '<span class="muted">停止</span>' : '使用中'}</td><td data-label="メモ" class="muted">${esc(v.note)}</td></tr>`).join('');
  return `
  <div class="toolbar"><h2 style="margin:0">車両マスタ</h2><span class="muted">${db.vehicles.length}台（上限30台）</span><span class="spacer"></span>
    <button class="btn primary" id="vNew">＋ 車両を追加</button></div>
  <div class="card scroll cardwrap" style="padding:6px 10px;margin-bottom:18px"><table class="stack">
    <thead><tr><th>ID</th><th>車名</th><th>ナンバー</th><th>登録区分</th><th>車検期限</th><th>履歴</th><th>状態</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="cols">
    <div class="card"><h3>設定</h3><div class="grid2">
      <label>準備時間（返却後に空ける時間）<input type="number" min="0" step="0.5" id="setPrep" value="${db.settings.prepHours}"></label>
      <span></span>
      <label>日別ビュー 開始時刻<input type="number" min="0" max="23" id="setS" value="${db.settings.dayStart}"></label>
      <label>日別ビュー 終了時刻<input type="number" min="1" max="24" id="setE" value="${db.settings.dayEnd}"></label></div></div>
    <div class="card"><h3>担当者</h3><ul class="list">${db.staff.map((s, i) => `<li><span class="grow">${esc(s)}</span><button class="btn sm danger" data-sdel="${i}">削除</button></li>`).join('')}</ul>
      <div class="toolbar" style="margin:10px 0 0"><input id="sName" placeholder="担当者名" style="flex:1"><button class="btn" id="sAdd">追加</button></div></div>
  </div>`;
}
function bindMaster() {
  main.querySelectorAll('[data-vedit]').forEach((r) => r.onclick = () => openVeh(r.dataset.vedit));
  $('#vNew').onclick = () => openVeh(null);
  const setting = () => {
    db.settings.prepHours = Math.max(0, Number($('#setPrep').value) || 0);
    let s = Math.min(23, Math.max(0, Number($('#setS').value) || 0)), e = Math.min(24, Math.max(1, Number($('#setE').value) || 20));
    if (e <= s) e = s + 1;
    db.settings.dayStart = s; db.settings.dayEnd = e; save();
  };
  ['#setPrep', '#setS', '#setE'].forEach((id) => $(id).onchange = setting);
  $('#sAdd').onclick = () => { const n = $('#sName').value.trim(); if (n && !db.staff.includes(n)) { db.staff.push(n); save(); render(); } };
  main.querySelectorAll('[data-sdel]').forEach((b) => b.onclick = () => { db.staff.splice(Number(b.dataset.sdel), 1); save(); render(); });
}

// ---------- 貸出ダイアログ ----------
const loanDlg = $('#loanDlg'), loanForm = $('#loanForm');
let editingLoan = null;
function openLoan(id, pre = {}) {
  editingLoan = id ? db.loans.find((l) => l.id === id) : null;
  const f = loanForm.elements;
  f.vehicleId.innerHTML = db.vehicles.filter((v) => v.active !== false || v.id === editingLoan?.vehicleId)
    .map((v) => `<option value="${esc(v.id)}">${esc(`${v.id} ${v.name} ${v.plate}（${v.category}）`)}</option>`).join('');
  f.staff.innerHTML = '<option value=""></option>' + db.staff.map((s) => `<option>${esc(s)}</option>`).join('');
  $('#loanTitle').textContent = editingLoan ? '貸出を編集' : '新規貸出';
  $('#loanDelete').hidden = !editingLoan;
  const startDefault = pre.start || toInput(new Date(Math.ceil(Date.now() / HOUR) * HOUR));
  const l = editingLoan || { type: 'loan', vehicleId: pre.vehicleId || db.vehicles[0]?.id, customer: '', staff: '', start: startDefault,
    end: pre.end || toInput(new Date(parse(startDefault).getTime() + 4 * HOUR)), undecided: false, returned: false, cancelled: false, note: '' };
  f.type.value = l.type; f.vehicleId.value = l.vehicleId; f.customer.value = l.customer; f.staff.value = l.staff;
  f.start.value = l.start; f.end.value = l.end; f.undecided.checked = !!l.undecided; f.returned.checked = !!l.returned;
  f.cancelled.checked = !!l.cancelled; f.note.value = l.note;
  syncLoanForm(); loanDlg.showModal();
}
function readLoan() {
  const f = loanForm.elements;
  return { ...(editingLoan || {}), type: f.type.value, vehicleId: f.vehicleId.value, customer: f.customer.value.trim(), staff: f.staff.value,
    start: f.start.value, end: f.undecided.checked ? '' : f.end.value, undecided: f.undecided.checked, returned: f.returned.checked,
    cancelled: f.cancelled.checked, note: f.note.value.trim() };
}
function syncLoanForm() {
  const f = loanForm.elements;
  f.end.disabled = f.undecided.checked;
  const l = readLoan(), w = $('#loanWarn'), msgs = [];
  if (l.start) {
    const c = conflicts({ ...l, id: editingLoan?.id || '__new' });
    if (c.length) msgs.push('時間が重複: ' + c.map((o) => `${o.customer || status(o)} ${fmt(o.start)}〜${o.end && !o.undecided ? fmt(o.end) : '未定'}`).join(' / '));
    const ins = inspectionIssue(l); if (ins) msgs.push(ins);
    if (l.end && !l.undecided && parse(l.end) <= parse(l.start)) msgs.push('終了が開始以前になっています');
  }
  w.hidden = !msgs.length; w.className = 'warn' + (msgs[0]?.startsWith('時間が重複') ? ' err' : ''); w.innerHTML = msgs.map(esc).join('<br>');
}
loanForm.addEventListener('input', syncLoanForm);
loanForm.addEventListener('change', syncLoanForm);
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]'); if (!b) return;
  const f = loanForm.elements;
  const s = parse(f.start.value) || new Date();
  const p = b.dataset.preset;
  let end;
  if (p === 'eod') { end = new Date(s); end.setHours(18, 0, 0, 0); if (end <= s) end = new Date(s.getTime() + 2 * HOUR); }
  else end = new Date(s.getTime() + { h2: 2 * HOUR, h4: 4 * HOUR, d1: DAY, d3: 3 * DAY }[p]);
  f.undecided.checked = false; f.end.value = toInput(end); syncLoanForm();
});
$('#loanCancel').onclick = () => loanDlg.close();
$('#loanDelete').onclick = async () => { if (await ask('この貸出を削除します（取消にする場合は「取消」にチェック）。よろしいですか？')) { db.loans = db.loans.filter((l) => l !== editingLoan); save(); loanDlg.close(); render(); } };
loanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const l = readLoan();
  if (!l.start) return notify('開始日時を入力してください');
  if (!l.undecided && l.end && parse(l.end) <= parse(l.start)) return notify('終了は開始より後にしてください');
  if (l.returned && !l.returnedAt) l.returnedAt = toInput(new Date());
  if (!l.returned) delete l.returnedAt;
  const c = conflicts({ ...l, id: editingLoan?.id || '__new' });
  if (c.length && !(await ask('同じ車で時間が重複しています。それでも保存しますか？'))) return;
  if (editingLoan) Object.assign(editingLoan, l);
  else db.loans.push({ ...l, id: 'L' + Date.now().toString(36) });
  save(); loanDlg.close(); render();
});

// ---------- 車両ダイアログ ----------
const vehDlg = $('#vehDlg'), vehForm = $('#vehForm');
let editingVeh = null;
function openVeh(id) {
  editingVeh = id ? vehicle(id) : null;
  const f = vehForm.elements;
  const v = editingVeh || { id: 'V' + pad(db.vehicles.length + 1), name: '', plate: '', category: '代車', inspection: '', active: true, note: '' };
  $('#vehTitle').textContent = editingVeh ? '車両を編集' : '車両を追加';
  $('#vehDelete').hidden = !editingVeh;
  f.id.value = v.id; f.name.value = v.name; f.plate.value = v.plate; f.category.value = v.category;
  f.inspection.value = v.inspection; f.active.checked = v.active !== false; f.note.value = v.note;
  renderVehHistory();
  vehDlg.showModal();
}
function renderVehHistory() {
  const sec = $('#vehHist');
  sec.hidden = !editingVeh;
  if (!editingVeh) return;
  const all = db.loans.filter((l) => l.vehicleId === editingVeh.id).sort((a, b) => b.start.localeCompare(a.start));
  const valid = all.filter((l) => !l.cancelled && l.type === 'loan');
  const now = Date.now();
  const days = valid.reduce((sum, l) => sum + (Math.min(span(l)[1], now) - Math.min(span(l)[0], now)) / DAY, 0);
  $('#vehHistSum').textContent = all.length
    ? `貸出 ${valid.length}件 ／ 累計 ${days.toFixed(1)}日 ／ 最終 ${fmt(valid[0]?.start || all[0].start)}`
    : 'まだ履歴はありません';
  $('#vehHistList').innerHTML = all.map((l) => {
    const st = status(l);
    const t = l.type === 'loan' ? esc(l.customer || '（名前なし）') : st;
    return `<li class="click" data-hist="${l.id}" tabindex="0">${badge(st)}<span class="grow"><b>${t}</b> <span class="muted">${esc(l.staff)}</span></span><span class="muted" style="white-space:normal;text-align:right">${fmt(l.start)} → ${l.end && !l.undecided ? fmt(l.end) : '未定'}</span></li>`;
  }).join('') || '<li class="empty-note">なし</li>';
}
$('#vehHistList').addEventListener('click', (e) => {
  const li = e.target.closest('[data-hist]'); if (!li) return;
  vehDlg.close(); openLoan(li.dataset.hist);
});
$('#vehCancel').onclick = () => vehDlg.close();
$('#vehDelete').onclick = async () => {
  if (loansOf(editingVeh.id).length) return notify('この車には貸出履歴があるため削除できません。「使用中」のチェックを外してください。');
  if (await ask('この車両を削除します。よろしいですか？')) { db.vehicles = db.vehicles.filter((v) => v !== editingVeh); save(); vehDlg.close(); render(); }
};
vehForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = vehForm.elements;
  const v = { id: f.id.value.trim(), name: f.name.value.trim(), plate: f.plate.value.trim(), category: f.category.value,
    inspection: f.inspection.value, active: f.active.checked, note: f.note.value.trim() };
  if (!v.id || !v.name) return;
  if (db.vehicles.some((o) => o !== editingVeh && o.id === v.id)) return notify('同じ車両IDが既にあります');
  if (!editingVeh && db.vehicles.length >= 30) return notify('車両は30台までです');
  if (editingVeh) {
    if (editingVeh.id !== v.id) db.loans.forEach((l) => { if (l.vehicleId === editingVeh.id) l.vehicleId = v.id; });
    Object.assign(editingVeh, v);
  } else db.vehicles.push(v);
  save(); vehDlg.close(); render();
});

// ---------- 起動 ----------
$('#nav').onclick = (e) => { const b = e.target.closest('button'); if (b) { ui.view = b.dataset.view; window.scrollTo(0, 0); render(); } };
$('#newLoan').onclick = () => openLoan(null);
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS.includes(h) && h !== ui.view) { ui.view = h; render(); } });
load();
if (VIEWS.includes(location.hash.slice(1))) ui.view = location.hash.slice(1);
render();
setInterval(() => { if (!document.querySelector('dialog[open]') && ui.view !== 'search' && !document.activeElement.matches('input,select,textarea')) render(); }, 60000);
