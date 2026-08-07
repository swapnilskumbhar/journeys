// The director's mouth. One function, one endpoint.
//
// Shape confirmed live before anything was built on it, which was worth doing:
// the published docs page rendered a garbled example (it printed an
// api.anthropic.com host), and guessing from it would have been wrong.
//
// What was actually verified:
//   · POST {base}/responses, Bearer auth
//   · model `gpt-5.6-terra` — text + image input
//   · `text.format = { type: 'json_schema', name, schema, strict: true }`
//   · `reasoning.effort` accepted
//   · output[] carries a `reasoning` item BEFORE the `message` item, so
//     output[0].content is undefined and reading it is the obvious bug here.
import { readFileSync } from 'node:fs';
import { OPENAI_KEY, OPENAI_BASE, OPENAI_MODEL } from './env.mjs';

const TERMINAL = new Set(['completed', 'failed', 'incomplete', 'cancelled']);

/**
 * Poll a background response to completion.
 *
 * Deliberately patient: a high-effort multimodal call can run for many
 * minutes, and there is nothing to do but wait. A transient network error
 * while polling is NOT fatal — the work is still running on the server, so a
 * failed poll is retried rather than thrown, up to a run of consecutive
 * failures that means the connection is genuinely gone.
 */
async function poll(id, log, { intervalMs = 4000, maxMinutes = 25 } = {}) {
  const deadline = Date.now() + maxMinutes * 60_000;
  let consecutiveErrors = 0;
  let ticks = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch(`${OPENAI_BASE}/responses/${id}`, {
        headers: { authorization: `Bearer ${OPENAI_KEY}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      consecutiveErrors = 0;
      if (TERMINAL.has(json.status)) return { json, ticks };
      if (++ticks % 15 === 0) log(`  still thinking… ${Math.round((ticks * intervalMs) / 1000)}s`);
    } catch (err) {
      if (++consecutiveErrors >= 10) throw new Error(`lost the connection while polling ${id}: ${err.message}`);
    }
  }
  throw new Error(`background response ${id} did not finish within ${maxMinutes} minutes`);
}

/**
 * @param {object} o
 * @param {string} o.instructions   system-level framing
 * @param {Array}  o.content        Responses-API content parts (text + images)
 * @param {object} [o.schema]       JSON schema; when present the reply is strict JSON
 * @param {string} [o.effort]       reasoning effort: minimal | low | medium | high
 */
export async function ask({ instructions, content, schema, schemaName = 'reply', effort = 'medium', maxTokens = 32000, log = () => {} }) {
  const body = {
    model: OPENAI_MODEL,
    instructions,
    input: [{ role: 'user', content }],
    reasoning: { effort },
    max_output_tokens: maxTokens,
    // BACKGROUND MODE, and it is not optional at this size.
    //
    // A high-effort call over twenty-odd images thinks for several minutes
    // before emitting a single token, and Node's fetch (undici) gives up at
    // 300s with a bare `fetch failed` — no status, no body, nothing to
    // distinguish it from a network fault. It cost one full director run to
    // find that. Streaming does not fix it either: undici's body timeout
    // applies BETWEEN chunks, and a reasoning model sends nothing at all until
    // it has finished thinking.
    //
    // So the POST returns immediately with an id, and we poll. Every
    // individual request is then short, and the model may take as long as it
    // likes.
    background: true,
    store: true, // background responses must be retrievable
  };
  if (schema) {
    body.text = { format: { type: 'json_schema', name: schemaName, schema, strict: true } };
  }

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  let json = await res.json();
  let polls = 0;

  if (json.background && !TERMINAL.has(json.status)) {
    const r = await poll(json.id, log);
    json = r.json;
    polls = r.ticks;
  }

  // Reasoning tokens are drawn from the SAME budget as the answer, so a model
  // that thinks hard and then gets cut off returns status `incomplete` with a
  // perfectly well-formed but EMPTY output. Silently returning '' from here
  // would surface as "the director wrote no shots", days from the cause.
  if (json.status === 'failed') {
    throw new Error(`OpenAI response failed: ${json.error?.message ?? 'no reason given'}`);
  }
  if (json.status === 'incomplete') {
    throw new Error(
      `OpenAI reply incomplete (${json.incomplete_details?.reason ?? 'unknown'}) — ` +
      `raise maxTokens above ${maxTokens} or lower reasoning effort`,
    );
  }

  const msg = json.output?.find((o) => o.type === 'message');
  const text = msg?.content?.find((c) => c.type === 'output_text')?.text;
  if (!text) throw new Error(`OpenAI returned no message content (status ${json.status})`);

  return {
    text,
    json: schema ? JSON.parse(text) : null,
    usage: json.usage,
    polls,
  };
}

/** An image content part from a file on disk. */
export function imagePart(path, mime = 'image/png') {
  return { type: 'input_image', image_url: `data:${mime};base64,${readFileSync(path).toString('base64')}` };
}

export function textPart(text) {
  return { type: 'input_text', text };
}

/** Rough USD, at Terra's published $2.50 / $15 per 1M. */
export function costOf(usage) {
  if (!usage) return 0;
  return (usage.input_tokens / 1e6) * 2.5 + (usage.output_tokens / 1e6) * 15;
}
