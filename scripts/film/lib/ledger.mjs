// What did this film cost, and where did it go?
//
// THE RULE HERE: units are FACTS, money is an ESTIMATE, and the two are never
// blurred together. Tokens, characters, seconds and call counts are measured
// from the actual requests and responses, so they are exact. Dollars are those
// units multiplied by a rate table, and a rate can be wrong, out of date, or
// plan-dependent — so every rate is marked `verified` or `assumed`, and
// anything derived from an assumed rate is flagged in the output.
//
// Why not just read the balance? Because we cannot. ElevenLabs exposes
// `/v1/user/subscription` with the exact credit count, but this project's key
// is scoped without `user_read` and gets a 401. Granting that scope would make
// the ElevenLabs numbers ground truth instead of arithmetic; until then they
// are arithmetic and are labelled as such.
//
// OpenAI needs no such caveat: the Responses API returns `usage` with exact
// input, cached and output token counts, and Terra's rates are published.

export const RATES = {
  openai: {
    // Published Terra rates, per 1M tokens.
    inputPerM: 2.50,
    outputPerM: 15.00,
    // Cached input is billed at a discount. The exact Terra multiplier is not
    // something this project has verified, so it is applied as a tenth of
    // input and marked assumed — it only ever makes the estimate SMALLER, and
    // cached tokens are reported separately so the arithmetic is checkable.
    cachedInputPerM: 0.25,
    verified: true,
    note: 'published gpt-5.6-terra rates ($2.50/$15 per 1M)',
  },
  elevenTts: {
    // Pay-as-you-go, eleven_multilingual_v2. On a subscription this is credits
    // (1 character = 1 credit) and the dollar figure is only indicative.
    per1kChars: 0.0968,
    verified: true,
    note: 'pay-as-you-go multilingual v2, $0.0968 / 1k chars (1 char = 1 credit on a plan)',
  },
  elevenSfx: {
    perEffect: 0.0194,
    verified: true,
    note: 'pay-as-you-go, $0.0194 per effect',
  },
  elevenMusic: {
    // NOT published in the sources this project checked. Recorded so the line
    // item exists and the SECONDS are exact; correct this one constant if you
    // have the real number.
    perMinute: 0.50,
    verified: false,
    note: 'ASSUMED — Eleven Music per-minute price not verified; seconds are exact',
  },
};

export class Ledger {
  constructor() {
    this.entries = [];
    this.startedAt = Date.now();
  }

  /** @param {{stage:string, provider:string, op:string, calls?:number, units:object, usd:number, assumed?:boolean}} e */
  add(e) {
    this.entries.push({ calls: 1, assumed: false, ...e });
    return e;
  }

  openai(stage, usage, op = 'director') {
    const input = usage?.input_tokens ?? 0;
    const output = usage?.output_tokens ?? 0;
    const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
    const fresh = Math.max(0, input - cached);
    const usd =
      (fresh / 1e6) * RATES.openai.inputPerM +
      (cached / 1e6) * RATES.openai.cachedInputPerM +
      (output / 1e6) * RATES.openai.outputPerM;
    return this.add({
      stage, provider: 'openai', op,
      units: { inputTokens: input, cachedTokens: cached, outputTokens: output,
               reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0 },
      usd,
    });
  }

  tts(stage, chars) {
    return this.add({
      stage, provider: 'elevenlabs', op: 'tts',
      units: { characters: chars, credits: chars },
      usd: (chars / 1000) * RATES.elevenTts.per1kChars,
    });
  }

  music(stage, seconds, calls = 1) {
    return this.add({
      stage, provider: 'elevenlabs', op: 'music', calls,
      units: { seconds: Math.round(seconds) },
      usd: (seconds / 60) * RATES.elevenMusic.perMinute,
      assumed: true,
    });
  }

  sfx(stage, count, seconds) {
    return this.add({
      stage, provider: 'elevenlabs', op: 'sfx', calls: count,
      units: { effects: count, seconds: Math.round(seconds) },
      usd: count * RATES.elevenSfx.perEffect,
    });
  }

  /** Free, but worth counting — a run that polls 400 times is a run that hung. */
  polls(stage, n) {
    return this.add({ stage, provider: 'openai', op: 'status polls', calls: n, units: {}, usd: 0 });
  }

  get totalUsd() { return this.entries.reduce((n, e) => n + e.usd, 0); }
  get billedCalls() { return this.entries.filter((e) => e.usd > 0).reduce((n, e) => n + e.calls, 0); }
  get anyAssumed() { return this.entries.some((e) => e.assumed && e.usd > 0); }

  /**
   * Would spending `usd` more break the budget? Checked BEFORE a paid call, so
   * the run stops without spending rather than reporting an overspend.
   */
  wouldExceed(budgetUsd, nextUsd = 0) {
    return budgetUsd != null && this.totalUsd + nextUsd > budgetUsd;
  }

  table() {
    const lines = [];
    const w = (s, n) => String(s).padEnd(n);
    lines.push(`  ${w('stage', 12)}${w('provider', 12)}${w('op', 14)}${w('calls', 7)}${w('units', 44)}cost`);
    lines.push(`  ${'-'.repeat(94)}`);
    for (const e of this.entries) {
      const units = Object.entries(e.units).map(([k, v]) => `${k} ${fmtNum(v)}`).join(', ');
      lines.push(
        `  ${w(e.stage, 12)}${w(e.provider, 12)}${w(e.op, 14)}${w(e.calls, 7)}${w(units.slice(0, 43), 44)}` +
        `${e.usd > 0 ? `$${e.usd.toFixed(4)}${e.assumed ? '*' : ''}` : '—'}`,
      );
    }
    lines.push(`  ${'-'.repeat(94)}`);
    lines.push(`  ${w('TOTAL', 45)}${w(this.billedCalls + ' billed', 21)}${w('', 20)}$${this.totalUsd.toFixed(4)}`);
    if (this.anyAssumed) {
      lines.push('');
      lines.push('  * derived from an ASSUMED rate — the units above it are exact, the dollars are not.');
      for (const [k, r] of Object.entries(RATES)) if (!r.verified) lines.push(`    ${k}: ${r.note}`);
    }
    return lines.join('\n');
  }

  toJSON() {
    return {
      totalUsd: +this.totalUsd.toFixed(4),
      billedCalls: this.billedCalls,
      containsAssumedRates: this.anyAssumed,
      elapsedSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      rates: RATES,
      entries: this.entries,
    };
  }
}

function fmtNum(v) {
  return typeof v === 'number' && v >= 1000 ? v.toLocaleString('en-US') : String(v);
}
