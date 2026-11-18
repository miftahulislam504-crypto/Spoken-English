import en, { lists } from './en.js';
import ob from './en.onboarding.js';
import ls from './en.lessons.js';
import vb from './en.vocab.js';
import lis from './en.listening.js';
import acc from './en.account.js';
import spk from './en.speaking.js';
import rv from './en.review.js';
import pg from './en.progress.js';
import bl from './en.billing.js';
import pvc from './en.privacy.js';
const all = { ...en, ...ob, ...ls, ...vb, ...lis, ...acc, ...spk, ...rv, ...pg, ...bl, ...pvc };
export function t(key, params = {}) {
  const s = all[key];
  if (s === undefined) { console.warn('Missing UI string:', key); return key; }
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
}
export const tl = (key) => lists[key] || [];
