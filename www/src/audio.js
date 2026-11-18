const LANG = { us: 'en-US', uk: 'en-GB', in: 'en-IN', au: 'en-AU', any: 'en-US' };
export const RATE = { slow: 0.7, normal: 0.95, natural: 1.15 };
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
function voiceFor(lang) {
  const vs = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  return vs.find((v) => v.lang === lang) || vs.find((v) => v.lang && v.lang.slice(0, 2) === lang.slice(0, 2)) || null;
}
function utter(text, accent, rate, pitch = 1) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG[accent] || 'en-US'; u.rate = rate || RATE.normal; u.pitch = pitch;
  const v = voiceFor(u.lang); if (v) u.voice = v;
  return u;
}
export function speak(text, accent = 'any', rate = RATE.normal) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel(); speechSynthesis.speak(utter(text, accent, rate));
  return true;
}
// Dialogue: speaker B gets a different pitch so two voices are easy to tell apart.
export function speakLines(lines, accent = 'any', rate = RATE.normal) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  lines.forEach((l) => speechSynthesis.speak(utter(l.text, accent, rate, l.who === 'B' ? 1.3 : 0.9)));
  return true;
}
export async function requestMic() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unavailable';
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    st.getTracks().forEach((x) => x.stop());
    return 'granted';
  } catch (e) { return 'denied'; }
}
