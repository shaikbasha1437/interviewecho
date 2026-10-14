/* InterviewEcho analysis engine — pure functions, works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EchoAnalysis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FILLERS = ['you know', 'kind of', 'sort of', 'i mean', 'um', 'uh', 'like', 'basically', 'actually', 'so', 'right', 'umm', 'uhh', 'er', 'erm', 'hmm'];
  const CANON = { umm: 'um', uhh: 'uh', er: 'uh', erm: 'um', hmm: 'um' };
  const HEDGES = ['i think', 'i guess', 'i believe', 'i suppose', 'i feel like', 'maybe', 'probably', 'perhaps', 'possibly', 'might', 'hopefully'];
  const STAR = {
    situation: /\b(situation|context|background|at the time|when i was|while i was|we had|there was|our team|in my (previous|last|current) (role|job|company|project)|the project)\b/i,
    task: /\b(task|goal|responsib\w*|my role|i was (asked|tasked|responsible)|needed to|had to|objective|challenge|deadline)\b/i,
    action: /\b(i (decided|created|built|wrote|led|organized|implemented|designed|tested|automated|reached out|talked|analy[sz]ed|investigated|proposed|set up|started|worked|fixed|introduced|took)|my approach|first,? i|then i|so i)\b/i,
    result: /\b(result\w*|outcome|as a result|in the end|eventually|reduced|increased|improved|saved|cut|delivered|launched|shipped|learned|achieved|\d+\s?(%|percent)|faster|fewer)\b/i
  };
  const STOP = new Set('the a an and or but if then than that this those these with from into onto about there their they them what when where which while would could should have has had were was been being will just also very really your you our ours we me my mine its it his her she him for not are can did does doing done some more most much many such only own same too out over under again once here each both all any few other how why who whom off down because until against between through during before after above below to of in on at by is am be do i'.split(' '));
  const BAND = { min: 120, max: 160 };

  function tokenize(text) {
    const out = []; const re = /[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g; let m;
    while ((m = re.exec(text))) out.push({ w: m[0], lower: m[0].toLowerCase().replace('’', "'"), start: m.index, end: m.index + m[0].length });
    return out;
  }
  function between(text, a, b) { return text.slice(a, b); }

  // Find phrase occurrences in token list; returns arrays of [i, j) token ranges.
  function findPhrases(text, toks, phrases, isFiller) {
    const hits = []; const used = new Array(toks.length).fill(false);
    const sorted = phrases.map((p) => p.split(' ')).sort((x, y) => y.length - x.length);
    for (const parts of sorted) {
      for (let i = 0; i + parts.length <= toks.length; i++) {
        if (used[i]) continue;
        let ok = true;
        for (let k = 0; k < parts.length; k++) if (used[i + k] || toks[i + k].lower !== parts[k]) { ok = false; break; }
        if (!ok) continue;
        const phrase = parts.join(' ');
        if (isFiller && !fillerContextOk(text, toks, i, parts.length, phrase)) continue;
        for (let k = 0; k < parts.length; k++) used[i + k] = true;
        hits.push({ phrase: CANON[phrase] || phrase, i, j: i + parts.length, start: toks[i].start, end: toks[i + parts.length - 1].end });
      }
    }
    return hits.sort((a, b) => a.start - b.start);
  }
  function fillerContextOk(text, toks, i, n, phrase) {
    const prev = toks[i - 1]; const next = toks[i + n];
    const before = prev ? between(text, prev.end, toks[i].start) : '.';
    const after = next ? between(text, toks[i + n - 1].end, next.start) : '.';
    const boundaryBefore = !prev || /[.,!?;:—-]/.test(before);
    const boundaryAfter = !next || /[.,!?;:—-]/.test(after);
    if (phrase === 'so') return boundaryBefore || boundaryAfter; // "So, ..." / "..., so, ..."
    if (phrase === 'right') return boundaryAfter && !(prev && /^(the|that's|is|was|all|turn|go|right)$/.test(prev.lower));
    if (phrase === 'like') {
      if (prev && /^(would|i'd|you'd|we'd|feel|feels|felt|look|looks|looked|seem|seems|sounds|something|just|things|tools|languages|don't|didn't|really|i|we|they|you)$/.test(prev.lower) && !boundaryBefore) return false;
      if (next && /^(to|it|this|that|working|the|a)$/.test(next.lower) && prev && !boundaryBefore) return false;
      return true;
    }
    if (phrase === 'kind of' || phrase === 'sort of') return !(next && /^(a|an|the|thing|person|tool|work|problem|role)$/.test(next.lower) && prev && /^(what|this|that|the|a|which)$/.test(prev.lower));
    if (phrase === 'i mean') return !(next && /^(it|that|to)$/.test(next.lower) && !boundaryAfter) || boundaryBefore;
    return true;
  }

  function pausesFrom(segments, threshold) {
    const gaps = [];
    if (!Array.isArray(segments)) return { available: false, count: 0, longest: 0, gaps };
    const s = segments.filter((x) => x && isFinite(x.start) && isFinite(x.end)).sort((a, b) => a.start - b.start);
    for (let k = 1; k < s.length; k++) {
      const g = s[k].start - s[k - 1].end;
      if (g >= threshold) gaps.push({ at: s[k - 1].end, seconds: +g.toFixed(1) });
    }
    return { available: s.length > 0, count: gaps.length, longest: gaps.reduce((m, g) => Math.max(m, g.seconds), 0), gaps };
  }

  function repeats(toks) {
    const counts = {}; const stutters = [];
    toks.forEach((t, i) => {
      if (i && toks[i - 1].lower === t.lower && !/^\d+$/.test(t.lower)) stutters.push(t.lower);
      if (t.lower.length >= 4 && !STOP.has(t.lower)) counts[t.lower] = (counts[t.lower] || 0) + 1;
    });
    const minCount = Math.max(3, Math.ceil(toks.length / 60));
    const overused = Object.entries(counts).filter(([, c]) => c >= minCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }));
    return { overused, stutters: [...new Set(stutters)] };
  }

  function analyze(input) {
    const opts = Object.assign({ transcript: '', durationSec: 0, segments: null, targetSec: 120, category: 'general', pauseThreshold: 2.5 }, input || {});
    const text = String(opts.transcript || '');
    const toks = tokenize(text);
    const words = toks.length;
    const dur = Math.max(0, +opts.durationSec || 0);
    const minutes = dur / 60;
    const wpm = minutes > 0 ? Math.round(words / minutes) : 0;
    const pace = !dur || !words ? 'unknown' : wpm < BAND.min ? 'slow' : wpm > BAND.max ? 'fast' : 'good';

    const fillerHits = findPhrases(text, toks, FILLERS, true);
    const byWord = {}; fillerHits.forEach((h) => { byWord[h.phrase] = (byWord[h.phrase] || 0) + 1; });
    const fillerRate = words ? +(fillerHits.length / words * 100).toFixed(1) : 0; // per 100 words
    const hedgeHits = findPhrases(text, toks, HEDGES, false);
    const hedgeBy = {}; hedgeHits.forEach((h) => { hedgeBy[h.phrase] = (hedgeBy[h.phrase] || 0) + 1; });
    const pauses = pausesFrom(opts.segments, opts.pauseThreshold);
    const rep = repeats(toks);
    const star = {}; Object.keys(STAR).forEach((k) => { star[k] = STAR[k].test(text); });
    const starCount = Object.values(star).filter(Boolean).length;
    const behavioral = opts.category === 'behavioral';

    let length = 'good';
    if (words < 60 || (dur && dur < 30)) length = 'short';
    else if (opts.targetSec && dur > opts.targetSec * 1.1) length = 'long';

    // Scoring: each issue has a penalty and a matching tip.
    const issues = [];
    const add = (penalty, tip) => { if (penalty > 0) issues.push({ penalty: Math.round(penalty), tip }); };
    if (words === 0) add(100, 'No speech was captured. Check your mic permission, or paste a transcript below.');
    const top = Object.entries(byWord).sort((a, b) => b[1] - a[1])[0];
    if (fillerRate > 2) add(Math.min(30, (fillerRate - 2) * 4), `Cut fillers: ${fillerHits.length} in ${words} words (${fillerRate} per 100)${top ? `, mostly "${top[0]}" ×${top[1]}` : ''}. Pause silently instead of filling the gap.`);
    if (pace === 'slow') add(Math.min(20, (BAND.min - wpm) / 3), `Pick up the pace: ${wpm} wpm is below the ${BAND.min}–${BAND.max} range. Shorter sentences help you sound more confident.`);
    if (pace === 'fast') add(Math.min(20, (wpm - BAND.max) / 3), `Slow down: ${wpm} wpm is above ${BAND.max}. Breathe at the end of each sentence so key points land.`);
    if (pauses.count) add(Math.min(15, pauses.count * 4 + Math.max(0, pauses.longest - 4)), `You had ${pauses.count} long pause${pauses.count > 1 ? 's' : ''} (longest ${pauses.longest}s). Outline 3 bullet points before you start so you don't lose the thread.`);
    if (hedgeHits.length >= 2) add(Math.min(12, hedgeHits.length * 2), `Sound more certain: ${hedgeHits.length} hedges (${Object.keys(hedgeBy).map((h) => `"${h}"`).join(', ')}). Say "I did" or "I recommend" instead of "I think maybe".`);
    if (rep.overused.length || rep.stutters.length) add(Math.min(8, rep.overused.length * 2 + rep.stutters.length * 2), `Vary your wording: ${[...rep.overused.map((o) => `"${o.word}" ×${o.count}`), ...rep.stutters.map((s) => `"${s} ${s}"`)].slice(0, 4).join(', ')}.`);
    if (length === 'short' && words) add(15, `Go deeper: ${words} words${dur ? ` in ${Math.round(dur)}s` : ''} is thin. Add a concrete example with a number or outcome (aim for 60–120 seconds).`);
    if (length === 'long') add(Math.min(12, (dur - opts.targetSec) / 10 + 4), `Tighten up: you went ${Math.round(dur - opts.targetSec)}s over your ${opts.targetSec}s limit. Lead with the result, then give supporting detail.`);
    if (behavioral && words) {
      const missing = Object.keys(star).filter((k) => !star[k]);
      if (missing.length) add(Math.min(18, missing.length * 6), `Use STAR: your answer seems to be missing ${missing.map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')}. ${missing.includes('result') ? 'End with a measurable result ("cut bugs by 30%").' : 'Say clearly what you personally did.'}`);
    } else if (words && !star.result) add(4, 'Finish with an outcome: one sentence on the impact or what you learned makes the answer memorable.');

    issues.sort((a, b) => b.penalty - a.penalty);
    const score = Math.max(0, Math.min(100, 100 - issues.reduce((s, i) => s + i.penalty, 0)));
    const tips = issues.slice(0, 3).map((i) => i.tip);
    const extras = ['Great control. Next time, try a harder question or a shorter timer.', 'Record once more and aim to beat this score with the same question.', 'Practice saying your opening sentence the same way every time so you start strong.'];
    while (tips.length < 3) tips.push(extras[tips.length]);

    return {
      words, durationSec: dur, wpm, pace, band: BAND,
      fillers: { total: fillerHits.length, rate: fillerRate, byWord, hits: fillerHits },
      hedges: { total: hedgeHits.length, byWord: hedgeBy, hits: hedgeHits },
      pauses, repeated: rep, star: Object.assign({ count: starCount, applicable: behavioral }, star),
      length, targetSec: opts.targetSec, score, tips, issues
    };
  }

  // Split transcript into highlighted pieces for rendering: [{text, type: 'filler'|'hedge'|null}]
  function highlight(text, result) {
    const marks = [...result.fillers.hits.map((h) => ({ ...h, type: 'filler' })), ...result.hedges.hits.map((h) => ({ ...h, type: 'hedge' }))]
      .sort((a, b) => a.start - b.start);
    const out = []; let pos = 0;
    for (const m of marks) { if (m.start < pos) continue; if (m.start > pos) out.push({ text: text.slice(pos, m.start), type: null }); out.push({ text: text.slice(m.start, m.end), type: m.type }); pos = m.end; }
    if (pos < text.length) out.push({ text: text.slice(pos), type: null });
    return out;
  }

  // Build approximate per-segment timings from recognition results: [{text, t0, t1}] in seconds.
  function segmentsFromResults(results) {
    return (results || []).filter((r) => r && r.text && r.text.trim()).map((r) => ({ text: r.text.trim(), start: r.t0, end: Math.max(r.t0, r.t1) }));
  }

  function toMarkdown(entry) {
    const r = entry.result; const d = new Date(entry.at);
    return [`## ${entry.question}`, '', `*${d.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${entry.category} · score ${r.score}/100*`, '',
      `- Duration: ${Math.round(r.durationSec)}s · Words: ${r.words} · Pace: ${r.wpm} wpm (${r.pace})`,
      `- Fillers: ${r.fillers.total} (${r.fillers.rate}/100 words) ${Object.entries(r.fillers.byWord).map(([k, v]) => `${k}×${v}`).join(', ')}`,
      `- Long pauses: ${r.pauses.available ? `${r.pauses.count} (longest ${r.pauses.longest}s)` : 'n/a'} · Hedges: ${r.hedges.total}`,
      r.star.applicable ? `- STAR: ${['situation', 'task', 'action', 'result'].map((k) => `${k} ${r.star[k] ? '✓' : '✗'}`).join(', ')}` : null,
      '', '**Tips**', ...r.tips.map((t, i) => `${i + 1}. ${t}`), '', '**Transcript**', '', '> ' + (entry.transcript || '').replace(/\n/g, '\n> '), ''].filter((x) => x !== null).join('\n');
  }

  return { analyze, highlight, tokenize, segmentsFromResults, toMarkdown, FILLERS, HEDGES, BAND };
});
