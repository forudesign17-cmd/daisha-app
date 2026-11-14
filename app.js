'use strict';
/* 代車管理 — 素のJS + localStorage の試作 */

// ---------- 保存 ----------
const KEY = 'daisha-v1';
const HOUR = 3600e3, DAY = 24 * HOUR, FAR = 3650 * DAY;
let db;

function seed() {
  // デモ用サンプル（20台）。日付は「今日」からの相対なので、いつ開いても今の状況に見える
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const at = (d, h) => toInput(new Date(today.getTime() + d * DAY + h * HOUR));
  const date = (d) => at(d, 0).slice(0, 10);
  const kana = 'あいうえおかきくけこさしすせそたちつてと';
  // [車名, 登録区分, 車検まで(日), 前回オイル交換(日前), 前回交換km, 現在km]
  const cars = [
    ['ミライース', '代車', 200, 170, 42000, 46800], ['タント', '代車', 20, 60, 31000, 32500], ['フィット', 'レンタカー', 120, 220, 58000, 61000],
    ['アルト', '代車', -3, 90, 22000, 24000], ['ノート', '代車', 310, 40, 15000, 16200], ['ヤリス', 'レンタカー', 150, 70, 9000, 11000],
    ['N-BOX', '代車', 240, 100, 27000, 31600], ['ムーヴ', '代車', 95, 30, 18000, 19000], ['ワゴンR', '代車', 12, 50, 36000, 38000],
    ['スイフト', '代車', 280, 80, 12000, 14000], ['アクア', 'レンタカー', 60, 120, 40000, 43000], ['プリウス', '代車', 330, 230, 52000, 55500],
    ['カローラ', 'レンタカー', 180, 45, 20000, 21500], ['ハスラー', '代車', 130, 65, 8000, 10000], ['デイズ', '代車', 220, 20, 5000, 5800],
    ['ソリオ', '代車', 75, 110, 33000, 36000], ['ジムニー', '代車', 260, 55, 14000, 15500], ['ルーミー', 'レンタカー', 400, 35, 10000, 11200],
    ['ステップワゴン', '代車', 170, 85, 45000, 48000], ['セレナ', '代車', 90, 25, 26000, 27000],
  ];
  const vehicles = cars.map(([name, category, insp, oilAgo, oilKm, odo], i) => ({
    id: 'V' + pad(i + 1), name, category,
    plate: `品川 ${category === 'レンタカー' ? '500 わ' : '500 ' + kana[i]} ${10 + ((i * 7) % 80)}-${10 + ((i * 13) % 80)}`,
    inspection: date(insp), active: true, note: category === 'レンタカー' ? 'レンタカー保険加入' : '',
    oilLastDate: date(-oilAgo), oilLastKm: oilKm, odo, oilMonths: 6, oilKm: 5000,
  }));
  const L = (n, v, customer, staff, start, end, o = {}) => ({
    id: 'L' + n, type: 'loan', vehicleId: 'V' + pad(v), customer, staff, start, end, undecided: false, returned: false, cancelled: false, note: '', purpose: 'normal', ...o,
  });
  const loans = [
    L(1, 1, '山田様', '佐藤', at(0, 9), at(0, 17), { note: '車検入庫' }),
    L(2, 2, '高橋様', '鈴木', at(-9, 10), '', { undecided: true, note: '板金修理（部品待ち）' }),
    L(3, 3, '伊藤様', '田中', at(0, 13), at(3, 12), { purpose: 'insurance', note: '事故修理（保険対応）' }),
    L(4, 4, '', '田中', at(0, 10), at(2, 17), { type: 'ng', note: '点検整備' }),
    L(5, 5, '渡辺様', '佐藤', at(-2, 9), at(-1, 15), { note: '返却連絡待ち' }),
    L(6, 6, '中村様', '鈴木', at(-1, 10), at(1, 17), { purpose: 'insurance', note: '保険対応' }),
    L(7, 7, '小林様', '田中', at(1, 9), at(1, 18)),
    L(8, 8, '社用', '田中', at(0, 13), at(0, 15), { type: 'corp', note: '納車の引き取り' }),
    L(9, 9, '加藤様', '佐藤', at(0, 10), at(0, 16)),
    L(10, 10, '吉田様', '鈴木', at(2, 9), at(4, 12)),
    L(11, 11, '山本様', '田中', at(0, 9), at(2, 17), { purpose: 'insurance', note: '保険対応' }),
    L(12, 12, '松本様', '佐藤', at(1, 13), at(1, 19)),
    L(13, 12, '井上様', '鈴木', at(3, 9), at(3, 15)),
    L(14, 13, '清水様', '田中', at(-3, 10), at(-2, 12), { purpose: 'insurance', returned: true, returnedAt: at(-2, 11) }),
    L(15, 13, '森田様', '鈴木', at(3, 10), at(5, 18), { purpose: 'insurance' }),
    L(16, 14, '木村様', '田中', at(-4, 13), '', { undecided: true, purpose: 'insurance', note: '保険修理・部品待ち（登録区分の注意の例）' }),
    L(17, 16, '斉藤様', '佐藤', at(0, 11), at(1, 10)),
    L(18, 17, '林様', '鈴木', at(2, 10), at(2, 18)),
    L(19, 18, '山崎様', '田中', at(1, 9), at(3, 17), { purpose: 'insurance', note: '保険対応' }),
    L(20, 19, '森様', '佐藤', at(-1, 13), at(0, 12)),
    L(21, 20, '池田様', '鈴木', at(4, 9), at(4, 17)),
  ];
  return { settings: { prepHours: 1, dayStart: 8, dayEnd: 20 }, staff: ['佐藤', '鈴木', '田中'], vehicles, loans };
}
// 古い形式・壊れたデータでも動くように、足りない項目を補う
function normalizeDb(d) {
  d.settings = { prepHours: 1, dayStart: 8, dayEnd: 20, ...(d.settings || {}) };
  if (!(Number(d.settings.dayEnd) > Number(d.settings.dayStart))) { d.settings.dayStart = 8; d.settings.dayEnd = 20; }
  d.staff = Array.isArray(d.staff) ? d.staff : [];
  d.vehicles = (Array.isArray(d.vehicles) ? d.vehicles : []).filter((v) => v && v.id);
  d.loans = (Array.isArray(d.loans) ? d.loans : []).filter((l) => l && l.id && l.start && !Number.isNaN(new Date(l.start).getTime()));
  return d;
}
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !Array.isArray(db.vehicles)) { db = seed(); save(); } else normalizeDb(db);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 保存不可の環境ではメモリのみ */ } }

