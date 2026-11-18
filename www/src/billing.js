import { track } from './analytics.js';
import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { esc } from './util.js';
import { api, publicGet, getSession } from './auth.js';
import { errText } from './account.js';
import { refreshEntitlement } from './entitlement.js';

// ---- the Play Billing bridge ----
// In the Android app the native plugin @capgo/native-purchases is reached through Capacitor. In a browser there is none, so purchases are simply not offered.
// Everything the plugin returns is only a purchase token: the server asks Google what it means.
const plugin = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases) || null;
const SUBS = 'subs';
const cancelled = (e) => /cancel/i.test(String((e && (e.code || e.message)) || ''));

const PL = { plans: null, billing: false, prices: {}, native: false, loading: false, loaded: false, err: false, busy: false, msg: null };
const money = (n) => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));
export const upgradeLink = (code) => (code === 'quota_exceeded' || code === 'plan_required' ? `<a class="chip" href="#/plans">${t('bl.seePlans')}</a>` : '');

async function loadPrices() {
  const p = plugin(); PL.native = false; PL.prices = {};
  const ids = (PL.plans || []).map((x) => x.play_product_id).filter(Boolean);
  if (!p || !ids.length) return;
  try {
    const sup = await p.isBillingSupported(); if (!(sup && sup.isBillingSupported)) return;
    PL.native = true;
    const r = await p.getProducts({ productIdentifiers: ids, productType: SUBS });
    (r.products || []).forEach((x) => { PL.prices[x.identifier || x.productIdentifier] = x.priceString || ''; });
  } catch (e) { /* prices stay hidden; the Subscribe button still works if billing is supported */ }
}
async function load() {
  if (PL.loading) return;
  PL.loading = true; PL.err = false;
  try {
    const r = await publicGet('/plans'); PL.plans = r.plans; PL.billing = !!r.billing_available;
    if (getSession()) await refreshEntitlement().catch(() => {});
    await loadPrices();
    PL.loaded = true;
  } catch (e) { PL.err = true; }
  PL.loading = false; setState({});
}

// ---- screen ----
const meter = (used, limit, label) => `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${Math.min(used, limit)}"><i style="width:${limit ? Math.min(100, Math.round((used / limit) * 100)) : 100}%"></i></div>`;
const date = (iso) => new Date(iso).toLocaleDateString();
function planLine(e) {
  if (e.source === 'free') return t('bl.line.free');
  if (e.source === 'manual') return e.renews_at ? t('bl.line.giftEnds', { date: date(e.renews_at) }) : t('bl.line.gift');
  if (e.status === 'past_due') return t('bl.line.pastDue');
  if (!e.renews_at) return '';
  return e.will_renew ? t('bl.line.renews', { date: date(e.renews_at) }) : t('bl.line.ends', { date: date(e.renews_at) });
}
function currentCard(s) {
  const e = s.entitlement;
  if (!getSession()) return `<section class="card"><p>${t('bl.signin')}</p><a class="btn secondary" href="#/account">${t('ac.open')}</a></section>`;
  if (!e) return `<p class="muted" role="status">${t('bl.loading')}</p>`;
  const u = e.usage; const lim = Math.round(u.stt_seconds.limit / 60 * 10) / 10; const used = Math.round(u.stt_seconds.used / 60 * 10) / 10;
  return `<section class="card"><h2>${t('bl.current', { name: esc(e.plan.name) })}</h2><p class="muted">${esc(planLine(e))}</p>` +
    `<h3 class="wk">${t('bl.use.title')}</h3><p>${t('bl.use.turns', { used: u.ai_turns.used, limit: u.ai_turns.limit })}</p>${meter(u.ai_turns.used, u.ai_turns.limit, t('bl.use.turns.aria'))}` +
    `<p>${t('bl.use.voice', { used: money(used), limit: money(lim) })}</p>${meter(u.stt_seconds.used, u.stt_seconds.limit, t('bl.use.voice.aria'))}` +
    `<p class="muted">${t('bl.use.resets', { time: new Date(u.resets_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p></section>`;
}
function features(f) {
  const modes = f.speaking_modes.length >= 6 ? t('bl.feat.modes.all') : t('bl.feat.modes', { list: f.speaking_modes.map((m) => t('sk.mode.' + m)).join(', ') });
  return `<ul class="plain"><li>${t('bl.feat.core')}</li><li>${t('bl.feat.turns', { n: f.ai_turns_per_day })}</li><li>${t('bl.feat.voice', { n: money(f.stt_seconds_per_day / 60) })}</li><li>${modes}</li></ul>`;
}
function planCard(s, p, cur) {
  const here = p.id === cur.id; let action = '';
  if (here) action = '';
  else if (p.id === 'free' || p.rank < cur.rank) action = p.id === 'free' ? '' : `<p class="muted">${t('bl.lower')}</p>`;
  else if (!p.play_product_id) action = `<p class="muted">${t('bl.notYet')}</p>`;
  else if (!PL.native) action = `<p class="muted">${t('bl.android')}</p>`;
  else if (!getSession()) action = `<a class="btn secondary" href="#/account">${t('ac.open')}</a>`;
  else action = `<p><strong>${esc(PL.prices[p.play_product_id] || t('bl.price.store'))}</strong></p><button class="btn" data-act="bl-buy" data-id="${esc(p.id)}"${PL.busy ? ' disabled' : ''}>${t(PL.busy ? 'bl.working' : 'bl.subscribe')}</button>`;
  return `<section class="card"><div class="line"><h2>${esc(p.name)}</h2>${here ? `<span class="badge">${t('bl.badge.current')}</span>` : ''}</div>${features(p.features)}${action}</section>`;
}
export function plans(s) {
  if (!PL.loaded && !PL.loading) queueMicrotask(load);
  const cur = s.entitlement ? { id: s.entitlement.plan.id, rank: (PL.plans || []).find((x) => x.id === s.entitlement.plan.id)?.rank ?? 0 } : { id: 'free', rank: 0 };
  const list = PL.plans ? PL.plans.map((p) => planCard(s, p, cur)).join('') : PL.err ? `<p class="fb bad" role="alert">${t('bl.loadFailed')}</p><button class="btn secondary" data-act="bl-reload">${t('bl.retry')}</button>` : `<p class="muted" role="status">${t('bl.loading')}</p>`;
  const manage = PL.native ? `<button class="btn secondary" data-act="bl-manage">${t('bl.manage')}</button>` : `<a class="btn secondary" href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener">${t('bl.manage')}</a>`;
  return `<a class="back" href="#/settings">${t('bl.back')}</a><header class="top"><h1>${t('bl.title')}</h1></header>` + currentCard(s) +
    (PL.msg ? `<p class="fb ${PL.msg.ok ? 'ok' : 'bad'}" role="status">${esc(PL.msg.text)}</p>` : '') +
    `<h2 class="sec">${t('bl.choose')}</h2>${list}` +
    `<div class="chips">${PL.native && getSession() ? `<button class="btn secondary" data-act="bl-restore"${PL.busy ? ' disabled' : ''}>${t('bl.restore')}</button>` : ''}${manage}</div><p class="muted">${t('bl.terms')}</p>`;
}
// A short line for the AI Speak screen.
export function quotaLine(s) {
  const e = s.entitlement; if (!e || !getSession()) return '';
  const u = e.usage;
  return `<p class="muted">${t('bl.left', { n: Math.max(0, u.ai_turns.limit - u.ai_turns.used) })} ${t('bl.leftVoice', { min: money(Math.max(0, u.stt_seconds.limit - u.stt_seconds.used) / 60) })} <a href="#/plans">${t('bl.open')}</a></p>`;
}

