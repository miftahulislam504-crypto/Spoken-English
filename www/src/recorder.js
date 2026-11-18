// Microphone recording for speaking practice. Recordings stay in memory; nothing is saved on the phone.
let rec = null; let chunks = []; let stream = null; let startedAt = 0; let timer = null;
export const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
export async function startRec(onLimit) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(); startedAt = Date.now();
  timer = setTimeout(() => { if (onLimit) onLimit(); }, 30000);
}
export function stopRec() {
  return new Promise((resolve) => {
    clearTimeout(timer);
    if (!rec) return resolve({ blob: null, duration_ms: 0 });
    rec.onstop = () => {
      stream.getTracks().forEach((x) => x.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const out = { blob, duration_ms: Date.now() - startedAt };
      rec = null; resolve(out);
    };
    rec.stop();
  });
}
export const toBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
