/* Spendly – private, offline spending tracker. No dependencies, no server, no tracking. */
(() => {
'use strict';

/* ---------- helpers ---------- */
const KEY = 'spendly:v1';
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const monthOf = s => s.slice(0, 7);
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n, day) => {
  const d = parseD(s), t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day || d.getDate(), dim)); return iso(t);
};
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysIn = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const monthLabel = (m, short) => { const [y, mo] = m.split('-').map(Number); const r = new Date(y, mo - 1, 1).toLocaleDateString('es', short ? { month: 'short' } : { month: 'long', year: 'numeric' }); return short ? r.replace('.', '') : r[0].toUpperCase() + r.slice(1); };
const dayLabel = s => parseD(s).toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' });
const thisMonth = () => monthOf(today());
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
const L = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', checking: 'Corriente', savings: 'Ahorros', cash: 'Efectivo', credit: 'Tarjeta de crédito', investment: 'Inversión', loan: 'Préstamo', other: 'Otra', auto: 'Automático', light: 'Claro', dark: 'Oscuro' };
const tl = x => L[x] || x;
const FREQ = { daily: 'Diario', weekly: 'Semanal', biweekly: 'Cada 2 semanas', monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' };
const PER_MONTH = { daily: 30.44, weekly: 4.345, biweekly: 2.173, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
const ACC_TYPES = ['checking', 'savings', 'cash', 'credit', 'investment', 'loan', 'other'];
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

/* ---------- state ---------- */
const DEFAULT_CATS = [
  ['groceries', 'Supermercado', '🛒', '#10b981'], ['dining', 'Restaurantes', '🍽️', '#f97316'], ['transport', 'Transporte', '🚗', '#0ea5e9'],
  ['housing', 'Vivienda', '🏠', '#8b5cf6'], ['utilities', 'Servicios', '💡', '#f59e0b'], ['health', 'Salud', '🏥', '#ef4444'],
  ['entertainment', 'Entretenimiento', '🎬', '#ec4899'], ['shopping', 'Compras', '🛍️', '#14b8a6'], ['travel', 'Viajes', '✈️', '#4f46e5'],
  ['education', 'Educación', '📚', '#64748b'], ['subscriptions', 'Suscripciones', '🔁', '#a855f7'], ['gifts', 'Regalos y donaciones', '🎁', '#e11d48'],
  ['personal', 'Cuidado personal', '💇', '#06b6d4'], ['insurance', 'Seguros', '🛡️', '#84cc16'], ['other', 'Otros', '📦', '#94a3b8']
].map(([id, name, icon, color]) => ({ id, name, icon, color, type: 'expense' })).concat([
  ['salary', 'Salario', '💼', '#16a34a'], ['freelance', 'Independiente', '💻', '#22c55e'], ['investments', 'Inversiones', '📈', '#65a30d'],
  ['gift_in', 'Regalos recibidos', '🎀', '#d946ef'], ['other_in', 'Otros ingresos', '💰', '#84cc16']
].map(([id, name, icon, color]) => ({ id, name, icon, color, type: 'income' })));

const defaults = () => ({
  v: 1,
  settings: { currency: 'USD', theme: 'auto', privacy: false, pinHash: '', rates: {}, lastAccount: '', lastBackup: '' },
  accounts: [], categories: DEFAULT_CATS.map(c => ({ ...c })), transactions: [], budgets: [],
  recurring: [], goals: [], debts: [], rules: [], monthly: []
});

function normalize(s) {
  const d = defaults();
  const out = Object.assign(d, s);
  out.settings = Object.assign(defaults().settings, (s && s.settings) || {});
  for (const k of ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'goals', 'debts', 'rules', 'monthly']) if (!Array.isArray(out[k])) out[k] = d[k];
  return out;
}
let S;
try { const r = localStorage.getItem(KEY); S = r ? normalize(JSON.parse(r)) : defaults(); } catch (e) { console.error(e); S = defaults(); }
let storageWarned = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageWarned = false; }
  catch (e) { if (!storageWarned) toast('Almacenamiento lleno – exporta una copia y borra recibos'); storageWarned = true; }
}

const ui = {
  view: 'dashboard', month: thisMonth(), range: '6', txLimit: 100, extra: 0,
  gto: shiftMonth(thisMonth(), -1), gfrom: shiftMonth(thisMonth(), -6), gtype: 'expense', gall: false,
  f: { q: '', type: '', account: '', category: '', tag: '', from: '', to: '' }
};

/* ---------- lookups & money ---------- */
const cur = () => S.settings.currency;
const acc = id => S.accounts.find(a => a.id === id);
const cat = id => S.categories.find(c => c.id === id);
const catName = id => cat(id)?.name || 'Sin categoría';
const toBase = (a, c) => (!c || c === cur()) ? a : a * (S.settings.rates[c] || 1);
function fmt(n, c = cur(), o = {}) {
  if (S.settings.privacy && !o.force) return '••••';
  try { return new Intl.NumberFormat('es', { style: 'currency', currency: c, maximumFractionDigits: o.whole ? 0 : 2 }).format(n); }
  catch { return `${c} ${Number(n).toFixed(2)}`; }
}
const txCur = t => acc(t.accountId)?.currency || cur();
const pieces = t => t.type === 'transfer' ? [] : (t.splits && t.splits.length ? t.splits : [{ categoryId: t.categoryId, amount: t.amount }]);

function balance(a, upto) {
  let b = +a.balance || 0;
  for (const t of S.transactions) {
    if (upto && t.date > upto) continue;
    if (t.accountId === a.id) b += t.type === 'income' ? t.amount : -t.amount;
    if (t.type === 'transfer' && t.toAccountId === a.id) b += t.toAmount || t.amount;
  }
  return b;
}
const netWorth = upto => sum(S.accounts, a => toBase(balance(a, upto), a.currency));

// Per-category totals for a month (base currency). Manual monthly entries (S.monthly) count here but never touch account balances.
function catMonth(m, type, noManual) {
  const out = {};
  for (const t of S.transactions) {
    if (t.type !== type || monthOf(t.date) !== m) continue;
    const c = txCur(t);
    for (const p of pieces(t)) out[p.categoryId] = (out[p.categoryId] || 0) + toBase(p.amount, c);
  }
  if (!noManual) for (const e of S.monthly) if (e.month === m && e.type === type) out[e.categoryId] = (out[e.categoryId] || 0) + e.amount;
  return out;
}
const spentByCat = m => catMonth(m, 'expense');
const monthTotal = (m, type) => sum(Object.values(catMonth(m, type)));

