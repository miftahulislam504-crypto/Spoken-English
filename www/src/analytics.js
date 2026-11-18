// Usage events (plan section 14). Only the fixed names and values in engine/events.js can be recorded: no names, answers, sentences or voice.
// Events wait in a small queue on the phone and are sent in batches. The learner can turn this off in Privacy and data controls.
import { API_BASE } from './runtime-config.js';
import { getSession } from './auth.js';
import { getState } from './store.js';
import { cleanEvent, INSTALL_ID } from './engine/events.js';
import { APP_VERSION } from './config.js';

export const QUEUE_KEY = 'se.events.v1'; export const INSTALL_KEY = 'se.install.v1';
let timer = null; let sending = false;
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or unavailable: events are optional */ } };
export const analyticsOn = () => getState().analytics !== 'off';
const platform = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? 'android' : 'web');

// A random id made on this phone. It is not tied to a name or email, and is thrown away when the learner clears data on the phone.
export function installId() {
  let id = null; try { id = localStorage.getItem(INSTALL_KEY); } catch (e) { /* none */ }
  if (INSTALL_ID.test(id || '')) return id;
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b); else b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  id = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(INSTALL_KEY, id); } catch (e) { /* none */ }
  return id;
}
export const queued = () => read(QUEUE_KEY, []).length;

export function track(name, props = {}) {
  try {
    if (!analyticsOn()) return;
    const c = cleanEvent(name, props); if (!c) return;
    const q = read(QUEUE_KEY, []); q.push({ name: c.name, props: c.props, at: Date.now() }); write(QUEUE_KEY, q.slice(-200));
    schedule();
  } catch (e) { /* counting must never break the app */ }
}
function schedule() {
  if (timer || typeof setTimeout !== 'function') return;
  timer = setTimeout(() => { timer = null; flush(); }, 20000);
  if (timer && timer.unref) timer.unref();
}
// Sends up to 50 waiting events. A refused batch (bad data) is dropped; a network failure keeps it for next time.
export async function flush() {
  if (sending || !analyticsOn() || typeof fetch !== 'function') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const q = read(QUEUE_KEY, []); if (!q.length) return false;
  const batch = q.slice(0, 50); sending = true;
  try {
    const ses = getSession();
    const r = await fetch(`${API_BASE}/api/v1/events`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', ...(ses ? { Authorization: 'Bearer ' + ses.access_token } : {}) }, body: JSON.stringify({ install_id: installId(), platform: platform(), app_version: APP_VERSION, events: batch }) });
    if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) { write(QUEUE_KEY, read(QUEUE_KEY, []).slice(batch.length)); return r.ok; }
    return false;
  } catch (e) { return false; } finally { sending = false; }
}
// When the learner turns statistics off, nothing waiting is sent.
export function clearEvents() { try { localStorage.removeItem(QUEUE_KEY); } catch (e) { /* none */ } }