// alert/confirm の代わり（アーティファクトのビューアでは使えないため）
function notify(msg, undo) {
  const t = document.getElementById('toast');
  t.textContent = msg + ' ';
  if (undo) {
    const b = document.createElement('button');
    b.className = 'toast-btn'; b.textContent = '元に戻す';
    b.onclick = () => { undo(); t.hidden = true; };
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(notify.t); notify.t = setTimeout(() => { t.hidden = true; }, undo ? 8000 : 3500);
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
// ---- オイル交換 ----
const hasNum = (x) => x !== '' && x != null && !Number.isNaN(Number(x));
function oilInfo(v) {
  if (!v || !v.oilLastDate) return null;
  const d0 = new Date(v.oilLastDate + 'T00:00');
  if (Number.isNaN(d0.getTime())) return null;
  const due = new Date(d0.getFullYear(), d0.getMonth() + (Number(v.oilMonths) || 6), 1);
  due.setDate(Math.min(d0.getDate(), new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate())); // 月末はその月の末日に丸める
  const daysLeft = Math.ceil((due - dayStart(ymd(new Date()))) / DAY);
  const kmLeft = hasNum(v.odo) && hasNum(v.oilLastKm) ? Number(v.oilLastKm) + (Number(v.oilKm) || 5000) - Number(v.odo) : null;
  const over = daysLeft < 0 || (kmLeft !== null && kmLeft <= 0);
  const soon = !over && (daysLeft <= 30 || (kmLeft !== null && kmLeft <= 500));
  return { due: ymd(due), daysLeft, kmLeft, level: over ? 'over' : soon ? 'soon' : 'ok' };
}
function oilText(o) {
  if (!o) return '未登録';
  const d = o.daysLeft < 0 ? `${-o.daysLeft}日超過` : `あと${o.daysLeft}日`;
  const k = o.kmLeft === null ? '' : o.kmLeft <= 0 ? ` ／ ${-o.kmLeft}km超過` : ` ／ あと${o.kmLeft}km`;
  return `${o.due}まで（${d}${k}）`;
}
function oilBadge(v) {
  const o = oilInfo(v);
  if (!o || o.level === 'ok') return '';
  return `<span class="badge oil-${o.level}" title="${esc(oilText(o))}">オイル${o.level === 'over' ? '超過' : '間近'}</span>`;
}
// ---- 登録区分と用途（保険対応）の食い違い ----
function purposeIssue(l) {
  if (!l || l.type !== 'loan' || l.cancelled) return '';
  const v = vehicle(l.vehicleId); if (!v) return '';
  const ins = l.purpose === 'insurance';
  if (v.category === 'レンタカー' && !ins) return 'レンタカー登録の車を、保険対応以外で貸し出そうとしています';
  if (v.category === '代車' && ins) return '代車登録の車を、保険対応で貸し出そうとしています（レンタカー登録が必要な場合があります）';
  return '';
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
  const h = ui.tv ? 'tv' : ui.view;
  if (location.hash.slice(1) !== h) history.replaceState(null, '', '#' + h);
  document.body.classList.toggle('tv', !!ui.tv);
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  const t = new Date(); $('#today').textContent = `${t.getMonth() + 1}月${t.getDate()}日（${WD[t.getDay()]}）`;
  const fn = { dashboard, day: dayView, period: periodView, ledger, search: searchView, master }[ui.view];
  const sx = window.scrollX, sy = window.scrollY;
  const old = $('.board'), sl = old ? old.scrollLeft : 0, st = old ? old.scrollTop : 0;
  main.innerHTML = fn();
  window.scrollTo(sx, sy);
  const bd = $('.board');
  if (bd) {
    if (ui.center && ui.view === 'day') centerNow(bd);
    else { bd.scrollLeft = sl; bd.scrollTop = st; }
    ui.center = false;
  }
  const after = { day: bindBoard, period: bindBoard, ledger: bindLedger, search: bindSearch, master: bindMaster, dashboard: bindLedger }[ui.view];
  if (after) after();
  ui.anim = false; // 画面切り替えの演出は行わない（動きは「持ち上げ」と保存時の着地に絞る）
  if (ui.flash) flashItem(ui.flash);
  ui.flash = null;
}
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp() {
  if (reduceMotion()) return;
  main.querySelectorAll('.stat .n').forEach((el) => {
    if (el.childNodes.length !== 1 || !/^\d+$/.test(el.textContent)) return;
    const to = Number(el.textContent); if (to < 1) return;
    const t0 = performance.now(), dur = 520;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = '0'; requestAnimationFrame(step);
  });
}
// 保存・移動した貸出を一瞬ハイライト（確認になる）
function flashItem(id) {
  const els = [...document.querySelectorAll(`[data-id="${id}"],tr[data-edit="${id}"]`)];
  if (!els.length) return;
  try { els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* 無視 */ }
  els.forEach((el) => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
  setTimeout(() => els.forEach((el) => el.classList.remove('flash')), 1300);
}
function centerNow(bd) {
  const nl = bd.querySelector('.nowline');
  if (!nl) return;
  const r = nl.getBoundingClientRect(), b = bd.getBoundingClientRect();
  bd.scrollLeft = Math.max(0, r.left - b.left + bd.scrollLeft - bd.clientWidth / 2);
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
  const oilList = activeVehicles().map((v) => ({ v, o: oilInfo(v) })).filter((x) => x.o && x.o.level !== 'ok').sort((a, b) => a.o.daysLeft - b.o.daysLeft);
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
    <div class="card stat ${oilList.length ? 'warn-card' : ''}"><div class="n">${oilList.length}</div><div class="l">オイル交換が必要</div></div>
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
    <div class="card"><h3>オイル交換の時期（30日以内・500km以内・超過）</h3><ul class="list">${oilList.map(({ v, o }) => `<li class="click oil" data-vedit="${esc(v.id)}">${catBadge(v.category)}<span class="grow"><b>${esc(v.name)}</b> <span class="muted">${esc(v.plate)}</span></span>${oilBadge(v)}<span class="detail ${o.level === 'over' ? 'red' : 'muted'}">${esc(oilText(o))}</span></li>`).join('') || '<li class="empty-note">なし</li>'}</ul></div>
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
function vehDiv(v) {
  return `<div class="veh" data-vedit="${esc(v.id)}"><div class="nm">${catBadge(v.category)} ${esc(v.name)}</div><div class="pl">${esc(v.plate)}</div>${oilBadge(v) ? `<div class="oilrow">${oilBadge(v)}</div>` : ''}</div>`;
}

// ---------- ボード（分単位の棒・現在時刻ライン） ----------
const pct = (t, rs, re) => ((t - rs) / (re - rs)) * 100;
function barPos(s, e, rs, re) {
  const cs = Math.max(s, rs), ce = Math.min(e, re);
  return `left:${pct(cs, rs, re)}%;width:${pct(ce, rs, re) - pct(cs, rs, re)}%`;
}
function layoutBars(v, rs, re) {
  const items = loansOf(v.id).map((l) => { const [s, e] = span(l); return { l, s, e }; })
    .filter((x) => x.s < re && x.e > rs).sort((a, b) => a.s - b.s);
  const laneEnds = [];
  for (const it of items) {
    let k = laneEnds.findIndex((end) => end <= it.s);
    if (k < 0) { k = laneEnds.length; laneEnds.push(0); }
    laneEnds[k] = it.e; it.lane = k;
  }
  const preps = [];
  if (prepMs()) {
    for (const l of loansOf(v.id)) {
      if (l.type !== 'loan' || l.undecided || !l.end) continue;
      const e = span(l)[1];
      if (e < re && e + prepMs() > rs) preps.push([e, e + prepMs()]);
    }
  }
  return { items, preps, lanes: Math.max(1, laneEnds.length) };
}
function hm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function barItem(it, lanes, rs, re) {
  const { l, s, e, lane } = it;
  const st = status(l), open = l.undecided || !l.end;
  const cls = ['bar', 's-' + SCLS[st], s < rs ? 'cl' : '', e > re ? 'cr' : '', l.returned ? 'lock' : ''].filter(Boolean).join(' ');
  const who = l.type === 'loan' ? (l.customer || '（名前なし）') : st;
  const sd = new Date(s), ed = new Date(e), same = ymd(sd) === ymd(ed);
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()} ${hm(d)}`;
  const tm = open ? `${md(sd)}〜未定` : same ? `${hm(sd)}〜${hm(ed)}` : `${md(sd)}〜${md(ed)}`;
  const tip = `${st} ${l.customer || ''}\n${fmt(l.start)} → ${open ? '未定' : fmt(l.end)}`;
  const lanePos = `top:calc(7px + (100% - 14px) * ${lane} / ${lanes});height:calc((100% - 14px) / ${lanes} - ${lanes > 1 ? 2 : 0}px)`;
  return `<div class="${cls}" data-id="${l.id}" ${l.returned ? 'data-lock="1"' : ''} tabindex="0" title="${esc(tip)}" style="${barPos(s, e, rs, re)};${lanePos}"><i class="h hl"></i><b>${SCODE[st]}</b><span class="t">${esc(who)}</span><span class="tm">${tm}</span>${open || l.returned ? '' : '<i class="h hr"></i>'}</div>`;
}
function boardHtml(o) {
  const { rs, re } = o, vs = activeVehicles(ui.cat), now = Date.now();
  const nowLine = now >= rs && now < re ? `<i class="nowline" style="left:${pct(now, rs, re)}%"></i>` : '';
  const rows = vs.map((v, i) => {
    const { items, preps, lanes } = layoutBars(v, rs, re);
    return `<div class="row" style="--i:${Math.min(i, 14)}">${vehDiv(v)}<div class="track" data-v="${esc(v.id)}">${o.shades}${preps.map(([a, b]) => `<div class="bar prep s-prep" style="${barPos(a, b, rs, re)}"><span class="t">準備</span></div>`).join('')}${items.map((it) => barItem(it, lanes, rs, re)).join('')}${nowLine}</div></div>`;
  }).join('');
  return `<div class="board" data-rs="${rs}" data-re="${re}" style="--n:${o.n};--m:${o.m};--rows:${Math.max(vs.length, 1)}">
    <div class="bi" style="min-width:calc(var(--vw) + ${o.minTrack}px)">
      <div class="row head"><div class="veh">車両</div><div class="scale">${o.scale}${nowLine}</div></div>
      ${rows || '<div class="empty-note" style="padding:20px">表示できる車両がありません。「車両マスタ」から追加してください。</div>'}
    </div></div>${legend()}`;
}
function tvBar() {
  const now = new Date(), nowT = now.getTime();
  const live = db.loans.filter((l) => !l.cancelled && !l.returned && l.type === 'loan');
  const busy = new Set(db.loans.filter((l) => !l.cancelled).filter((l) => { const o = occ(l); return o[0] <= nowT && nowT < o[1]; }).map((l) => l.vehicleId));
  const free = activeVehicles().filter((v) => !busy.has(v.id)).length;
  const late = live.filter((l) => status(l) === '遅延').length;
  const out = live.filter((l) => ['貸出中', '遅延', '返却未定'].includes(status(l))).length;
  return `<div class="tvbar">
    <div class="clock"><b id="tvClock">${hm(now)}</b><span>${now.getMonth() + 1}月${now.getDate()}日（${WD[now.getDay()]}）</span></div>
    <div class="tvstats"><span><b>${out}</b>貸出中</span><span><b>${free}</b>空き</span><span class="${late ? 'late' : ''}"><b>${late}</b>遅延</span></div>
    <span class="spacer"></span>
    <div class="chips">${[['day', '日別'], ['period', '期間']].map(([v, t]) => `<button class="chip ${ui.view === v ? 'on' : ''}" data-tvview="${v}">${t}</button>`).join('')}</div>
    ${catChips()}
    <button class="btn" id="tvExit">終了（Esc）</button>
  </div>`;
}

// ---------- 日別 ----------
function dayView() {
  const { dayStart: h0, dayEnd: h1 } = db.settings;
  const base = dayStart(ui.day).getTime();
  const n = h1 - h0, rs = base + h0 * HOUR, re = base + h1 * HOUR;
  const nowH = ymd(new Date()) === ui.day ? new Date().getHours() : -1;
  const scale = Array.from({ length: n }, (_, i) => `<span class="tick ${h0 + i === nowH ? 'today' : ''}" style="left:${(i / n) * 100}%">${h0 + i}:00</span>`).join('');
  const d = dayStart(ui.day);
  const bar = ui.tv ? tvBar() : `
  <div class="toolbar">
    <h2>日別ビュー</h2>
    <button class="btn icon" data-step="-1" aria-label="前の日">‹</button>
    <input type="date" id="dayPick" value="${ui.day}">
    <button class="btn icon" data-step="1" aria-label="次の日">›</button>
    <button class="btn" data-today>今日</button>
    <b>${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）</b>
    <span class="hint">空きをドラッグで予約 ／ 棒をドラッグで移動・端で時間変更</span>
    <span class="hint touch-hint">棒や空きを長押ししてから動かすと、移動・予約作成ができます</span>
    <span class="spacer"></span>${catChips()}
  </div>`;
  return bar + boardHtml({ rs, re, n, m: n * 2, minTrack: n * 64, scale, shades: '' });
}

// ---------- 期間 ----------
function periodView() {
  const base = dayStart(ui.pStart).getTime();
  const nd = ui.pDays, rs = base, re = base + nd * DAY;
  const days = Array.from({ length: nd }, (_, i) => new Date(base + i * DAY));
  const today = ymd(new Date());
  const scale = days.map((d) => `<span class="dh ${ymd(d) === today ? 'today' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'wk' : ''}">${d.getMonth() + 1}/${d.getDate()}<small>${WD[d.getDay()]}</small></span>`).join('');
  const shades = days.map((d, i) => {
    const cls = ymd(d) === today ? 'tcol' : d.getDay() === 0 || d.getDay() === 6 ? 'wk' : '';
    return cls ? `<i class="shade ${cls}" style="left:${(i / nd) * 100}%;width:${100 / nd}%"></i>` : '';
  }).join('');
  const bar = ui.tv ? tvBar() : `
  <div class="toolbar">
    <h2>期間ボード</h2>
    <button class="btn" data-step="-7">‹ 1週</button>
    <input type="date" id="pPick" value="${ui.pStart}">
    <button class="btn" data-step="7">1週 ›</button>
    <button class="btn" data-today>今日</button>
    <select id="pDays">${[7, 14, 21, 28].map((k) => `<option value="${k}" ${k === ui.pDays ? 'selected' : ''}>${k}日間</option>`).join('')}</select>
    <span class="spacer"></span>${catChips()}
  </div>`;
  return bar + boardHtml({ rs, re, n: nd, m: nd * 2, minTrack: nd * 76, scale, shades });
}

// ---------- ボードの操作 ----------
function bindBoard() {
  const go = () => { ui.center = ui.anim = true; render(); };
  const step = (n) => {
    if (ui.view === 'day') ui.day = ymd(new Date(dayStart(ui.day).getTime() + n * DAY + 12 * HOUR));
    else ui.pStart = ymd(new Date(dayStart(ui.pStart).getTime() + n * DAY + 12 * HOUR));
    go();
  };
  main.querySelectorAll('[data-step]').forEach((b) => b.onclick = () => step(Number(b.dataset.step)));
  main.querySelectorAll('[data-today]').forEach((b) => b.onclick = () => { ui.day = ui.pStart = ymd(new Date()); go(); });
  const dp = $('#dayPick'); if (dp) dp.onchange = () => { if (dp.value) { ui.day = dp.value; go(); } };
  const pp = $('#pPick'); if (pp) pp.onchange = () => { if (pp.value) { ui.pStart = pp.value; render(); } };
  const pd = $('#pDays'); if (pd) pd.onchange = () => { ui.pDays = Number(pd.value); render(); };
  main.querySelectorAll('[data-vedit]').forEach((c) => c.onclick = () => openVeh(c.dataset.vedit));
  main.querySelectorAll('[data-cat]').forEach((c) => c.onclick = () => { ui.cat = c.dataset.cat; render(); });
  main.querySelectorAll('[data-tvview]').forEach((c) => c.onclick = () => { ui.view = c.dataset.tvview; ui.center = ui.anim = true; render(); });
  const ex = $('#tvExit'); if (ex) ex.onclick = exitTv;
  initDrag();
}

// ---------- ボード表示（大画面）モード ----------
function enterTv() {
  ui.tv = true;
  if (!['day', 'period'].includes(ui.view)) ui.view = 'day';
  ui.day = ymd(new Date()); ui.pStart = ymd(new Date()); ui.center = ui.anim = true;
  try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 全画面にできなくても続行 */ }
  render();
}
function exitTv() {
  ui.tv = false;
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* 無視 */ }
  render();
}

// ---------- ドラッグ操作（作成・移動・時間変更） ----------
let dragging = false, suppressClick = false, touchDrag = false;
const snapMs = () => (ui.view === 'day' ? 15 * 60e3 : HOUR);
const snapT = (t) => Math.round(t / snapMs()) * snapMs();
function timeAt(track, x) {
  const bd = $('.board'), rs = Number(bd.dataset.rs), re = Number(bd.dataset.re);
  const r = track.getBoundingClientRect();
  return rs + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (re - rs);
}
function placeBar(el, s, e) {
  const bd = $('.board'), rs = Number(bd.dataset.rs), re = Number(bd.dataset.re);
  const cs = Math.max(s, rs), ce = Math.min(e, re);
  el.style.left = pct(cs, rs, re) + '%';
  el.style.width = Math.max(0, pct(ce, rs, re) - pct(cs, rs, re)) + '%';
  el.classList.toggle('cl', s < rs); el.classList.toggle('cr', e > re);
}
// 触覚フィードバック: Android は vibrate、iPhone(iOS 17.4+) は switch 型チェックボックスのトリックを試す（効かなくても動作に影響なし）
let hapticLabel = null;
function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(14); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.setAttribute('switch', '');
      hapticLabel.appendChild(cb); document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch (e) { /* 無視 */ }
}
function initDrag() {
  const bd = $('.board'); if (!bd) return;
  bd.addEventListener('click', (e) => {
    if (suppressClick) return;
    const bar = e.target.closest('.bar');
    if (bar && bar.dataset.id) return openLoan(bar.dataset.id);
    const track = e.target.closest('.track');
    if (!track) return;
    openLoan(null, { vehicleId: track.dataset.v, start: toInput(new Date(snapT(timeAt(track, e.clientX)))) });
  });
  bd.addEventListener('keydown', (e) => {
    const bar = e.target.closest && e.target.closest('.bar');
    if (bar && bar.dataset.id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLoan(bar.dataset.id); }
  });
  // ---- ドラッグ（マウス: ポインタイベント / タッチ: 長押し後にタッチイベントで制御） ----
  bd.addEventListener('contextmenu', (e) => { if (e.target.closest('.bar')) e.preventDefault(); });

  function makeSession(target, x0, y0, touch) {
    const track = target.closest('.track'); if (!track) return null;
    const bar = target.closest('.bar');
    let mode = 'create', loan = null, orig = null;
    if (bar && bar.dataset.id) {
      loan = db.loans.find((l) => l.id === bar.dataset.id);
      if (!loan || bar.dataset.lock) return null;
      mode = target.classList.contains('hl') ? 'rl' : target.classList.contains('hr') ? 'rr' : 'move';
      const [s, en] = span(loan);
      orig = { s, e: en, hasEnd: !(loan.undecided || !loan.end) };
    }
    let sx = x0, sy = y0, lx = x0, ly = y0;
    let anchor = snapT(timeAt(track, sx)), grab = timeAt(track, sx);
    let moved = false, ghost = null, result = null, curTrack = track, armed = !touch, edgeTimer = null;
    // 長押しの途中経過を見せる（iPhone は振動が使えないので、見た目で「押している」「持ち上がった」を伝える）
    let ring = null, slot = null;
    const clearPress = () => { if (bar) bar.classList.remove('pressing'); if (ring) { ring.remove(); ring = null; } };
    const spawn = (cls) => {
      const r = track.getBoundingClientRect(), el = document.createElement('i');
      el.className = cls; el.style.left = (x0 - r.left) + 'px'; el.style.top = (y0 - r.top) + 'px';
      track.appendChild(el); return el;
    };
    if (touch) { if (bar) bar.classList.add('pressing'); else ring = spawn('hold-ring'); }

    let rot = 0, prevX = x0, decayT = null;
    const tilt = (x) => { // 動かす向きにわずかに傾けて、「手で持っている」感じを出す
      if (!bar || mode !== 'move') return;
      rot = rot * 0.6 + Math.max(-3.5, Math.min(3.5, (x - prevX) * 0.5)) * 0.4; prevX = x;
      bar.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      clearTimeout(decayT); decayT = setTimeout(() => { rot = 0; bar.style.setProperty('--rot', '0deg'); }, 110);
    };
    const apply = (x, y) => {
      const dt = timeAt(track, x) - grab;
      if (mode === 'create') {
        let a = anchor, b = snapT(timeAt(track, x));
        if (a > b) [a, b] = [b, a];
        if (b - a < snapMs()) b = a + snapMs();
        result = { s: a, e: b }; placeBar(ghost, a, b);
      } else if (mode === 'move') {
        const ns = snapT(orig.s + dt), shift = ns - orig.s;
        const t2 = document.elementsFromPoint(x, y).find((el) => el.classList && el.classList.contains('track'));
        if (t2 && t2 !== curTrack) { curTrack = t2; t2.appendChild(bar); bar.style.top = '7px'; bar.style.height = 'calc(100% - 14px)'; }
        result = { s: ns, e: orig.e + shift, vid: curTrack.dataset.v }; placeBar(bar, result.s, result.e);
      } else if (mode === 'rl') {
        const ns = Math.min(snapT(orig.s + dt), (orig.hasEnd ? orig.e : Infinity) - snapMs());
        result = { s: ns, e: orig.e }; placeBar(bar, ns, orig.e);
      } else {
        const ne = Math.max(snapT(orig.e + dt), orig.s + snapMs());
        result = { s: orig.s, e: ne }; placeBar(bar, orig.s, ne);
      }
    };
    const begin = () => {
      moved = true; dragging = true; document.body.classList.add('dragging');
      if (bar) {
        // 元の位置に点線の「抜け跡」を残し、棒を浮かせる（持ち上げた感じを出す）
        slot = document.createElement('div'); slot.className = 'bar slot'; slot.style.cssText = bar.style.cssText;
        bar.parentNode.insertBefore(slot, bar);
        if (touch) bar.classList.add('touch'); // 指で隠れないよう、少し上に浮かせる
        bar.classList.add('drag');
      }
      else { ghost = document.createElement('div'); ghost.className = 'bar ghost'; track.appendChild(ghost); }
      edgeTimer = setInterval(() => { // 端に近づいたらボードを自動スクロール
        const r = bd.getBoundingClientRect(), vw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vw')) || 0;
        if (lx < r.left + vw + 28) bd.scrollLeft -= 14; else if (lx > r.right - 28) bd.scrollLeft += 14; else return;
        apply(lx, ly);
      }, 30);
    };
    const dispose = () => {
      clearInterval(edgeTimer); clearTimeout(decayT); touchDrag = false; document.body.classList.remove('dragging'); clearPress();
      if (slot) { slot.remove(); slot = null; }
      if (bar) bar.classList.remove('touch');
    };
    return {
      arm() { // タッチ: 長押し成立
        armed = true; sx = lx; sy = ly; anchor = snapT(timeAt(track, sx)); grab = timeAt(track, sx);
        clearPress();
        if (!bar) { const pop = spawn('hold-pop'); setTimeout(() => pop.remove(), 600); }
        begin();
        haptic();
      },
      move(x, y) { // 戻り値 false = ドラッグ不成立（スクロール扱い）
        lx = x; ly = y;
        if (!armed) return !(Math.abs(x - sx) > 8 || Math.abs(y - sy) > 8);
        if (!moved) {
          if (Math.abs(x - sx) < 4 && (mode === 'create' || Math.abs(y - sy) < 6)) return true;
          begin();
        }
        apply(x, y);
        return true;
      },
      isTap() { return touch && !armed && !moved; },
      tap() { // iPhone Safari は委譲された click が届かないことがあるため、タップは自前で処理
        dispose();
        if (bar && loan) openLoan(loan.id);
        else openLoan(null, { vehicleId: track.dataset.v, start: toInput(new Date(snapT(timeAt(track, lx)))) });
      },
      async up() {
        dispose();
        if (!moved) return;
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
        if (ghost) ghost.remove();
        if (!result) { if (bar) bar.classList.remove('drag'); dragging = false; return; } // 長押しだけで動かさなかった
        if (mode === 'create') {
          dragging = false;
          openLoan(null, { vehicleId: track.dataset.v, start: toInput(new Date(result.s)), end: toInput(new Date(result.e)) });
          return;
        }
        await commitMove(loan, mode, result, orig);
        dragging = false;
      },
    };
  }

  // マウス
  bd.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const s = makeSession(e.target, e.clientX, e.clientY, false); if (!s) return;
    const mv = (ev) => s.move(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      s.up();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });

  // タッチ（長押し 0.4 秒でドラッグ開始。それまではスクロール／タップ）
  let ts = null, holdTimer = null;
  const endTouch = (cancelled) => {
    clearTimeout(holdTimer);
    const s = ts; ts = null;
    if (!s) return;
    if (cancelled !== true && s.isTap()) {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 400); // 直後の click と二重に開かない
      s.tap();
    } else s.up();
  };
  bd.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { endTouch(true); return; }
    const t = e.touches[0];
    ts = makeSession(e.target, t.clientX, t.clientY, true);
    if (!ts) return;
    const mine = ts;
    holdTimer = setTimeout(() => { if (ts === mine) { touchDrag = true; mine.arm(); } }, 380);
  }, { passive: true });
  bd.addEventListener('touchmove', (e) => {
    if (!ts) return;
    const t = e.touches[0];
    if (ts.move(t.clientX, t.clientY) === false) { endTouch(true); return; } // スクロールとみなして中止
    if (touchDrag && e.cancelable) e.preventDefault();
  }, { passive: false });
  bd.addEventListener('touchend', () => endTouch(false));
  bd.addEventListener('touchcancel', () => endTouch(true));
}
async function commitMove(loan, mode, r, orig) {
  const prev = { vehicleId: loan.vehicleId, start: loan.start, end: loan.end };
  const next = { ...loan, vehicleId: r.vid || loan.vehicleId, start: toInput(new Date(r.s)) };
  if (orig.hasEnd) next.end = toInput(new Date(r.e));
  if (next.vehicleId === prev.vehicleId && next.start === prev.start && next.end === prev.end) { render(); return; }
  if (conflicts(next).length && !(await ask('同じ車で時間が重複します。この位置にしますか？'))) { render(); return; }
  if (next.vehicleId !== prev.vehicleId && purposeIssue(next) && !(await ask(purposeIssue(next) + '。この車に移しますか？'))) { render(); return; }
  Object.assign(loan, { vehicleId: next.vehicleId, start: next.start, end: next.end });
  ui.flash = loan.id;
  save(); render();
  notify(`${vehicle(loan.vehicleId)?.name || ''} ${fmt(loan.start)}〜${loan.end ? fmt(loan.end) : '未定'} に変更しました`,
    () => { Object.assign(loan, prev); save(); render(); });
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
      <td data-label="状態">${badge(st)}${l.type === 'loan' && l.purpose === 'insurance' ? ' <span class="badge ins">保険</span>' : ''}${c.length ? ' <span class="red">時間が重複</span>' : ''}${ins ? ' <span class="red">車検</span>' : ''}${purposeIssue(l) ? ' <span class="red" title="' + esc(purposeIssue(l)) + '">登録区分に注意</span>' : ''}</td>
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
  main.querySelectorAll('[data-vedit]').forEach((r) => r.onclick = () => openVeh(r.dataset.vedit));
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
    if (!Array.isArray(d.vehicles) || !Array.isArray(d.loans)) throw new Error('形式が違います');
    if (!(await ask('現在のデータを上書きして復元します。よろしいですか？'))) return;
    db = normalizeDb(d); save(); render();
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
    <td data-label="オイル">${oilBadge(v) || (oilInfo(v) ? '<span class="muted">OK</span>' : '<span class="muted">未登録</span>')}</td>
    <td data-label="履歴">${loansOf(v.id).filter((l) => l.type === 'loan').length}件</td>
    <td data-label="状態">${v.active === false ? '<span class="muted">停止</span>' : '使用中'}</td><td data-label="メモ" class="muted">${esc(v.note)}</td></tr>`).join('');
  return `
  <div class="toolbar"><h2 style="margin:0">車両マスタ</h2><span class="muted">${db.vehicles.length}台（上限30台）</span><span class="spacer"></span>
    <button class="btn danger" id="demoReset" title="デモ用の20台のサンプルに入れ替えます">サンプルに戻す</button>
    <button class="btn primary" id="vNew">＋ 車両を追加</button></div>
  <div class="card scroll cardwrap" style="padding:6px 10px;margin-bottom:18px"><table class="stack">
    <thead><tr><th>ID</th><th>車名</th><th>ナンバー</th><th>登録区分</th><th>車検期限</th><th>オイル</th><th>履歴</th><th>状態</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table></div>
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
  $('#demoReset').onclick = async () => {
    if (!(await ask('今のデータをすべて消して、デモ用のサンプルデータ（20台）に入れ替えます。よろしいですか？（元に戻せません）'))) return;
    db = seed(); save(); notify('サンプルデータに入れ替えました'); render();
  };
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
  f.cancelled.checked = !!l.cancelled; f.note.value = l.note; f.purpose.value = l.purpose || 'normal';
  syncLoanForm(); loanDlg.showModal();
}
function readLoan() {
  const f = loanForm.elements;
  return { ...(editingLoan || {}), type: f.type.value, vehicleId: f.vehicleId.value, customer: f.customer.value.trim(), staff: f.staff.value,
    start: f.start.value, end: f.undecided.checked ? '' : f.end.value, undecided: f.undecided.checked, returned: f.returned.checked,
    cancelled: f.cancelled.checked, note: f.note.value.trim(), purpose: f.purpose.value };
}
function syncLoanForm() {
  const f = loanForm.elements;
  f.end.disabled = f.undecided.checked;
  const l = readLoan(), w = $('#loanWarn'), msgs = [];
  $('#purposeRow').hidden = l.type !== 'loan';
  const pi = purposeIssue(l); if (pi) msgs.push(pi);
  if (l.start) {
    const c = conflicts({ ...l, id: editingLoan?.id || '__new' });
    if (c.length) msgs.push('時間が重複: ' + c.map((o) => `${o.customer || status(o)} ${fmt(o.start)}〜${o.end && !o.undecided ? fmt(o.end) : '未定'}`).join(' / '));
    const ins = inspectionIssue(l); if (ins) msgs.push(ins);
    const oi = l.type === 'loan' ? oilInfo(vehicle(l.vehicleId)) : null;
    if (oi && oi.level !== 'ok') msgs.push(`この車はオイル交換の時期です（${oilText(oi)}）`);
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
  const pi = purposeIssue(l);
  if (pi && !(await ask(pi + '。このまま保存しますか？'))) return;
  if (editingLoan) { Object.assign(editingLoan, l); if (!l.returned) delete editingLoan.returnedAt; ui.flash = editingLoan.id; }
  else { const nid = 'L' + Date.now().toString(36); db.loans.push({ ...l, id: nid }); ui.flash = nid; }
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
  f.oilLastDate.value = v.oilLastDate || ''; f.oilLastKm.value = hasNum(v.oilLastKm) ? v.oilLastKm : '';
  f.odo.value = hasNum(v.odo) ? v.odo : ''; f.oilMonths.value = v.oilMonths || 6; f.oilKm.value = v.oilKm || 5000;
  updateOilStatus();
  renderVehHistory();
  vehDlg.showModal();
}
function readOil() {
  const f = vehForm.elements, n = (x) => (x.value === '' ? '' : Number(x.value));
  return { oilLastDate: f.oilLastDate.value, oilLastKm: n(f.oilLastKm), odo: n(f.odo), oilMonths: n(f.oilMonths) || 6, oilKm: n(f.oilKm) || 5000 };
}
function updateOilStatus() {
  const o = oilInfo(readOil()), el = $('#oilStatus');
  el.textContent = o ? `次回: ${oilText(o)}` : '前回の交換日を入れると、次回の時期を計算します。';
  el.className = 'hint' + (o && o.level === 'over' ? ' red' : '');
}
vehForm.addEventListener('input', updateOilStatus);
$('#oilDone').onclick = () => {
  const f = vehForm.elements;
  f.oilLastDate.value = ymd(new Date());
  if (f.odo.value !== '') f.oilLastKm.value = f.odo.value;
  updateOilStatus();
  notify('交換日を今日にしました。「保存」で確定します');
};
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
    inspection: f.inspection.value, active: f.active.checked, note: f.note.value.trim(), ...readOil() };
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
$('#nav').onclick = (e) => { const b = e.target.closest('button'); if (b) { ui.view = b.dataset.view; ui.center = ui.anim = true; window.scrollTo(0, 0); render(); } };
$('#newLoan').onclick = () => openLoan(null);
$('#tvBtn').onclick = enterTv;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.tv && !document.querySelector('dialog[open]')) exitTv(); });
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (h === 'tv') { if (!ui.tv) enterTv(); return; }
  if (VIEWS.includes(h) && (h !== ui.view || ui.tv)) { ui.tv = false; ui.view = h; ui.anim = true; render(); }
});
load();
const h0 = location.hash.slice(1);
if (h0 === 'tv') { ui.tv = true; ui.view = 'day'; } else if (VIEWS.includes(h0)) ui.view = h0;
ui.center = ui.anim = true;
render();
setInterval(() => {
  if (dragging || document.querySelector('dialog[open]')) return;
  if (ui.tv) { ui.day = ymd(new Date()); render(); return; }
  if (ui.view !== 'search' && !document.activeElement.matches('input,select,textarea')) render();
}, 30000);
setInterval(() => { const c = document.getElementById('tvClock'); if (c) c.textContent = hm(new Date()); }, 1000);