/* ---------- recurring ---------- */
function nextDate(r, from) {
  const f = r.frequency;
  if (f === 'daily') return addDays(from, 1);
  if (f === 'weekly') return addDays(from, 7);
  if (f === 'biweekly') return addDays(from, 14);
  return addMonths(from, { monthly: 1, quarterly: 3, yearly: 12 }[f], r.day);
}
function processRecurring() {
  let n = 0; const t0 = today();
  for (const r of S.recurring) {
    if (!r.active) continue;
    let guard = 0;
    while (r.nextDate <= t0 && (!r.endDate || r.nextDate <= r.endDate) && guard++ < 400) {
      if (acc(r.accountId)) {
        S.transactions.push({ id: uid(), ts: Date.now(), date: r.nextDate, type: r.type, amount: r.amount, accountId: r.accountId, categoryId: r.categoryId, payee: r.payee, note: r.note || '', tags: [], recurringId: r.id });
        n++;
      }
      r.nextDate = nextDate(r, r.nextDate);
    }
  }
  if (n) save();
  return n;
}
function upcoming(untilDate, type = 'expense') {
  const out = [];
  for (const r of S.recurring) {
    if (!r.active || r.type !== type) continue;
    let d = r.nextDate, g = 0;
    while (d <= untilDate && (!r.endDate || d <= r.endDate) && g++ < 100) { if (d >= today()) out.push({ r, date: d }); d = nextDate(r, d); }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const upcomingTotal = until => sum(upcoming(until), u => toBase(u.r.amount, acc(u.r.accountId)?.currency));

/* ---------- budgets ---------- */
function budgetInfo(b, m) {
  const spent = spentByCat(m)[b.categoryId] || 0;
  let carry = 0;
  if (b.rollover) {
    const start = b.start || m; let mm = start;
    while (mm < m) { carry += b.limit - (spentByCat(mm)[b.categoryId] || 0); mm = shiftMonth(mm, 1); }
  }
  const avail = b.limit + carry, pct = avail > 0 ? spent / avail * 100 : (spent > 0 ? 999 : 0);
  return { spent, carry, avail, left: avail - spent, pct };
}
function checkBudgetAlert(t) {
  if (t.type !== 'expense') return;
  const m = monthOf(t.date);
  for (const p of pieces(t)) {
    const b = S.budgets.find(x => x.categoryId === p.categoryId); if (!b) continue;
    const i = budgetInfo(b, m);
    if (i.pct >= 100) toast(`⚠️ Presupuesto excedido: ${catName(b.categoryId)} (${Math.round(i.pct)}%)`);
    else if (i.pct >= 80) toast(`Ojo: ${catName(b.categoryId)} va en ${Math.round(i.pct)}% del presupuesto`);
  }
}

/* ---------- forecast & insights ---------- */
function forecast() {
  const m = thisMonth(), day = new Date().getDate(), dim = daysIn(m), end = `${m}-${pad(dim)}`;
  const spent = monthTotal(m, 'expense');
  const rec = sum(S.transactions.filter(t => t.type === 'expense' && t.recurringId && monthOf(t.date) === m), t => toBase(t.amount, txCur(t)));
  const dailyVar = (spent - rec) / Math.max(day, 7); // damped so the first days of a month don't skew the projection
  const bills = upcomingTotal(end);
  return { spent, bills, dailyVar, projected: spent + dailyVar * (dim - day) + bills, daysLeft: dim - day + 1, end };
}
function safeToSpend() {
  const m = thisMonth(), f = forecast();
  const budget = sum(S.budgets, b => b.limit), income = monthTotal(m, 'income');
  if (budget > 0) {
    const ids = new Set(S.budgets.map(b => b.categoryId)), by = spentByCat(m);
    const spent = sum(Object.entries(by).filter(([id]) => ids.has(id)), e => e[1]);
    const bills = sum(upcoming(f.end).filter(u => ids.has(u.r.categoryId)), u => toBase(u.r.amount, acc(u.r.accountId)?.currency));
    const left = budget - spent - bills;
    return { left, bills, perDay: Math.max(left, 0) / f.daysLeft, basis: 'budget' };
  }
  if (income <= 0) return null;
  const left = income - f.spent - f.bills;
  return { left, bills: f.bills, perDay: Math.max(left, 0) / f.daysLeft, basis: 'income' };
}
function insights(m) {
  const out = [], now = spentByCat(m), prev = [1, 2, 3].map(i => spentByCat(shiftMonth(m, -i)));
  const exp = monthTotal(m, 'expense'), inc = monthTotal(m, 'income');
  for (const c of S.categories.filter(c => c.type === 'expense')) {
    const n = now[c.id] || 0, avg = sum(prev, p => p[c.id] || 0) / 3;
    if (avg > 0 && n > avg * 1.3 && n - avg > 20) out.push(`${c.icon} <b>${esc(c.name)}</b> está ${Math.round((n / avg - 1) * 100)}% por encima de tu promedio de 3 meses.`);
  }
  const top = Object.entries(now).sort((a, b) => b[1] - a[1])[0];
  if (top && exp > 0) out.push(`${cat(top[0])?.icon || ''} Mayor categoría: <b>${esc(catName(top[0]))}</b> – ${Math.round(top[1] / exp * 100)}% del gasto.`);
  const big = S.transactions.filter(t => t.type === 'expense' && monthOf(t.date) === m).sort((a, b) => toBase(b.amount, txCur(b)) - toBase(a.amount, txCur(a)))[0];
  if (big) out.push(`💸 Mayor gasto: <b>${esc(big.payee || catName(big.categoryId))}</b> (${fmt(big.amount, txCur(big))}).`);
  if (inc > 0) { const r = (inc - exp) / inc * 100; out.push(r >= 0 ? `🌱 Tasa de ahorro: <b>${Math.round(r)}%</b> de tus ingresos.` : `📉 Gastaste <b>${fmt(exp - inc)}</b> más de lo que ganaste.`); }
  const subs = sum(S.recurring.filter(r => r.active && r.type === 'expense'), r => toBase(r.amount, acc(r.accountId)?.currency) * PER_MONTH[r.frequency]);
  if (subs > 0) out.push(`🔁 Gastos recurrentes: <b>${fmt(subs)}/mes</b> (${fmt(subs * 12, cur(), { whole: true })}/año).`);
  const over = S.budgets.filter(b => budgetInfo(b, m).pct >= 100).map(b => catName(b.categoryId));
  if (over.length) out.push(`⚠️ Presupuesto excedido: <b>${esc(over.join(', '))}</b>.`);
  if (m === thisMonth()) {
    const f = forecast(), tb = sum(S.budgets, b => b.limit);
    if (tb > 0 && f.projected > tb) out.push(`🔮 A este ritmo gastarás <b>${fmt(f.projected)}</b> – ${fmt(f.projected - tb)} más que tu presupuesto total.`);
    const days = new Set(S.transactions.filter(t => t.type === 'expense' && monthOf(t.date) === m).map(t => t.date));
    const passed = new Date().getDate(); if (passed > 3) out.push(`🧘 Días sin gastos este mes: <b>${passed - days.size}</b>.`);
  }
  return out.slice(0, 7);
}

/* ---------- charts (inline SVG) ---------- */
function donut(data, total, label = '') {
  const r = 70, C = 2 * Math.PI * r; let off = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const len = total > 0 ? d.value / total * C : 0;
    const s = `<circle r="${r}" cx="90" cy="90" fill="none" stroke="${d.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`;
    off += len; return s;
  }).join('');
  return `<svg viewBox="0 0 180 180" width="170" height="170" role="img"><circle r="${r}" cx="90" cy="90" fill="none" stroke="var(--line)" stroke-width="26"/>${segs}
  <text x="90" y="86" text-anchor="middle" style="font-size:11px">${esc(label)}</text><text x="90" y="106" text-anchor="middle" style="font-size:16px;font-weight:700;fill:var(--text)">${esc(S.settings.privacy ? '••••' : fmt(total, cur(), { whole: true }))}</text></svg>`;
}
function bars(items) { // items: {label, a (income), b (expense)}
  const W = 600, H = 210, pl = 6, max = Math.max(1, ...items.flatMap(i => [i.a, i.b])), bw = (W - pl * 2) / items.length;
  const g = items.map((it, i) => {
    const x = pl + i * bw, w = Math.min(22, bw / 2 - 3), ha = it.a / max * 150, hb = it.b / max * 150;
    return `<rect x="${x + bw / 2 - w - 1}" y="${170 - ha}" width="${w}" height="${ha}" rx="4" fill="var(--ok)"/><rect x="${x + bw / 2 + 1}" y="${170 - hb}" width="${w}" height="${hb}" rx="4" fill="var(--bad)"/><text x="${x + bw / 2}" y="190" text-anchor="middle">${esc(it.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
}
function lineChart(pts) {
  if (pts.length < 2) return '<div class="empty">Aún no hay suficientes datos</div>';
  const W = 600, H = 200, vals = pts.map(p => p.v), mn = Math.min(...vals), mx = Math.max(...vals), span = (mx - mn) || 1;
  const X = i => 10 + i * (W - 20) / (pts.length - 1), Y = v => 20 + (1 - (v - mn) / span) * 130;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  const area = `${path} L${X(pts.length - 1)} 160 L${X(0)} 160 Z`;
  const step = Math.ceil(pts.length / 6);
  const labels = pts.map((p, i) => i % step === 0 || i === pts.length - 1 ? `<text x="${X(i)}" y="185" text-anchor="middle">${esc(p.label)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"><path d="${area}" fill="var(--brand)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${labels}</svg>`;
}
const progress = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const barCls = p => p >= 100 ? 'over' : p >= 80 ? 'warn' : '';

/* ---------- UI plumbing ---------- */
function toast(msg, action) {
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span>${msg}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { action.fn(); t.remove(); };
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), action ? 6500 : 3500);
}
function withUndo(msg, fn) {
  const snap = JSON.stringify(S); fn(); save(); render();
  toast(msg, { label: 'Deshacer', fn: () => { S = normalize(JSON.parse(snap)); save(); render(); } });
}
function closeModal() { $('#modal')?.remove(); }
function modal(title, body, onSubmit, o = {}) {
  closeModal();
  const m = document.createElement('div'); m.className = 'overlay'; m.id = 'modal';
  m.innerHTML = `<form class="modal" autocomplete="off" novalidate><header><h3>${esc(title)}</h3><button type="button" class="icon" data-act="closeModal" aria-label="Cerrar">✕</button></header><div class="mbody">${body}</div><footer>${o.danger ? `<button type="button" class="btn danger" id="mdanger">${esc(o.danger.label)}</button>` : ''}<span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn primary">${esc(o.submit || 'Guardar')}</button></footer></form>`;
  document.body.appendChild(m);
  m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
  const f = $('form', m);
  f.addEventListener('submit', e => { e.preventDefault(); if (onSubmit(new FormData(f), f) !== false) closeModal(); });
  if (o.danger) $('#mdanger', m).onclick = () => { closeModal(); o.danger.fn(); };
  o.init?.(f);
}
const val = (fd, k) => String(fd.get(k) ?? '').trim();
const num = (fd, k) => parseFloat(String(fd.get(k) ?? '').replace(',', '.')) || 0;
const opts = (list, sel, f = x => x.name) => list.map(x => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(f(x))}</option>`).join('');
const catOpts = (type, sel) => opts(S.categories.filter(c => c.type === type), sel, c => `${c.icon} ${c.name}`);
function download(name, text, type = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function pickFile(accept, cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.onchange = () => i.files[0] && cb(i.files[0]); i.click();
}
const readText = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(f); });
function compressImage(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.6));
    }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
async function sha(pin) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('spendly:' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 5381; for (const ch of 'spendly:' + pin) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return 'x' + h; }
}

/* ---------- transactions ---------- */
function applyRules(payee) {
  const p = (payee || '').toLowerCase(); if (!p) return '';
  const r = S.rules.find(r => p.includes(r.match.toLowerCase()));
  if (r) return r.categoryId;
  const last = [...S.transactions].reverse().find(t => (t.payee || '').toLowerCase() === p && t.categoryId);
  return last ? last.categoryId : '';
}

function txModal(t, preset) {
  if (!S.accounts.length) { toast('Primero agrega una cuenta'); go('accounts'); accountModal(); return; }
  const isNew = !t;
  t = t || Object.assign({ type: 'expense', date: today(), accountId: acc(S.settings.lastAccount) ? S.settings.lastAccount : S.accounts[0].id, tags: [] }, preset);
  let receipt = t.receipt || '';
  const body = `
  <div class="seg">${['expense', 'income', 'transfer'].map(x => `<label><input type="radio" name="type" value="${x}" ${t.type === x ? 'checked' : ''}><span>${tl(x)}</span></label>`).join('')}</div>
  <div class="grid2"><label>Monto<input name="amount" type="number" inputmode="decimal" step="0.01" min="0" required value="${t.amount ?? ''}" placeholder="0.00"></label>
  <label>Fecha<input name="date" type="date" required value="${t.date}"></label></div>
  <label><span id="acclbl">Cuenta</span><select name="accountId">${opts(S.accounts, t.accountId, a => `${a.name} (${a.currency})`)}</select></label>
  <div data-show="transfer"><label>A la cuenta<select name="toAccountId">${opts(S.accounts, t.toAccountId || S.accounts.find(a => a.id !== t.accountId)?.id, a => `${a.name} (${a.currency})`)}</select></label>
  <label>Monto recibido (solo si las monedas son distintas)<input name="toAmount" type="number" inputmode="decimal" step="0.01" value="${t.toAmount || ''}"></label></div>
  <div data-show="expense income"><label>Categoría<select name="categoryId" id="catsel"></select></label>
  <label>Comercio / beneficiario<input name="payee" list="payees" value="${esc(t.payee || '')}" placeholder="ej. Éxito, Rappi"></label>
  <datalist id="payees">${[...new Set(S.transactions.map(x => x.payee).filter(Boolean))].slice(-150).map(p => `<option value="${esc(p)}">`).join('')}</datalist>
  <label>Etiquetas (separadas por coma)<input name="tags" value="${esc((t.tags || []).join(', '))}" placeholder="viaje, trabajo"></label></div>
  <label>Nota<input name="note" value="${esc(t.note || '')}"></label>
  <div data-show="expense"><div id="splits"></div><button type="button" class="btn sm" id="addsplit">➗ Dividir entre categorías</button></div>
  <div data-show="expense income" style="margin-top:12px"><button type="button" class="btn sm" id="addrcpt">📷 ${receipt ? 'Cambiar' : 'Agregar'} recibo</button>
  <div id="rcpt">${receipt ? `<img class="thumb" src="${receipt}" alt="">` : ''}</div></div>
  ${isNew ? `<label style="margin-top:12px">Repetir<select name="repeat"><option value="">No se repite</option>${Object.entries(FREQ).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>` : ''}`;
  modal(isNew ? 'Nueva transacción' : 'Editar transacción', body, (fd, f) => {
    const type = val(fd, 'type'), amount = num(fd, 'amount');
    if (!(amount > 0)) { toast('Ingresa un monto'); return false; }
    const d = { type, amount, date: val(fd, 'date') || today(), accountId: val(fd, 'accountId'), note: val(fd, 'note') };
    if (type === 'transfer') {
      d.toAccountId = val(fd, 'toAccountId');
      if (d.toAccountId === d.accountId) { toast('Elige dos cuentas distintas'); return false; }
      const ta = acc(d.toAccountId), fa = acc(d.accountId);
      d.toAmount = ta && fa && ta.currency !== fa.currency ? (num(fd, 'toAmount') || toBase(amount, fa.currency) / (S.settings.rates[ta.currency] || 1)) : 0;
      d.categoryId = ''; d.payee = ''; d.tags = []; d.splits = [];
    } else {
      d.categoryId = val(fd, 'categoryId') || (type === 'income' ? 'other_in' : 'other');
      d.payee = val(fd, 'payee'); d.tags = val(fd, 'tags').split(',').map(x => x.trim()).filter(Boolean);
      d.splits = []; d.toAccountId = ''; d.toAmount = 0;
      if (type === 'expense') {
        const rows = $$('.splitrow', f).map(r => ({ categoryId: $('select', r).value, amount: parseFloat($('input', r).value) || 0 })).filter(r => r.amount > 0);
        if (rows.length) {
          if (Math.abs(sum(rows, r => r.amount) - amount) > 0.01) { toast(`La división suma ${sum(rows, r => r.amount).toFixed(2)}, no ${amount.toFixed(2)}`); return false; }
          d.splits = rows; d.categoryId = rows[0].categoryId;
        }
      }
      d.receipt = receipt;
    }
    S.settings.lastAccount = d.accountId;
    let tx;
    if (isNew) {
      tx = Object.assign({ id: uid(), ts: Date.now() }, d); S.transactions.push(tx);
      const rep = val(fd, 'repeat');
      if (rep) {
        const r = { id: uid(), type, amount, accountId: d.accountId, categoryId: d.categoryId, payee: d.payee, note: d.note, frequency: rep, day: parseD(d.date).getDate(), active: true, endDate: '' };
        r.nextDate = nextDate(r, d.date); tx.recurringId = r.id; S.recurring.push(r);
      }
    } else { Object.assign(t, d); tx = t; }
    save(); render(); checkBudgetAlert(tx);
  }, {
    submit: isNew ? 'Agregar' : 'Guardar',
    danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Transacción eliminada', () => { S.transactions = S.transactions.filter(x => x.id !== t.id); }) },
    init: f => {
      const refresh = () => {
        const type = $('input[name=type]:checked', f).value;
        $$('[data-show]', f).forEach(e => e.style.display = e.dataset.show.split(' ').includes(type) ? '' : 'none');
        $('#acclbl', f).textContent = type === 'transfer' ? 'Desde la cuenta' : type === 'income' ? 'Depositar en' : 'Pagado desde';
        const cs = $('#catsel', f), want = cs.value || t.categoryId;
        const ct = type === 'income' ? 'income' : 'expense'; cs.innerHTML = catOpts(ct, want);
      };
      $$('input[name=type]', f).forEach(r => r.onchange = refresh); refresh();
      if (t.splits?.length) t.splits.forEach(addSplit);
      function addSplit(s = {}) {
        const row = document.createElement('div'); row.className = 'splitrow';
        row.innerHTML = `<select>${catOpts('expense', s.categoryId)}</select><input type="number" inputmode="decimal" step="0.01" min="0" placeholder="Monto" value="${s.amount || ''}"><button type="button" class="icon" aria-label="Quitar">✕</button>`;
        $('button', row).onclick = () => row.remove(); $('#splits', f).appendChild(row);
      }
      $('#addsplit', f).onclick = () => addSplit();
      $('#addrcpt', f).onclick = () => pickFile('image/*', async file => {
        try { receipt = await compressImage(file); $('#rcpt', f).innerHTML = `<img class="thumb" src="${receipt}" alt="">`; } catch { toast('No se pudo leer esa imagen'); }
      });
      $('input[name=payee]', f).addEventListener('change', e => {
        const c = applyRules(e.target.value), cs = $('#catsel', f);
        if (c && cat(c) && $('input[name=type]:checked', f).value === cat(c).type) cs.value = c;
      });
    }
  });
}

function filteredTx() {
  const f = ui.f, q = f.q.toLowerCase();
  return S.transactions.filter(t => {
    if (f.type && t.type !== f.type) return false;
    if (f.account && t.accountId !== f.account && t.toAccountId !== f.account) return false;
    if (f.category && !pieces(t).some(p => p.categoryId === f.category)) return false;
    if (f.tag && !(t.tags || []).includes(f.tag)) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (q && !`${t.payee || ''} ${t.note || ''} ${(t.tags || []).join(' ')} ${catName(t.categoryId)}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
}
function txRow(t) {
  const c = cat(t.categoryId), a = acc(t.accountId), isT = t.type === 'transfer';
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const sub = isT ? `${esc(a?.name)} → ${esc(acc(t.toAccountId)?.name)}` : `${t.splits?.length ? `Dividido · ${t.splits.length} categorías` : esc(catName(t.categoryId))} · ${esc(a?.name || '')}${(t.tags || []).map(x => ` #${esc(x)}`).join('')}${t.recurringId ? ' 🔁' : ''}${t.receipt ? ' 📎' : ''}`;
  return `<div class="row" data-act="editTx" data-id="${t.id}"><span class="ico" style="background:${(c?.color || '#94a3b8')}22">${isT ? '↔️' : c?.icon || '📦'}</span>
  <div class="grow"><b>${esc(isT ? 'Transferencia' : t.payee || catName(t.categoryId))}</b><small>${sub}</small></div>
  <span class="amt ${t.type === 'income' ? 'pos' : ''}">${sign}${fmt(t.amount, a?.currency)}</span></div>`;
}
function txListHtml(list, limit) {
  if (!list.length) return '<div class="empty">Aún no hay transacciones.<br>Toca <b>＋</b> para agregar la primera.</div>';
  let out = '', last = '';
  for (const t of list.slice(0, limit)) { if (t.date !== last) { out += `<div class="dayhdr">${dayLabel(t.date)}</div>`; last = t.date; } out += txRow(t); }
  if (list.length > limit) out += `<button class="btn" style="width:100%;margin-top:10px" data-act="more">Ver más (${list.length - limit})</button>`;
  return out;
}

/* ---------- views ---------- */
const monthBar = () => `<div class="monthbar"><button class="icon" data-act="prevMonth" aria-label="Mes anterior">‹</button><b>${monthLabel(ui.month)}</b><button class="icon" data-act="nextMonth" aria-label="Mes siguiente">›</button></div>`;

function viewDashboard() {
  const m = ui.month, inc = monthTotal(m, 'income'), exp = monthTotal(m, 'expense'), net = inc - exp;
  const by = spentByCat(m), data = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: catName(id), value: v, color: cat(id)?.color || '#94a3b8', icon: cat(id)?.icon }));
  const top = data.slice(0, 6), rest = sum(data.slice(6), d => d.value); if (rest > 0) top.push({ label: 'Otras categorías', value: rest, color: '#cbd5e1', icon: '' });
  const isNow = m === thisMonth(), sts = isNow ? safeToSpend() : null, f = isNow ? forecast() : null;
  const buds = S.budgets.map(b => ({ b, i: budgetInfo(b, m) })).sort((a, b) => b.i.pct - a.i.pct).slice(0, 4);
  const bills = upcoming(addDays(today(), 14));
  return `${monthBar()}
  <div class="grid g2" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><small>Ingresos</small><b class="pos">${fmt(inc)}</b></div>
  <div class="card kpi" style="margin:0"><small>Gastado</small><b>${fmt(exp)}</b></div>
  <div class="card kpi" style="margin:0"><small>Ahorrado</small><b class="${net >= 0 ? 'pos' : 'neg'}">${fmt(net)}</b></div>
  <div class="card kpi" style="margin:0"><small>Patrimonio</small><b>${fmt(netWorth())}</b></div></div>
  ${isNow && sts ? `<div class="card"><h2>🧭 Disponible para gastar</h2><div class="line"><div><b style="font-size:26px" class="${sts.left >= 0 ? '' : 'neg'}">${fmt(sts.perDay)}</b><small> por día</small></div><div style="text-align:right"><small>${fmt(sts.left)} restantes este mes</small><br><small>después de ${fmt(sts.bills)} en facturas próximas</small></div></div>
  <small>Según tu ${sts.basis === 'budget' ? 'presupuesto' : 'ingreso'}. Gasto proyectado a fin de mes: <b>${fmt(f.projected)}</b></small></div>` : ''}
  <div class="card"><h2>Gastos por categoría</h2>${exp > 0 ? `<div class="donutwrap">${donut(top, exp, 'Gastado')}<div class="legend">${top.map(d => `<div><i style="background:${d.color}"></i><span>${d.icon || ''} ${esc(d.label)}</span><span>${fmt(d.value)}</span></div>`).join('')}</div></div>` : '<div class="empty">No hay gastos registrados este mes.</div>'}</div>
  <div class="grid cols">
  <div class="card"><h2>Presupuestos <button class="btn sm ghost" style="margin-left:auto" data-act="nav" data-v="budgets">Ver todo</button></h2>${buds.length ? buds.map(({ b, i }) => `<div><div class="line"><span>${cat(b.categoryId)?.icon || ''} ${esc(catName(b.categoryId))}</span><small>${fmt(i.spent)} / ${fmt(i.avail)}</small></div>${progress(i.pct, barCls(i.pct))}</div>`).join('') : '<div class="empty">Aún no hay presupuestos.<br><button class="btn sm" data-act="addBudget">Crear uno</button></div>'}</div>
  <div class="card"><h2>Próximos pagos (14 días)</h2>${bills.length ? bills.slice(0, 6).map(u => `<div class="row" data-act="editRec" data-id="${u.r.id}"><span class="ico" style="background:var(--brand-soft)">🔁</span><div class="grow"><b>${esc(u.r.payee || catName(u.r.categoryId))}</b><small>${dayLabel(u.date)}</small></div><span class="amt">${fmt(u.r.amount, acc(u.r.accountId)?.currency)}</span></div>`).join('') : '<div class="empty">Nada por vencer pronto.</div>'}</div></div>
  <div class="card"><h2>💡 Ideas</h2>${(insights(m).map(i => `<div class="insight">${i}</div>`).join('')) || '<div class="empty">Agrega algunas transacciones para ver ideas.</div>'}</div>
  <div class="card"><h2>Recientes <button class="btn sm ghost" style="margin-left:auto" data-act="nav" data-v="transactions">Ver todo</button></h2>${S.transactions.length ? [...S.transactions].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)).slice(0, 5).map(txRow).join('') : '<div class="empty">No transactions yet.</div>'}</div>`;
}

