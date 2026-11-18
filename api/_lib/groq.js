// Groq is the AI provider for both the coach (chat) and voice to text. Its API follows the OpenAI format.
// Model names can be changed with GROQ_MODEL and STT_MODEL (Vercel variables) without touching the code.
export const GROQ_BASE = 'https://api.groq.com/openai/v1';
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
export const GROQ_STT_MODEL = 'whisper-large-v3-turbo';
