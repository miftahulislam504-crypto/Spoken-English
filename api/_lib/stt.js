import { ApiError } from './http.js';
import { timedFetch } from './supabase.js';
import { GROQ_BASE, GROQ_STT_MODEL } from './groq.js';

const EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
const bad = (d) => new ApiError(400, 'invalid_input', undefined, d);
export function cleanAudio(a) {
  if (!a || typeof a !== 'object') throw bad('audio is invalid');
  const mime = String(a.mime || '').split(';')[0].toLowerCase();
  if (!EXT[mime]) throw bad('audio type is not supported');
  if (typeof a.data !== 'string' || a.data.length < 100 || a.data.length > 3500000 || !/^[A-Za-z0-9+/=]+$/.test(a.data)) throw bad('audio is invalid');
  if (!Number.isInteger(a.duration_ms) || a.duration_ms < 300 || a.duration_ms > 60000) throw bad('audio length is invalid');
  return { data: a.data, mime, duration_ms: a.duration_ms };
}
// Groq is used when GROQ_API_KEY is set. OpenAI stays as an optional alternative when only OPENAI_API_KEY is set.
export const sttProvider = () => (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? 'openai' : null);
export const sttModel = () => process.env.STT_MODEL || (sttProvider() === 'openai' ? 'whisper-1' : GROQ_STT_MODEL);
// Speech to text. The recording is sent to the provider for this one request and is not stored by us.
export async function transcribe(audio) {
  const provider = sttProvider();
  if (!provider) throw new ApiError(503, 'stt_unavailable');
  const key = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const url = provider === 'groq' ? `${GROQ_BASE}/audio/transcriptions` : 'https://api.openai.com/v1/audio/transcriptions';
  const bytes = Buffer.from(audio.data, 'base64');
  const model = sttModel();
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: audio.mime }), `speech.${EXT[audio.mime]}`);
  fd.append('model', model); fd.append('language', 'en'); fd.append('response_format', provider === 'groq' || model === 'whisper-1' ? 'verbose_json' : 'json');
  const r = await timedFetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd }, 12000);
  if (!r.ok) { console.error('stt_error', r.status); throw new ApiError(503, 'stt_unavailable'); }
  const j = await r.json();
  const segs = Array.isArray(j.segments) ? j.segments : [];
  const text = String(j.text || '').trim();
  const noSpeech = !text || (segs.length > 0 && segs.every((s) => (s.no_speech_prob || 0) > 0.6));
  const conf = segs.length ? segs.reduce((n, s) => n + Math.exp(Math.min(0, typeof s.avg_logprob === 'number' ? s.avg_logprob : -1)), 0) / segs.length : null;
  return { text: noSpeech ? '' : text, confidence: conf === null ? null : Math.round(conf * 100) / 100, duration_s: Number(j.duration) || audio.duration_ms / 1000, segments: segs.map((s) => ({ start: s.start, end: s.end })) };
}