// ---- actions ----
const say = (ok, text) => { PL.msg = { ok, text }; };
async function sendTokens(tokens) {
  const r = await api('POST', '/billing/google/restore', { purchases: tokens.map((x) => ({ purchase_token: x })) });
  setState({ entitlement: { ...r, fetched_at: Date.now() } });
  return r;
}
async function buy(id) {
  const p = plugin(); const plan = (PL.plans || []).find((x) => x.id === id);
  if (!p || !plan || !plan.play_product_id || PL.busy) return;
  PL.busy = true; PL.msg = null; setState({}); track('purchase_started', { plan: plan.id });
  try {
    const ent = getState().entitlement || await refreshEntitlement();
    const tx = await p.purchaseProduct({ productIdentifier: plan.play_product_id, planIdentifier: plan.play_base_plan_id || undefined, productType: SUBS, appAccountToken: ent.billing_ref });
    let r;
    if (tx && tx.purchaseToken) { r = await api('POST', '/billing/google/verify', { purchase_token: tx.purchaseToken }); setState({ entitlement: { ...r, fetched_at: Date.now() } }); }
    else { const { purchases } = await p.getPurchases({ productType: SUBS }); r = await sendTokens((purchases || []).map((x) => x.purchaseToken).filter(Boolean).slice(0, 10)); }
    const now = getState().entitlement;
    if (now && now.plan.id === plan.id) { track('purchase_completed', { plan: plan.id }); say(true, t('bl.msg.ok', { name: now.plan.name })); } else say(false, t('bl.msg.pending'));
  } catch (e) { if (!cancelled(e)) say(false, e && e.code ? errText(e) : t('bl.msg.failed')); }
  PL.busy = false; setState({});
}
async function restore() {
  const p = plugin(); if (!p || PL.busy) return;
  PL.busy = true; PL.msg = null; setState({});
  try {
    await p.restorePurchases();
    const { purchases } = await p.getPurchases({ productType: SUBS });
    const tokens = (purchases || []).map((x) => x.purchaseToken).filter(Boolean).slice(0, 10);
    if (!tokens.length) say(false, t('bl.msg.nothing'));
    else { await sendTokens(tokens); const e = getState().entitlement; say(true, t('bl.msg.restored', { name: e.plan.name })); }
  } catch (e) { say(false, e && e.code ? errText(e) : t('bl.msg.failed')); }
  PL.busy = false; setState({});
}
export async function blAct(el) {
  switch (el.dataset.act) {
    case 'bl-buy': return buy(el.dataset.id);
    case 'bl-restore': return restore();
    case 'bl-reload': PL.loaded = false; PL.err = false; PL.plans = null; return setState({});
    case 'bl-manage': { const p = plugin(); if (p) try { await p.manageSubscriptions(); } catch (e) { /* the Play Store page is not available */ } }
  }
}
