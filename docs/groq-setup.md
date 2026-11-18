# AI coach and voice to text with Groq

Both AI parts use one provider: Groq (groq.com). One key, `GROQ_API_KEY`, runs the AI coach (AI Speak replies and corrections) and voice to text (the recording is turned into text). You do not need an Anthropic or an OpenAI key.

## Steps (from a phone browser)
1. Go to console.groq.com, sign up, open API Keys, create a key. It starts with `gsk_`. Copy it at once; it is shown only one time.
2. Vercel > Project Settings > Environment Variables: add `GROQ_API_KEY` with that key (Production). Then Redeploy.
3. GitHub > Settings > Secrets and variables > Actions > New repository secret: `GROQ_API_KEY` with the same key. It is used only by the "AI evaluation" workflow.
4. Open `https://YOUR-SITE.vercel.app/admin/`, Overview. The lines "AI coach key" and "voice to text key" should say set (groq) and name the model.
5. Run Actions > AI evaluation > Run workflow. Open the run, then Summary. It must say PASSED. This is the first test against the real Groq, so read any FAILED line.
6. In the app: sign in, open AI Speak, send one typed answer, then one voice answer.

## Models
| Part | Default | Change with |
| --- | --- | --- |
| AI coach | `openai/gpt-oss-120b` | Vercel variable `GROQ_MODEL` (and the GitHub variable `GROQ_MODEL` for the evaluation) |
| Voice to text | `whisper-large-v3-turbo` | Vercel variable `STT_MODEL` (the better but slower one is `whisper-large-v3`) |

- `openai/gpt-oss-20b` is faster and cheaper but weaker. If a reply is poor in Bengali or breaks the rules, try the 120b model first, then run the AI evaluation again.
- `llama-3.3-70b-versatile` also works if your Groq account has access to it.
- Model names change on Groq's side. If AI Speak suddenly says "not available", check console.groq.com/docs/models and the Vercel Logs line `ai_error`; a 404 or 400 there often means the model name is gone. Set `GROQ_MODEL` to a current one and redeploy.
- Use the model names exactly as Groq writes them (small letters, with the slash).

## Prices for the cost estimate (optional but needed for budgets)
Groq's price page at the time of writing (check it again, prices change). Put these in Vercel, then redeploy:
| Variable | Value for the default models |
| --- | --- |
| `AI_PRICE_INPUT_PER_MTOK` | 0.15 |
| `AI_PRICE_OUTPUT_PER_MTOK` | 0.60 |
| `STT_PRICE_PER_MINUTE` | 0.00067 (that is 0.04 dollars per hour) |
Groq bills each voice request for at least 10 seconds, so very short recordings cost a little more than the estimate. The Overview and AI tab show estimates, not Groq's invoice.

## Limits and the free plan
- Groq has rate limits per account (requests and tokens per minute and per day). On the free plan they are low and can stop the coach for a while when many learners practise together. Learners then see "AI coach not available right now" and typing practice, lessons and review keep working.
- Before the closed beta, look at your limits in the Groq console under Limits and, if needed, move to the paid Developer plan. Also set a spending limit there.
- The per-learner daily limits and the budgets of this app (docs/billing-and-limits.md) work the same as before.

## Switching back
Anthropic and OpenAI still work as an alternative: if `GROQ_API_KEY` is not set and `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set, those are used (models `ANTHROPIC_MODEL` and `STT_MODEL`). When `GROQ_API_KEY` is set it always wins. To go back, delete `GROQ_API_KEY` in Vercel and redeploy.

## Privacy
Groq receives the text of the learner's speaking turn (to write the reply) and the recording (to turn it into text). Check Groq's current data terms when you write the privacy policy (`docs/privacy-policy-draft.md`).
