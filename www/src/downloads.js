// Downloaded lessons (plan section 15, offline downloads): what is on this phone, and updated lessons published since the app was installed.
import { t } from './i18n/index.js';
import { setState } from './store.js';
import { allLessons } from './engine/lessons.js';
import { packInfo, checkUpdates, downloadUpdates, removeDownloads, lessonTitle } from './content-pack.js';
import { isOnline } from './errors.js';
import { errText } from './account.js';
import { esc } from './util.js';

const DL = { check: null, busy: false, msg: null };
const kb = (n) => Math.max(1, Math.round(n / 1024));

export function downloads() {
  const info = packInfo(); const total = allLessons().length;
  const upd = DL.check ? (DL.check.count ? t('dl.available', { n: DL.check.count }) : t('dl.upToDate')) : '';
  return `<a class="back" href="#/settings">${t('dl.back')}</a><h1>${t('dl.title')}</h1><p class="muted">${t('dl.intro')}</p>` +
    `<section class="card"><h2>${t('dl.onPhone')}</h2><p>${t('dl.count', { n: total })}</p>` +
    `<p class="muted">${info.count ? t('dl.updates', { n: info.count, kb: kb(info.bytes) }) : t('dl.noUpdates')}</p></section>` +
    `<section class="card"><h2>${t('dl.check')}</h2>${!isOnline() ? `<p class="muted">${t('dl.offline')}</p>` : ''}` +
    (DL.check && DL.check.needed.length ? `<ul class="plain">${DL.check.needed.slice(0, 12).map((x) => `<li>${esc(lessonTitle(x.id))}</li>`).join('')}</ul>` : '') +
    (upd ? `<p>${upd}</p>` : '') + (DL.msg ? `<p class="fb ${DL.msg.ok ? 'ok' : 'bad'}" role="alert">${esc(DL.msg.text)}</p>` : '') +
    `<button class="btn secondary" data-act="dl-check"${DL.busy || !isOnline() ? ' disabled' : ''}>${DL.busy ? t('ac.working') : t('dl.check')}</button>` +
    (DL.check && DL.check.count ? `<button class="btn" data-act="dl-get"${DL.busy ? ' disabled' : ''}>${t('dl.get')}</button>` : '') + `</section>` +
    (info.count || info.retired ? `<section class="card"><h2>${t('dl.remove')}</h2><p class="muted">${t('dl.remove.note')}</p><button class="btn secondary" data-act="dl-remove">${t('dl.remove')}</button></section>` : '') +
    `<p class="muted">${t('dl.audio')}</p>`;
}
export async function dlAct(el) {
  const k = el.dataset.act;
  if (k === 'dl-remove') { if (!confirm(t('dl.remove.confirm'))) return; removeDownloads(); DL.check = null; DL.msg = { text: t('dl.removed'), ok: true }; return setState({}); }
  DL.busy = true; DL.msg = null; setState({});
  try {
    if (k === 'dl-check') DL.check = await checkUpdates();
    if (k === 'dl-get') { const r = await downloadUpdates(DL.check); DL.check = null; DL.msg = { text: t('dl.done', { n: r.downloaded }), ok: true }; }
  } catch (e) { DL.msg = { text: errText(e), ok: false }; }
  DL.busy = false; setState({});
}