function viewTransactions() {
  const f = ui.f, tags = [...new Set(S.transactions.flatMap(t => t.tags || []))].sort();
  return `<div class="filters hide-print"><input class="full" id="fq" type="search" placeholder="🔍 Buscar comercio, nota, etiqueta…" value="${esc(f.q)}">
  <select data-f="type"><option value="">Todos los tipos</option>${['expense', 'income', 'transfer'].map(x => `<option value="${x}" ${f.type === x ? 'selected' : ''}>${tl(x)}</option>`).join('')}</select>
  <select data-f="account"><option value="">Todas las cuentas</option>${opts(S.accounts, f.account)}</select>
  <select data-f="category"><option value="">Todas las categorías</option>${opts(S.categories, f.category, c => `${c.icon} ${c.name}`)}</select>
  <select data-f="tag"><option value="">Todas las etiquetas</option>${tags.map(x => `<option ${f.tag === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
  <label style="margin:0">Desde<input type="date" data-f="from" value="${f.from}"></label><label style="margin:0">Hasta<input type="date" data-f="to" value="${f.to}"></label>
  <button class="btn sm full" data-act="clearFilters">Limpiar filtros</button></div>
  <div class="card" id="txsum"></div><div class="card" id="txlist"></div>
  <div class="line hide-print"><button class="btn" data-act="exportCSV">⬇️ Exportar CSV</button><button class="btn" data-act="importCSV">⬆️ Importar CSV</button></div>`;
}
function renderTxList() {
  const list = filteredTx();
  const inc = sum(list.filter(t => t.type === 'income'), t => toBase(t.amount, txCur(t))), exp = sum(list.filter(t => t.type === 'expense'), t => toBase(t.amount, txCur(t)));
  const s = $('#txsum'); if (s) s.innerHTML = `<div class="line"><span>${list.length} transacciones</span><span><span class="pos">+${fmt(inc)}</span> · <span class="neg">−${fmt(exp)}</span></span></div>`;
  const l = $('#txlist'); if (l) l.innerHTML = txListHtml(list, ui.txLimit);
}

function viewBudgets() {
  const m = ui.month, rows = S.budgets.map(b => ({ b, i: budgetInfo(b, m) }));
  const tl = sum(rows, r => r.b.limit), ts = sum(rows, r => r.i.spent);
  const budgeted = new Set(S.budgets.map(b => b.categoryId)), by = spentByCat(m);
  const unb = sum(Object.entries(by).filter(([id]) => !budgeted.has(id)), e => e[1]);
  return `${monthBar()}
  ${rows.length ? `<div class="card"><h2>Total</h2><div class="line"><b>${fmt(ts)} de ${fmt(tl)}</b><small>${fmt(tl - ts)} restantes</small></div>${progress(tl ? ts / tl * 100 : 0, barCls(tl ? ts / tl * 100 : 0))}${unb > 0 ? `<small>Gasto sin presupuesto: ${fmt(unb)}</small>` : ''}</div>` : ''}
  <div class="card"><h2>Presupuestos por categoría <button class="btn sm primary" style="margin-left:auto" data-act="addBudget">＋ Agregar</button></h2>
  ${rows.length ? rows.map(({ b, i }) => `<div class="row" style="display:block" data-act="editBudget" data-id="${b.id}"><div class="line"><b>${cat(b.categoryId)?.icon || ''} ${esc(catName(b.categoryId))}${b.rollover ? '<span class="chip">acumula</span>' : ''}</b><span class="${i.left < 0 ? 'neg' : ''}">${i.left >= 0 ? fmt(i.left) + ' restantes' : fmt(-i.left) + ' de más'}</span></div>${progress(i.pct, barCls(i.pct))}<small>${fmt(i.spent)} de ${fmt(i.avail)}${i.carry ? ` (incl. ${fmt(i.carry)} acumulados)` : ''}</small></div>`).join('') : '<div class="empty">Define límites mensuales por categoría y recibe avisos al 80% y 100%.</div>'}</div>`;
}
function budgetModal(b) {
  const isNew = !b, free = S.categories.filter(c => c.type === 'expense' && (isNew ? !S.budgets.some(x => x.categoryId === c.id) : true));
  if (isNew && !free.length) { toast('Todas las categorías ya tienen presupuesto'); return; }
  modal(isNew ? 'Nuevo presupuesto' : 'Editar presupuesto', `<label>Categoría<select name="categoryId" ${isNew ? '' : 'disabled'}>${opts(free, b?.categoryId, c => `${c.icon} ${c.name}`)}</select></label>
  <label>Límite mensual<input name="limit" type="number" inputmode="decimal" step="0.01" min="0" required value="${b?.limit ?? ''}"></label>
  <label class="inline"><input type="checkbox" name="rollover" ${b?.rollover ? 'checked' : ''}> Acumular lo no gastado (o excedido) al mes siguiente</label>`, fd => {
    const limit = num(fd, 'limit'); if (!(limit > 0)) { toast('Ingresa un límite'); return false; }
    if (isNew) S.budgets.push({ id: uid(), categoryId: val(fd, 'categoryId'), limit, rollover: !!fd.get('rollover'), start: ui.month });
    else { b.limit = limit; const r = !!fd.get('rollover'); if (r && !b.rollover) b.start = ui.month; b.rollover = r; }
    save(); render();
  }, { danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Presupuesto eliminado', () => { S.budgets = S.budgets.filter(x => x.id !== b.id); }) } });
}

function viewRecurring() {
  const list = [...S.recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const monthly = sum(list.filter(r => r.active && r.type === 'expense'), r => toBase(r.amount, acc(r.accountId)?.currency) * PER_MONTH[r.frequency]);
  const monthlyIn = sum(list.filter(r => r.active && r.type === 'income'), r => toBase(r.amount, acc(r.accountId)?.currency) * PER_MONTH[r.frequency]);
  return `<div class="grid g2" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><small>Pagos y suscripciones / mes</small><b>${fmt(monthly)}</b><small>${fmt(monthly * 12, cur(), { whole: true })} / año</small></div>
  <div class="card kpi" style="margin:0"><small>Ingresos recurrentes / mes</small><b class="pos">${fmt(monthlyIn)}</b></div></div>
  <div class="card"><h2>Recurrentes <button class="btn sm primary" style="margin-left:auto" data-act="addRec">＋ Agregar</button></h2>
  ${list.length ? list.map(r => `<div class="row" data-act="editRec" data-id="${r.id}" style="${r.active ? '' : 'opacity:.5'}"><span class="ico" style="background:${(cat(r.categoryId)?.color || '#94a3b8')}22">${cat(r.categoryId)?.icon || '🔁'}</span>
  <div class="grow"><b>${esc(r.payee || catName(r.categoryId))}</b><small>${FREQ[r.frequency]} · próximo ${r.active ? dayLabel(r.nextDate) : 'pausado'}</small></div><span class="amt ${r.type === 'income' ? 'pos' : ''}">${fmt(r.amount, acc(r.accountId)?.currency)}</span></div>`).join('') : '<div class="empty">Agrega arriendo, suscripciones, salario… Se registran solos cuando vencen.</div>'}</div>`;
}
function recModal(r) {
  if (!S.accounts.length) { toast('Add an account first'); return; }
  const isNew = !r; r = r || { type: 'expense', frequency: 'monthly', nextDate: today(), accountId: S.settings.lastAccount || S.accounts[0].id, active: true };
  modal(isNew ? 'Nuevo pago recurrente' : 'Editar pago recurrente', `<div class="seg">${['expense', 'income'].map(x => `<label><input type="radio" name="type" value="${x}" ${r.type === x ? 'checked' : ''}><span>${tl(x)}</span></label>`).join('')}</div>
  <label>Nombre<input name="payee" required value="${esc(r.payee || '')}" placeholder="Netflix, Arriendo, Salario…"></label>
  <div class="grid2"><label>Monto<input name="amount" type="number" inputmode="decimal" step="0.01" min="0" required value="${r.amount ?? ''}"></label>
  <label>Frecuencia<select name="frequency">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${r.frequency === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
  <label>Categoría<select name="categoryId" id="rcat"></select></label>
  <label>Cuenta<select name="accountId">${opts(S.accounts, r.accountId, a => `${a.name} (${a.currency})`)}</select></label>
  <div class="grid2"><label>Próxima fecha<input name="nextDate" type="date" required value="${r.nextDate}"></label><label>Fecha final (opcional)<input name="endDate" type="date" value="${r.endDate || ''}"></label></div>
  <label class="inline"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Activo</label>`, fd => {
    const amount = num(fd, 'amount'); if (!(amount > 0)) { toast('Enter an amount'); return false; }
    const d = { type: val(fd, 'type'), payee: val(fd, 'payee'), amount, frequency: val(fd, 'frequency'), categoryId: val(fd, 'categoryId'), accountId: val(fd, 'accountId'), nextDate: val(fd, 'nextDate'), endDate: val(fd, 'endDate'), active: !!fd.get('active') };
    d.day = parseD(d.nextDate).getDate();
    if (isNew) S.recurring.push(Object.assign({ id: uid(), note: '' }, d)); else Object.assign(r, d);
    processRecurring(); save(); render();
  }, {
    danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Pago recurrente eliminado', () => { S.recurring = S.recurring.filter(x => x.id !== r.id); }) },
    init: f => {
      const fill = () => { const t = $('input[name=type]:checked', f).value; $('#rcat', f).innerHTML = catOpts(t, $('#rcat', f).value || r.categoryId); };
      $$('input[name=type]', f).forEach(x => x.onchange = fill); fill();
    }
  });
}

function viewGoals() {
  return `<div class="card"><h2>Metas de ahorro <button class="btn sm primary" style="margin-left:auto" data-act="addGoal">＋ Agregar</button></h2>
  ${S.goals.length ? S.goals.map(g => {
    const pct = g.target ? g.saved / g.target * 100 : 0; let hint = '';
    if (g.saved >= g.target) hint = '🎉 ¡Meta alcanzada!';
    else if (g.deadline) { const mo = Math.max(1, Math.ceil((parseD(g.deadline) - new Date()) / 2629800000)); hint = parseD(g.deadline) < new Date() ? 'Fecha vencida' : `Ahorra ${fmt((g.target - g.saved) / mo)} / mes para llegar el ${dayLabel(g.deadline)}`; }
    return `<div class="row" style="display:block"><div class="line" data-act="editGoal" data-id="${g.id}"><b>${esc(g.icon || '🎯')} ${esc(g.name)}</b><span>${Math.round(pct)}%</span></div>${progress(pct)}<div class="line"><small>${fmt(g.saved)} de ${fmt(g.target)}</small><button class="btn sm" data-act="fundGoal" data-id="${g.id}">＋ Abonar</button></div>${hint ? `<small>${hint}</small>` : ''}</div>`;
  }).join('') : '<div class="empty">Crea metas como “Fondo de emergencia” o “Vacaciones”.</div>'}</div>`;
}
function goalModal(g) {
  const isNew = !g;
  modal(isNew ? 'Nueva meta' : 'Editar meta', `<div class="grid2"><label>Icon<input name="icon" value="${esc(g?.icon || '🎯')}" maxlength="4"></label><label>Nombre<input name="name" required value="${esc(g?.name || '')}"></label></div>
  <div class="grid2"><label>Objetivo<input name="target" type="number" inputmode="decimal" step="0.01" min="0" required value="${g?.target ?? ''}"></label><label>Ahorrado hasta ahora<input name="saved" type="number" inputmode="decimal" step="0.01" min="0" value="${g?.saved ?? 0}"></label></div>
  <label>Fecha objetivo (opcional)<input name="deadline" type="date" value="${g?.deadline || ''}"></label>`, fd => {
    const d = { icon: val(fd, 'icon') || '🎯', name: val(fd, 'name'), target: num(fd, 'target'), saved: num(fd, 'saved'), deadline: val(fd, 'deadline') };
    if (!d.name || !(d.target > 0)) { toast('El nombre y el objetivo son obligatorios'); return false; }
    if (isNew) S.goals.push(Object.assign({ id: uid() }, d)); else Object.assign(g, d); save(); render();
  }, { danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Meta eliminada', () => { S.goals = S.goals.filter(x => x.id !== g.id); }) } });
}

function rangeMonths() {
  const now = thisMonth(), r = ui.range; let n;
  if (r === 'ytd') n = parseInt(now.slice(5), 10);
  else if (r === 'all') { const first = S.transactions.map(t => monthOf(t.date)).sort()[0]; n = first ? Math.min(60, (parseInt(now) - parseInt(first)) * 12 + parseInt(now.slice(5)) - parseInt(first.slice(5)) + 1) : 1; }
  else n = +r;
  return Array.from({ length: n }, (_, i) => shiftMonth(now, i - n + 1));
}
function viewReports() {
  const ms = rangeMonths(), set = new Set(ms);
  const inRange = S.transactions.filter(t => set.has(monthOf(t.date)));
  const items = ms.map(m => ({ label: monthLabel(m, true), a: monthTotal(m, 'income'), b: monthTotal(m, 'expense') }));
  const inc = sum(items, i => i.a), exp = sum(items, i => i.b);
  const catTot = {}, payee = {}, tagTot = {}, dow = Array(7).fill(0);
  for (const t of inRange) if (t.type === 'expense') {
    const c = txCur(t);
    for (const p of pieces(t)) catTot[p.categoryId] = (catTot[p.categoryId] || 0) + toBase(p.amount, c);
    const b = toBase(t.amount, c); if (t.payee) payee[t.payee] = (payee[t.payee] || 0) + b;
    for (const g of t.tags || []) tagTot[g] = (tagTot[g] || 0) + b;
    dow[parseD(t.date).getDay()] += b;
  }
  for (const e of S.monthly) if (e.type === 'expense' && set.has(e.month)) catTot[e.categoryId] = (catTot[e.categoryId] || 0) + e.amount;
  const cats = Object.entries(catTot).sort((a, b) => b[1] - a[1]);
  const pay = Object.entries(payee).sort((a, b) => b[1] - a[1]).slice(0, 8), tg = Object.entries(tagTot).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const nw = ms.map(m => ({ label: monthLabel(m, true), v: netWorth(`${m}-${pad(daysIn(m))}`) }));
  const dn = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], dmax = Math.max(1, ...dow);
  const R = [['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['ytd', 'Este año'], ['all', 'Todo']];
  return `<div class="tabs hide-print">${R.map(([k, l]) => `<button class="${ui.range === k ? 'on' : ''}" data-act="range" data-r="${k}">${l}</button>`).join('')}</div>
  <div class="grid g3" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><small>Ingresos</small><b class="pos">${fmt(inc)}</b></div><div class="card kpi" style="margin:0"><small>Gastado</small><b>${fmt(exp)}</b></div>
  <div class="card kpi" style="margin:0"><small>Tasa de ahorro</small><b>${inc > 0 ? Math.round((inc - exp) / inc * 100) + '%' : '–'}</b><small>gasto prom. ${fmt(exp / ms.length)}/mes</small></div></div>
  <div class="card"><h2>Ingresos vs gastos</h2>${bars(items)}<small><span class="pos">■</span> ingresos &nbsp; <span class="neg">■</span> gastos</small></div>
  <div class="card"><h2>Patrimonio</h2>${lineChart(nw)}</div>
  <div class="card"><h2>Categorías</h2>${cats.length ? `<div class="donutwrap">${donut(cats.slice(0, 8).map(([id, v]) => ({ value: v, color: cat(id)?.color || '#94a3b8' })), exp, 'Gastado')}</div><table style="margin-top:10px"><tr><th>Categoría</th><th>Total</th><th>%</th><th>/mes</th></tr>${cats.map(([id, v]) => `<tr><td>${cat(id)?.icon || ''} ${esc(catName(id))}</td><td>${fmt(v)}</td><td>${Math.round(v / exp * 100)}%</td><td>${fmt(v / ms.length)}</td></tr>`).join('')}</table>` : '<div class="empty">No hay datos en este rango.</div>'}</div>
  <div class="grid cols"><div class="card"><h2>Principales comercios</h2>${pay.length ? pay.map(([p, v]) => `<div class="line insight"><span>${esc(p)}</span><b>${fmt(v)}</b></div>`).join('') : '<div class="empty">–</div>'}</div>
  <div class="card"><h2>Por etiqueta</h2>${tg.length ? tg.map(([p, v]) => `<div class="line insight"><span>#${esc(p)}</span><b>${fmt(v)}</b></div>`).join('') : '<div class="empty">Agrega etiquetas a las transacciones para verlas aquí.</div>'}</div></div>
  <div class="card"><h2>Gastos por día de la semana</h2>${dow.map((v, i) => `<div class="line"><small style="width:36px">${dn[i]}</small><div style="flex:1">${progress(v / dmax * 100)}</div><small style="width:80px;text-align:right">${fmt(v, cur(), { whole: true })}</small></div>`).join('')}</div>
  <button class="btn hide-print" style="width:100%" data-act="print">🖨️ Imprimir / guardar como PDF</button>`;
}

function viewAccounts() {
  const total = netWorth();
  return `<div class="card kpi"><small>Patrimonio</small><b style="font-size:30px">${fmt(total)}</b></div>
  <div class="card"><h2>Cuentas <button class="btn sm primary" style="margin-left:auto" data-act="addAccount">＋ Agregar</button></h2>
  ${S.accounts.length ? S.accounts.map(a => { const b = balance(a); return `<div class="row" data-act="editAccount" data-id="${a.id}"><span class="ico" style="background:var(--brand-soft)">${{ checking: '🏦', savings: '🐖', cash: '💵', credit: '💳', investment: '📈', loan: '🏷️', other: '📁' }[a.type] || '🏦'}</span><div class="grow"><b>${esc(a.name)}</b><small>${tl(a.type)} · ${a.currency}</small></div><span class="amt ${b < 0 ? 'neg' : ''}">${fmt(b, a.currency)}</span></div>`; }).join('') : '<div class="empty">Agrega tus cuentas bancarias, tarjetas y efectivo.<br>Las tarjetas de crédito y préstamos pueden tener saldo negativo.</div>'}</div>
  ${S.accounts.length > 1 ? `<button class="btn" style="width:100%" data-act="addTx" data-type="transfer">↔️ Transferir entre cuentas</button>` : ''}`;
}
function accountModal(a) {
  const isNew = !a;
  modal(isNew ? 'Nueva cuenta' : 'Editar cuenta', `<label>Nombre<input name="name" required value="${esc(a?.name || '')}" placeholder="Cuenta principal"></label>
  <div class="grid2"><label>Tipo<select name="type">${ACC_TYPES.map(t => `<option value="${t}" ${a?.type === t ? 'selected' : ''}>${tl(t)}</option>`).join('')}</select></label>
  <label>Moneda<input name="currency" list="curs" maxlength="3" style="text-transform:uppercase" value="${esc(a?.currency || cur())}"></label></div>
  <datalist id="curs">${['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'COP', 'ARS', 'CLP', 'PEN', 'SEK', 'NOK', 'NZD', 'ZAR', 'KRW'].map(c => `<option>${c}</option>`).join('')}</datalist>
  <label>Saldo inicial <small>(negativo si es deuda)</small><input name="balance" type="number" inputmode="decimal" step="0.01" value="${a?.balance ?? 0}"></label>`, fd => {
    const d = { name: val(fd, 'name'), type: val(fd, 'type'), currency: (val(fd, 'currency') || cur()).toUpperCase(), balance: num(fd, 'balance') };
    if (!d.name) { toast('El nombre es obligatorio'); return false; }
    if (isNew) { const n = Object.assign({ id: uid() }, d); S.accounts.push(n); if (!S.settings.lastAccount) S.settings.lastAccount = n.id; } else Object.assign(a, d);
    save(); render();
  }, {
    danger: isNew ? null : { label: 'Eliminar', fn: () => { if (confirm('¿Eliminar esta cuenta Y todas sus transacciones?')) withUndo('Cuenta eliminada', () => { S.accounts = S.accounts.filter(x => x.id !== a.id); S.transactions = S.transactions.filter(t => t.accountId !== a.id && t.toAccountId !== a.id); S.recurring = S.recurring.filter(r => r.accountId !== a.id); }); } }
  });
}

function simulate(debts, extra, strategy) {
  const ds = debts.filter(d => d.balance > 0).map(d => ({ ...d, bal: d.balance }));
  let months = 0, interest = 0;
  while (ds.some(d => d.bal > 0.005) && months < 600) {
    months++; const act = ds.filter(d => d.bal > 0.005);
    let pool = extra + sum(act, d => d.minPayment);
    for (const d of act) { const i = d.bal * d.apr / 1200; d.bal += i; interest += i; }
    for (const d of act) { const p = Math.min(d.minPayment, d.bal); d.bal -= p; pool -= p; }
    act.sort(strategy === 'avalanche' ? (a, b) => b.apr - a.apr : (a, b) => a.bal - b.bal);
    for (const d of act) { if (pool <= 0.005) break; const p = Math.min(pool, d.bal); d.bal -= p; pool -= p; }
  }
  return { months, interest, ok: months < 600 };
}
function viewDebts() {
  const total = sum(S.debts, d => d.balance), ex = ui.extra;
  const res = x => x.ok ? `${Math.floor(x.months / 12)} a ${x.months % 12} m · ${fmt(x.interest)} de intereses` : 'Nunca – pagos muy bajos';
  const dateOf = x => x.ok ? new Date(new Date().getFullYear(), new Date().getMonth() + x.months, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }) : '–';
  const base = simulate(S.debts, 0, 'avalanche'), av = simulate(S.debts, ex, 'avalanche'), sn = simulate(S.debts, ex, 'snowball');
  return `<div class="card kpi"><small>Deuda total</small><b style="font-size:28px" class="neg">${fmt(total)}</b></div>
  <div class="card"><h2>Deudas <button class="btn sm primary" style="margin-left:auto" data-act="addDebt">＋ Agregar</button></h2>
  ${S.debts.length ? S.debts.map(d => `<div class="row" data-act="editDebt" data-id="${d.id}"><span class="ico" style="background:var(--brand-soft)">💳</span><div class="grow"><b>${esc(d.name)}</b><small>${d.apr}% anual · mín. ${fmt(d.minPayment)}</small></div><span class="amt">${fmt(d.balance)}</span></div>`).join('') : '<div class="empty">Registra tarjetas y préstamos, y compara estrategias de pago.</div>'}</div>
  ${S.debts.length ? `<div class="card"><h2>Plan de pago</h2><label>Pago extra mensual<input id="extra" type="number" inputmode="decimal" min="0" step="10" value="${ex}"></label>
  <div class="insight"><b>Solo pagos mínimos</b><br><small>${res(base)} · libre de deudas ${dateOf(base)}</small></div>
  <div class="insight"><b>🏔️ Avalancha</b> <span class="chip">menos intereses</span><br><small>${res(av)} · libre de deudas ${dateOf(av)}</small></div>
  <div class="insight"><b>⛄ Bola de nieve</b> <span class="chip">victorias rápidas</span><br><small>${res(sn)} · libre de deudas ${dateOf(sn)}</small></div>
  ${base.ok && av.ok ? `<small>Los pagos extra te ahorran ${fmt(base.interest - av.interest)} en intereses y ${base.months - av.months} meses.</small>` : ''}</div>` : ''}`;
}
function debtModal(d) {
  const isNew = !d;
  modal(isNew ? 'Nueva deuda' : 'Editar deuda', `<label>Nombre<input name="name" required value="${esc(d?.name || '')}" placeholder="Tarjeta Visa"></label>
  <label>Saldo actual<input name="balance" type="number" inputmode="decimal" step="0.01" min="0" required value="${d?.balance ?? ''}"></label>
  <div class="grid2"><label>Tasa de interés anual (%)<input name="apr" type="number" inputmode="decimal" step="0.01" min="0" value="${d?.apr ?? 0}"></label><label>Pago mínimo<input name="minPayment" type="number" inputmode="decimal" step="0.01" min="0" value="${d?.minPayment ?? 0}"></label></div>`, fd => {
    const x = { name: val(fd, 'name'), balance: num(fd, 'balance'), apr: num(fd, 'apr'), minPayment: num(fd, 'minPayment') };
    if (!x.name) { toast('Name is required'); return false; }
    if (isNew) S.debts.push(Object.assign({ id: uid() }, x)); else Object.assign(d, x); save(); render();
  }, { danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Deuda eliminada', () => { S.debts = S.debts.filter(x => x.id !== d.id); }) } });
}

/* ---------- monthly grid: category x month ---------- */
function gridMonths() { const out = []; let m = ui.gfrom; while (m <= ui.gto && out.length < 36) { out.push(m); m = shiftMonth(m, 1); } return out; }
function setMonthly(m, cid, type, total) {
  const tx = catMonth(m, type, true)[cid] || 0;
  if (total < 0 || total + 0.005 < tx) return false;
  S.monthly = S.monthly.filter(e => !(e.month === m && e.categoryId === cid && e.type === type));
  const delta = Math.round((total - tx) * 100) / 100;
  if (delta > 0) S.monthly.push({ id: uid(), month: m, categoryId: cid, type, amount: delta });
  return true;
}
function viewMonthly() {
  const type = ui.gtype, ms = gridMonths(), data = ms.map(m => catMonth(m, type));
  const cats = S.categories.filter(c => c.type === type && (ui.gall || data.some(d => d[c.id] > 0)));
  const rowT = c => sum(data, d => d[c.id] || 0), max = Math.max(1, ...data.flatMap(d => Object.values(d)));
  const n = Math.max(ms.length, 1), totals = data.map(d => sum(Object.values(d))), grand = sum(totals);
  const cell = (m, c, v) => `<td class="cell" data-act="editCell" data-m="${m}" data-c="${c.id}" style="background:color-mix(in srgb,var(--brand) ${Math.round(v / max * 45)}%,transparent)">${v > 0 ? fmt(v, cur(), { whole: true }) : '–'}</td>`;
  const best = cats.map(c => [c, rowT(c) / n]).sort((a, b) => b[1] - a[1])[0];
  const quick = [['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['ytd', 'Este año']];
  return `<div class="seg hide-print"><label><input type="radio" name="gt" data-act="gridType" data-t="expense" ${type === 'expense' ? 'checked' : ''}><span>Gastos</span></label><label><input type="radio" name="gt" data-act="gridType" data-t="income" ${type === 'income' ? 'checked' : ''}><span>Ingresos</span></label></div>
  <div class="tabs hide-print">${quick.map(([k, l]) => `<button data-act="gridRange" data-r="${k}">${l}</button>`).join('')}</div>
  <div class="grid2 hide-print"><label>Desde<input type="month" id="gfrom" value="${ui.gfrom}"></label><label>Hasta<input type="month" id="gto" value="${ui.gto}"></label></div>
  <label class="inline hide-print"><input type="checkbox" id="gall" ${ui.gall ? 'checked' : ''}> Mostrar todas las categorías</label>
  <button class="btn primary hide-print" style="width:100%;margin:6px 0 14px" data-act="addMonth">✏️ Ingresar ${type === 'expense' ? 'los gastos' : 'los ingresos'} de un mes completo</button>
  ${cats.length && grand > 0 ? `<div class="grid g2" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><small>Promedio mensual (${ms.length} meses)</small><b>${fmt(grand / n)}</b></div>
  <div class="card kpi" style="margin:0"><small>${type === 'expense' ? 'Categoría más alta' : 'Fuente principal'}</small><b>${best ? esc(best[0].icon + ' ' + best[0].name) : '–'}</b><small>${best ? fmt(best[1]) + ' / mes' : ''}</small></div></div>` : ''}
  <div class="card" style="padding:8px"><div class="tscroll"><table class="grid"><thead><tr><th>Categoría</th>${ms.map(m => `<th>${monthLabel(m, true)} ${m.slice(2, 4)}</th>`).join('')}<th>Total</th><th>Promedio</th></tr></thead><tbody>
  ${cats.map(c => `<tr><td data-act="gridCat" data-c="${c.id}"><span style="white-space:nowrap">${c.icon} ${esc(c.name)}</span></td>${ms.map((m, i) => cell(m, c, data[i][c.id] || 0)).join('')}<td><b>${fmt(rowT(c), cur(), { whole: true })}</b></td><td><b>${fmt(rowT(c) / n, cur(), { whole: true })}</b></td></tr>`).join('')}
  ${cats.length ? `<tr class="tot"><td><b>Total</b></td>${totals.map(v => `<td><b>${fmt(v, cur(), { whole: true })}</b></td>`).join('')}<td><b>${fmt(grand, cur(), { whole: true })}</b></td><td><b>${fmt(grand / n, cur(), { whole: true })}</b></td></tr>` : ''}</tbody></table></div>
  ${cats.length && grand > 0 ? '' : '<div class="empty">Sin datos en este rango.<br>Usa el botón de arriba para ingresar meses anteriores, o cambia las fechas.</div>'}
  <small class="muted">Promedio = total ÷ número de meses del rango. Toca una celda para editarla.</small></div>
  <button class="btn hide-print" style="width:100%" data-act="exportGrid">⬇️ Exportar tabla (CSV)</button>`;
}
function cellModal(m, cid, type) {
  const tx = catMonth(m, type, true)[cid] || 0, now = catMonth(m, type)[cid] || 0;
  modal(`${catName(cid)} · ${monthLabel(m)}`, `<p class="muted" style="margin-top:0">Registrado con transacciones: <b>${fmt(tx)}</b></p>
  <label>Total del mes<input name="total" type="number" inputmode="decimal" step="0.01" min="0" value="${now || ''}" placeholder="0.00"></label>
  <small class="muted">Si el total es mayor que lo registrado, la diferencia se guarda como ajuste manual. Esto no cambia los saldos de tus cuentas. Déjalo vacío para quitar el ajuste.</small>`, fd => {
    if (!setMonthly(m, cid, type, num(fd, 'total'))) { toast(`El total no puede ser menor que lo registrado (${fmt(tx, cur(), { force: true })})`); return false; }
    save(); render();
  });
}
function monthEntryModal() {
  const type = ui.gtype;
  modal(type === 'expense' ? 'Gastos de un mes' : 'Ingresos de un mes', `<label>Mes<input type="month" name="month" value="${shiftMonth(thisMonth(), -1)}" required></label>
  <p class="muted" style="margin-top:0">Escribe el total de cada categoría. Las vacías se ignoran.</p><div id="mrows"></div>`, (fd, f) => {
    const m = val(fd, 'month'); if (!/^\d{4}-\d{2}$/.test(m)) { toast('Elige un mes'); return false; }
    const rows = $$('[data-c]', f).filter(i => i.value.trim() !== '').map(i => [i.dataset.c, parseFloat(i.value.replace(',', '.')) || 0]);
    const bad = rows.filter(([c, v]) => v < 0 || v + 0.005 < (catMonth(m, type, true)[c] || 0));
    if (bad.length) { toast(`Menor que lo registrado: ${bad.map(([c]) => catName(c)).join(', ')}`); return false; }
    rows.forEach(([c, v]) => setMonthly(m, c, type, v));
    if (m < ui.gfrom) ui.gfrom = m; if (m > ui.gto) ui.gto = m;
    save(); render(); toast('Mes guardado');
  }, {
    init: f => {
      const fill = () => {
        const m = $('[name=month]', f).value, now = /^\d{4}-\d{2}$/.test(m) ? catMonth(m, type) : {};
        $('#mrows', f).innerHTML = S.categories.filter(c => c.type === type).map(c => `<label class="inline" style="justify-content:space-between"><span>${c.icon} ${esc(c.name)}</span><input data-c="${c.id}" type="number" inputmode="decimal" step="0.01" min="0" style="max-width:140px" value="${now[c.id] || ''}" placeholder="0.00"></label>`).join('');
      };
      $('[name=month]', f).onchange = fill; fill();
    }
  });
}
function exportGrid() {
  const ms = gridMonths(), data = ms.map(m => catMonth(m, ui.gtype)), q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Categoría', ...ms, 'Total', 'Promedio'].map(q).join(',')];
  for (const c of S.categories.filter(c => c.type === ui.gtype)) {
    const v = data.map(d => d[c.id] || 0), t = sum(v); if (t <= 0) continue;
    lines.push([c.name, ...v.map(x => x.toFixed(2)), t.toFixed(2), (t / Math.max(ms.length, 1)).toFixed(2)].map(q).join(','));
  }
  download(`spendly-mensual-${ui.gfrom}_${ui.gto}.csv`, lines.join('\n'), 'text/csv'); toast('Tabla exportada');
}

/* ---------- categories & rules ---------- */
function catModal(c) {
  const isNew = !c;
  modal(isNew ? 'Nueva categoría' : 'Editar categoría', `<div class="seg">${['expense', 'income'].map(x => `<label><input type="radio" name="type" value="${x}" ${(c?.type || 'expense') === x ? 'checked' : ''}><span>${tl(x)}</span></label>`).join('')}</div>
  <div class="grid2"><label>Emoji<input name="icon" value="${esc(c?.icon || '🏷️')}" maxlength="4"></label><label>Nombre<input name="name" required value="${esc(c?.name || '')}"></label></div>
  <label>Color</label><div class="line" style="flex-wrap:wrap;margin-bottom:10px">${COLORS.map(k => `<label class="inline" style="margin:0"><input type="radio" name="color" value="${k}" ${(c?.color || COLORS[0]) === k ? 'checked' : ''}><span style="width:26px;height:26px;border-radius:50%;background:${k};display:inline-block"></span></label>`).join('')}</div>`, fd => {
    const d = { name: val(fd, 'name'), icon: val(fd, 'icon') || '🏷️', color: val(fd, 'color') || COLORS[0], type: val(fd, 'type') };
    if (!d.name) { toast('Name is required'); return false; }
    if (isNew) S.categories.push(Object.assign({ id: uid() }, d)); else Object.assign(c, d); save(); render();
  }, {
    danger: isNew ? null : { label: 'Eliminar', fn: () => withUndo('Categoría eliminada', () => {
      const fb = c.type === 'income' ? 'other_in' : 'other', re = id => id === c.id ? fb : id;
      S.transactions.forEach(t => { t.categoryId = re(t.categoryId); (t.splits || []).forEach(s => s.categoryId = re(s.categoryId)); });
      S.monthly.forEach(e => e.categoryId = re(e.categoryId)); S.recurring.forEach(r => r.categoryId = re(r.categoryId)); S.rules.forEach(r => r.categoryId = re(r.categoryId));
      S.budgets = S.budgets.filter(b => b.categoryId !== c.id); S.categories = S.categories.filter(x => x.id !== c.id);
    }) }
  });
}
function ruleModal() {
  modal('Nueva regla de categoría', `<p class="muted">Cuando el comercio contiene este texto, la categoría se completa sola (también al importar CSV).</p>
  <label>El comercio contiene<input name="match" required placeholder="uber"></label><label>Categoría<select name="categoryId">${catOpts('expense')}</select></label>`, fd => {
    const m = val(fd, 'match'); if (!m) return false; S.rules.push({ id: uid(), match: m, categoryId: val(fd, 'categoryId') }); save(); render();
  });
}

/* ---------- import / export ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '', delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, lines = [['date', 'type', 'amount', 'currency', 'account', 'to_account', 'category', 'payee', 'note', 'tags'].join(',')];
  for (const t of [...S.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const base = [t.date, t.type]; const a = acc(t.accountId);
    const tail = [a?.currency, a?.name, acc(t.toAccountId)?.name || ''];
    const rest = [t.payee, t.note, (t.tags || []).join(' ')];
    if (t.splits?.length) t.splits.forEach(s => lines.push([...base, s.amount, ...tail, catName(s.categoryId), ...rest].map(q).join(',')));
    else lines.push([...base, t.amount, ...tail, t.type === 'transfer' ? '' : catName(t.categoryId), ...rest].map(q).join(','));
  }
  download(`spendly-transactions-${today()}.csv`, lines.join('\n'), 'text/csv'); toast('CSV exportado');
}
// Accepts 1,234.56 · 1.234,56 · 1234,56 · 1.234.567 · (45.00) · -45
function parseNum(str) {
  const v = String(str ?? '').trim(); if (!v) return NaN;
  const neg = /^\(.*\)$/.test(v) || v.includes('-'), d = v.replace(/[^0-9.,]/g, ''); if (!/\d/.test(d)) return NaN;
  const lc = d.lastIndexOf(','), ld = d.lastIndexOf('.'); let dec = null;
  if (lc >= 0 && ld >= 0) dec = lc > ld ? ',' : '.';
  else if (lc >= 0) dec = d.split(',').length === 2 && /,\d{1,2}$/.test(d) ? ',' : null;
  else if (ld >= 0) dec = d.split('.').length === 2 && !/\.\d{3}$/.test(d) ? '.' : null;
  const n = parseFloat(d.split(dec === ',' ? '.' : dec === '.' ? ',' : /[.,]/).join('').replace(',', '.'));
  return isNaN(n) ? NaN : neg ? -n : n;
}
function importModal() {
  if (!S.accounts.length) { toast('Add an account first'); return; }
  let text = '';
  modal('Importar CSV', `<p class="muted">Funciona con la mayoría de extractos bancarios. Necesita columna de fecha y de monto (o débito/crédito).</p>
  <button type="button" class="btn" id="pick" style="width:100%;margin-bottom:12px">Elegir archivo CSV…</button><div id="fname" class="muted" style="margin-bottom:10px"></div>
  <label>Importar a la cuenta<select name="accountId">${opts(S.accounts, S.settings.lastAccount, a => `${a.name} (${a.currency})`)}</select></label>
  <label>Formato de fecha<select name="df"><option value="dmy">DD/MM/AAAA</option><option value="mdy">MM/DD/AAAA</option><option value="iso">AAAA-MM-DD</option></select></label>
  <label class="inline"><input type="checkbox" name="invert"> Los gastos son números positivos (invertir signo)</label>`, fd => {
    if (!text) { toast('Primero elige un archivo'); return false; }
    const rows = parseCSV(text); if (rows.length < 2) { toast('El archivo parece vacío'); return false; }
    const h = rows[0].map(x => x.trim().toLowerCase()), find = re => h.findIndex(x => re.test(x));
    const iD = find(/date|fecha|posted/), iA = find(/^(amount|value|sum|monto|valor|importe)/), iDeb = find(/debit|d[eé]bito|withdraw|retiro|cargo|paid out/), iCr = find(/credit|cr[eé]dito|deposit|dep[oó]sito|abono|paid in/),
      iP = find(/payee|merchant|description|descripci|concepto|detalle|comercio|beneficiario|name|nombre|memo/), iC = find(/categor/), iN = find(/^(note|notes|nota|notas|reference|referencia)/), iT = find(/^(type|tipo)$/);
    if (iD < 0 || (iA < 0 && iDeb < 0)) { toast('No se encontraron columnas de fecha y monto'); return false; }
    const df = val(fd, 'df'), accountId = val(fd, 'accountId'), inv = !!fd.get('invert');
    const pd = s => { s = s.trim(); let m;
      if (df === 'iso') { m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : null; }
      m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return df === 'mdy' ? `${y}-${pad(m[1])}-${pad(m[2])}` : `${y}-${pad(m[2])}-${pad(m[1])}`; };
    const pn = parseNum;
    const keys = new Set(S.transactions.map(t => `${t.date}|${t.amount}|${(t.payee || '').toLowerCase()}|${t.accountId}`));
    let added = 0, dup = 0, bad = 0;
    for (const r of rows.slice(1)) {
      const date = pd(r[iD] || ''); let a = iA >= 0 ? pn(r[iA]) : NaN;
      if (iA < 0) { const d = pn(r[iDeb]), c = iCr >= 0 ? pn(r[iCr]) : NaN; a = !isNaN(c) && c !== 0 ? Math.abs(c) : !isNaN(d) ? -Math.abs(d) : NaN; }
      if (!date || isNaN(a) || a === 0) { bad++; continue; }
      if (inv) a = -a;
      let type = a < 0 ? 'expense' : 'income';
      if (iT >= 0) { const tv = (r[iT] || '').toLowerCase(); if (/income|credit|deposit|ingreso|abono|cr[eé]dito/.test(tv)) type = 'income'; else if (/expense|debit|gasto|d[eé]bito|cargo/.test(tv)) type = 'expense'; }
      const payee = iP >= 0 ? (r[iP] || '').trim() : '', amount = Math.abs(a), k = `${date}|${amount}|${payee.toLowerCase()}|${accountId}`;
      if (keys.has(k)) { dup++; continue; } keys.add(k);
      let c = iC >= 0 ? S.categories.find(x => x.name.toLowerCase() === (r[iC] || '').trim().toLowerCase() && x.type === type)?.id : '';
      if (!c) { const rc = applyRules(payee); c = rc && cat(rc)?.type === type ? rc : (type === 'income' ? 'other_in' : 'other'); }
      S.transactions.push({ id: uid(), ts: Date.now() + added, date, type, amount, accountId, categoryId: c, payee, note: iN >= 0 ? (r[iN] || '').trim() : '', tags: [] }); added++;
    }
    save(); render(); toast(`Importadas ${added}${dup ? `, ${dup} duplicadas omitidas` : ''}${bad ? `, ${bad} filas ilegibles` : ''}`);
  }, {
    submit: 'Importar', init: f => $('#pick', f).onclick = () => pickFile('.csv,text/csv,text/plain', async file => { text = await readText(file); $('#fname', f).textContent = `📄 ${file.name}`; })
  });
}
function backup() {
  S.settings.lastBackup = today(); save();
  download(`spendly-backup-${today()}.json`, JSON.stringify(S), 'application/json'); toast('Copia guardada – guárdala en un lugar seguro'); render();
}
function restore() {
  pickFile('.json,application/json', async file => {
    try {
      const d = JSON.parse(await readText(file)); if (!d || !Array.isArray(d.transactions)) throw 0;
      if (!confirm('¿Reemplazar TODOS los datos actuales con esta copia?')) return;
      S = normalize(d); save(); render(); toast('Copia restaurada');
    } catch { toast('Ese archivo no es una copia válida de Spendly'); }
  });
}
function demo() {
  if (S.transactions.length && !confirm('¿Reemplazar tus datos actuales con datos de ejemplo?')) return;
  S = defaults(); let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const chk = { id: 'a1', name: 'Cuenta corriente', type: 'checking', currency: 'USD', balance: 2500 }, sav = { id: 'a2', name: 'Ahorros', type: 'savings', currency: 'USD', balance: 8000 }, cc = { id: 'a3', name: 'Tarjeta de crédito', type: 'credit', currency: 'USD', balance: -900 };
  S.accounts = [chk, sav, cc]; S.settings.lastAccount = 'a1';
  const t0 = today(), start = addMonths(t0.slice(0, 8) + '01', -5, 1);
  const add = (date, type, amount, accountId, categoryId, payee) => S.transactions.push({ id: uid(), ts: Date.now() + S.transactions.length, date, type, amount: Math.round(amount * 100) / 100, accountId, categoryId, payee, note: '', tags: [] });
  const shops = { groceries: ["Trader Joe's", 'Whole Foods', 'Costco'], dining: ['Chipotle', 'Starbucks', 'Pizza Place'], transport: ['Shell', 'Uber', 'Metro card'], entertainment: ['Cinema', 'Steam'], shopping: ['Amazon', 'Target'], health: ['CVS pharmacy'] };
  for (let d = start; d <= t0; d = addDays(d, 1)) {
    const day = parseD(d).getDate();
    if (day === 1) { add(d, 'income', 3500, 'a1', 'salary', 'Employer Inc.'); add(d, 'expense', 1200, 'a1', 'housing', 'Landlord'); add(d, 'expense', 15.99, 'a3', 'subscriptions', 'Netflix'); add(d, 'expense', 10.99, 'a3', 'subscriptions', 'Spotify'); add(d, 'expense', 29, 'a1', 'health', 'Gym'); }
    if (day === 5) add(d, 'expense', 60 + rnd() * 40, 'a1', 'utilities', 'Electric company');
    if (day === 15) add(d, 'transfer', 300, 'a1', '', ''), S.transactions[S.transactions.length - 1].toAccountId = 'a2';
    for (const [c, names] of Object.entries(shops)) if (rnd() < { groceries: .3, dining: .25, transport: .2, entertainment: .08, shopping: .1, health: .03 }[c]) add(d, 'expense', { groceries: 35, dining: 12, transport: 25, entertainment: 20, shopping: 45, health: 18 }[c] * (.5 + rnd() * 1.6), rnd() < .5 ? 'a3' : 'a1', c, names[Math.floor(rnd() * names.length)]);
  }
  S.recurring = [
    { id: uid(), type: 'expense', amount: 1200, accountId: 'a1', categoryId: 'housing', payee: 'Landlord', note: '', frequency: 'monthly', day: 1, active: true, endDate: '', nextDate: addMonths(t0.slice(0, 8) + '01', 1, 1) },
    { id: uid(), type: 'expense', amount: 15.99, accountId: 'a3', categoryId: 'subscriptions', payee: 'Netflix', note: '', frequency: 'monthly', day: 1, active: true, endDate: '', nextDate: addMonths(t0.slice(0, 8) + '01', 1, 1) },
    { id: uid(), type: 'expense', amount: 10.99, accountId: 'a3', categoryId: 'subscriptions', payee: 'Spotify', note: '', frequency: 'monthly', day: 1, active: true, endDate: '', nextDate: addMonths(t0.slice(0, 8) + '01', 1, 1) },
    { id: uid(), type: 'income', amount: 3500, accountId: 'a1', categoryId: 'salary', payee: 'Employer Inc.', note: '', frequency: 'monthly', day: 1, active: true, endDate: '', nextDate: addMonths(t0.slice(0, 8) + '01', 1, 1) }];
  for (const t of S.transactions) { const r = S.recurring.find(x => x.payee === t.payee && x.type === t.type); if (r) t.recurringId = r.id; }
  const bm = shiftMonth(thisMonth(), -5);
  S.budgets = [['groceries', 450, 1], ['dining', 200, 0], ['transport', 150, 0], ['entertainment', 100, 0], ['shopping', 200, 0]].map(([c, l, r]) => ({ id: uid(), categoryId: c, limit: l, rollover: !!r, start: bm }));
  S.goals = [{ id: uid(), name: 'Fondo de emergencia', icon: '🛟', target: 10000, saved: 3200, deadline: addMonths(t0, 14) }, { id: uid(), name: 'Vacaciones', icon: '🏝️', target: 2000, saved: 600, deadline: addMonths(t0, 6) }];
  S.debts = [{ id: uid(), name: 'Tarjeta de crédito', balance: 2400, apr: 22, minPayment: 75 }, { id: uid(), name: 'Crédito estudiantil', balance: 9000, apr: 5.5, minPayment: 120 }];
  S.rules = [{ id: uid(), match: 'uber', categoryId: 'transport' }];
  save(); go('dashboard'); toast('Datos de ejemplo cargados');
}

/* ---------- settings ---------- */
function viewSettings() {
  const s = S.settings, foreign = [...new Set(S.accounts.map(a => a.currency))].filter(c => c !== s.currency);
  const bdays = s.lastBackup ? Math.round((new Date() - parseD(s.lastBackup)) / 86400000) : null;
  return `<div class="card"><h2>💾 Tus datos</h2><p class="muted" style="margin-top:0">Todo se guarda solo en este dispositivo. Haz copias de seguridad con frecuencia: si borras los datos de Safari o la app, se pierde todo.</p>
  <p style="margin:0 0 10px">${bdays === null ? '⚠️ <b>Nunca has hecho una copia de seguridad.</b>' : bdays > 14 ? `⚠️ Tu última copia fue hace ${bdays} días.` : `✅ Última copia: ${bdays === 0 ? 'hoy' : 'hace ' + bdays + ' días'}.`}</p>
  <div class="grid g2"><button class="btn primary" data-act="backup">⬇️ Copia (JSON)</button><button class="btn" data-act="restore">⬆️ Restaurar</button></div></div>
  <div class="card"><h2>Preferencias</h2>
  <label>Moneda principal<input id="setcur" list="curs2" maxlength="3" style="text-transform:uppercase" value="${esc(s.currency)}"></label><datalist id="curs2">${['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'MXN', 'BRL', 'COP', 'INR'].map(c => `<option>${c}</option>`).join('')}</datalist>
  <label>Apariencia<select id="settheme">${['auto', 'light', 'dark'].map(t => `<option value="${t}" ${s.theme === t ? 'selected' : ''}>${tl(t)}</option>`).join('')}</select></label>
  <label class="inline"><input type="checkbox" id="setpriv" ${s.privacy ? 'checked' : ''}> Modo privado (ocultar todos los montos)</label></div>
  ${foreign.length ? `<div class="card"><h2>Tasas de cambio</h2>${foreign.map(c => `<label>1 ${c} = <input data-rate="${c}" type="number" inputmode="decimal" step="0.0001" value="${s.rates[c] || ''}" placeholder="valor en ${s.currency}"></label>`).join('')}<button class="btn sm" data-act="fetchRates">🌐 Obtener tasas actuales</button> <small>(única acción que usa internet)</small></div>` : ''}
  <div class="card"><h2>🔒 Bloqueo de la app</h2><p class="muted" style="margin-top:0">Pide un PIN al abrir la app. Evita miradas curiosas; no cifra tus datos.</p>
  <button class="btn" data-act="${s.pinHash ? 'removePin' : 'setPin'}">${s.pinHash ? 'Quitar PIN' : 'Crear PIN'}</button></div>
  <div class="card"><h2>Categorías <button class="btn sm primary" style="margin-left:auto" data-act="addCat">＋ Agregar</button></h2>${S.categories.map(c => `<div class="row" data-act="editCat" data-id="${c.id}"><span class="ico" style="background:${c.color}22">${c.icon}</span><div class="grow"><b>${esc(c.name)}</b></div><small>${tl(c.type)}</small></div>`).join('')}</div>
  <div class="card"><h2>Reglas de categoría automática <button class="btn sm primary" style="margin-left:auto" data-act="addRule">＋ Agregar</button></h2>${S.rules.length ? S.rules.map(r => `<div class="row" data-act="delRule" data-id="${r.id}"><div class="grow"><b>“${esc(r.match)}”</b><small>→ ${cat(r.categoryId)?.icon || ''} ${esc(catName(r.categoryId))}</small></div><small>toca para borrar</small></div>`).join('') : '<div class="empty">Sin reglas. Spendly también recuerda la última categoría usada por comercio.</div>'}</div>
  <div class="card"><h2>Otros</h2><div class="grid g2"><button class="btn" data-act="demo">🧪 Cargar datos de ejemplo</button><button class="btn danger" data-act="reset">🗑️ Borrar todo</button></div></div>
  <p class="muted" style="text-align:center">Spendly v1.1 · código abierto · sin rastreo</p>`;
}

/* ---------- render & events ---------- */
const NAV = [['dashboard', '🏠', 'Inicio'], ['transactions', '🧾', 'Movimientos'], ['budgets', '🎯', 'Presupuesto'], ['monthly', '🗓️', 'Mensual'], ['recurring', '🔁', 'Pagos'], ['goals', '⭐', 'Metas'], ['reports', '📊', 'Informes'], ['accounts', '🏦', 'Cuentas'], ['debts', '💳', 'Deudas'], ['settings', '⚙️', 'Ajustes']];
const TITLES = { dashboard: 'Spendly', transactions: 'Movimientos', budgets: 'Presupuestos', monthly: 'Resumen mensual', recurring: 'Pagos y suscripciones', goals: 'Metas', reports: 'Informes', accounts: 'Cuentas', debts: 'Pago de deudas', settings: 'Ajustes' };
const VIEWS = { dashboard: viewDashboard, transactions: viewTransactions, budgets: viewBudgets, monthly: viewMonthly, recurring: viewRecurring, goals: viewGoals, reports: viewReports, accounts: viewAccounts, debts: viewDebts, settings: viewSettings };

function go(v) { ui.view = v; if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v); render(); window.scrollTo(0, 0); }
function render() {
  document.documentElement.dataset.theme = S.settings.theme;
  $('#nav').innerHTML = NAV.map(([k, i, l]) => `<button class="${ui.view === k ? 'on' : ''}" data-act="nav" data-v="${k}"><span>${i}</span>${l}</button>`).join('');
  $('#top').innerHTML = `<h1>${TITLES[ui.view]}</h1><span class="sp"></span><button class="icon" data-act="togglePrivacy" aria-label="Modo privado">${S.settings.privacy ? '🙈' : '👁️'}</button>${S.settings.pinHash ? '<button class="icon" data-act="lock" aria-label="Bloquear">🔒</button>' : ''}`;
  $('#view').innerHTML = VIEWS[ui.view]();
  if (ui.view === 'transactions') renderTxList();
  const fab = $('.fab'); if (!fab) { const b = document.createElement('button'); b.className = 'fab hide-print'; b.dataset.act = 'addTx'; b.setAttribute('aria-label', 'Agregar transacción'); b.textContent = '＋'; document.body.appendChild(b); }
}

const ACTIONS = {
  nav: d => go(d.v), closeModal, togglePrivacy: () => { S.settings.privacy = !S.settings.privacy; save(); render(); },
  prevMonth: () => { ui.month = shiftMonth(ui.month, -1); render(); }, nextMonth: () => { ui.month = shiftMonth(ui.month, 1); render(); },
  addTx: d => txModal(null, d.type ? { type: d.type } : undefined), editTx: d => txModal(S.transactions.find(t => t.id === d.id)),
  more: () => { ui.txLimit += 100; renderTxList(); }, clearFilters: () => { ui.f = { q: '', type: '', account: '', category: '', tag: '', from: '', to: '' }; render(); },
  gridCat: d => { ui.f = { q: '', type: '', account: '', category: d.c, tag: '', from: ui.gfrom + '-01', to: `${ui.gto}-${pad(daysIn(ui.gto))}` }; go('transactions'); },
  editCell: d => cellModal(d.m, d.c, ui.gtype), addMonth: monthEntryModal, exportGrid,
  gridType: d => { ui.gtype = d.t; render(); },
  gridRange: d => { const now = thisMonth(); ui.gto = d.r === 'ytd' ? now : shiftMonth(now, -1); ui.gfrom = d.r === 'ytd' ? now.slice(0, 4) + '-01' : shiftMonth(ui.gto, -(+d.r - 1)); render(); },
  addBudget: () => budgetModal(), editBudget: d => budgetModal(S.budgets.find(b => b.id === d.id)),
  addRec: () => recModal(), editRec: d => recModal(S.recurring.find(r => r.id === d.id)),
  addGoal: () => goalModal(), editGoal: d => goalModal(S.goals.find(g => g.id === d.id)),
  fundGoal: d => { const g = S.goals.find(x => x.id === d.id); modal(`Abonar – ${g.name}`, `<label>Monto <small>(negativo para retirar)</small><input name="amt" type="number" inputmode="decimal" step="0.01" required autofocus></label>`, fd => { g.saved = Math.max(0, g.saved + num(fd, 'amt')); save(); render(); }, { submit: 'Abonar' }); },
  addAccount: () => accountModal(), editAccount: d => accountModal(acc(d.id)),
  addDebt: () => debtModal(), editDebt: d => debtModal(S.debts.find(x => x.id === d.id)),
  addCat: () => catModal(), editCat: d => catModal(cat(d.id)), addRule: () => ruleModal(),
  delRule: d => withUndo('Regla eliminada', () => { S.rules = S.rules.filter(r => r.id !== d.id); }),
  range: d => { ui.range = d.r; render(); }, print: () => window.print(),
  exportCSV, importCSV: importModal, backup, restore, demo,
  reset: () => { if (confirm('¿Borrar TODOS los datos de este dispositivo? ¡Haz una copia primero!') && confirm('¿Seguro que quieres borrar todo?')) { S = defaults(); save(); go('dashboard'); } },
  lock: () => showLock(),
  setPin: () => modal('Crear PIN', `<label>Nuevo PIN (4–8 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" required></label><label>Repite el PIN<input name="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" required></label>`, (fd) => {
    const a = val(fd, 'pin'), b = val(fd, 'pin2'); if (!/^\d{4,8}$/.test(a)) { toast('Usa de 4 a 8 dígitos'); return false; } if (a !== b) { toast('Los PIN no coinciden'); return false; }
    sha(a).then(h => { S.settings.pinHash = h; save(); render(); toast('PIN creado'); });
  }),
  removePin: () => { S.settings.pinHash = ''; save(); render(); toast('PIN eliminado'); },
  fetchRates: async () => {
    try {
      const r = await (await fetch(`https://open.er-api.com/v6/latest/${cur()}`)).json();
      if (!r.rates) throw 0; for (const c of new Set(S.accounts.map(a => a.currency))) if (c !== cur() && r.rates[c]) S.settings.rates[c] = +(1 / r.rates[c]).toFixed(6);
      save(); render(); toast('Tasas actualizadas');
    } catch { toast('No se pudieron obtener las tasas – ingrésalas manualmente'); }
  }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACTIONS[b.dataset.act]) { e.preventDefault(); ACTIONS[b.dataset.act](b.dataset, e); } });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'fq') { ui.f.q = t.value; ui.txLimit = 100; renderTxList(); }
  else if (t.id === 'extra') { ui.extra = Math.max(0, parseFloat(t.value) || 0); const pos = t.selectionStart; render(); const n = $('#extra'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { } }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.f) { ui.f[t.dataset.f] = t.value; ui.txLimit = 100; renderTxList(); }
  else if (t.id === 'setcur') { const c = t.value.trim().toUpperCase(); if (/^[A-Z]{3}$/.test(c) && c !== cur()) { if (confirm(`¿Cambiar la moneda principal a ${c}? Se borrarán las tasas de cambio.`)) { S.settings.currency = c; S.settings.rates = {}; save(); } } render(); }
  else if (t.id === 'gfrom' || t.id === 'gto') { if (/^\d{4}-\d{2}$/.test(t.value)) { ui[t.id] = t.value; if (ui.gfrom > ui.gto) { if (t.id === 'gfrom') ui.gto = ui.gfrom; else ui.gfrom = ui.gto; } render(); } }
  else if (t.id === 'gall') { ui.gall = t.checked; render(); }
  else if (t.id === 'settheme') { S.settings.theme = t.value; save(); render(); }
  else if (t.id === 'setpriv') { S.settings.privacy = t.checked; save(); render(); }
  else if (t.dataset.rate) { S.settings.rates[t.dataset.rate] = parseFloat(t.value) || 0; save(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
  if (!typing && !$('#modal') && !$('.lock')) { if (e.key === 'n') { e.preventDefault(); txModal(); } if (e.key === '/' && ui.view === 'transactions') { e.preventDefault(); $('#fq')?.focus(); } }
});
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== ui.view) { ui.view = v; render(); } });

/* ---------- lock screen ---------- */
function showLock() {
  if ($('.lock')) return;
  const el = document.createElement('div'); el.className = 'lock';
  el.innerHTML = `<div style="font-size:54px">🔒</div><h2>Ingresa tu PIN</h2><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autofocus aria-label="PIN"><small id="lockmsg" class="muted"></small>`;
  document.body.appendChild(el); const i = $('input', el);
  i.addEventListener('input', async () => {
    if (i.value.length < 4) return;
    if (await sha(i.value) === S.settings.pinHash) el.remove(); else if (i.value.length >= 8) { i.value = ''; $('#lockmsg', el).textContent = 'PIN incorrecto'; }
  });
  i.addEventListener('keydown', async e => { if (e.key === 'Enter') { if (await sha(i.value) === S.settings.pinHash) el.remove(); else { i.value = ''; $('#lockmsg', el).textContent = 'PIN incorrecto'; } } });
  setTimeout(() => i.focus(), 50);
}

/* ---------- boot ---------- */
const startView = location.hash.slice(1); if (VIEWS[startView]) ui.view = startView;
if (S.settings.pinHash) showLock();
const posted = processRecurring();
render();
if (posted) toast(`${posted} pago${posted > 1 ? 's recurrentes registrados' : ' recurrente registrado'}`);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (processRecurring()) render(); }
  else if (S.settings.pinHash) showLock();
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
