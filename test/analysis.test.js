const test = require('node:test');
const assert = require('node:assert');
const A = require('../analysis.js');

test('tokenize keeps contractions and offsets', () => {
  const t = A.tokenize("I'm fine, thanks.");
  assert.deepStrictEqual(t.map((x) => x.lower), ["i'm", 'fine', 'thanks']);
  assert.strictEqual(t[1].start, 4);
});
test('counts basic and multi-word fillers', () => {
  const r = A.analyze({ transcript: 'Um, I mean, you know, it was uh basically kind of hard.', durationSec: 10 });
  assert.strictEqual(r.fillers.byWord.um, 1);
  assert.strictEqual(r.fillers.byWord['i mean'], 1);
  assert.strictEqual(r.fillers.byWord['you know'], 1);
  assert.strictEqual(r.fillers.byWord.uh, 1);
  assert.strictEqual(r.fillers.byWord.basically, 1);
  assert.strictEqual(r.fillers.byWord['kind of'], 1);
});
test('does not flag "would like to" or "so that" mid-sentence', () => {
  const r = A.analyze({ transcript: 'I would like to join so that I can grow.', durationSec: 5 });
  assert.strictEqual(r.fillers.byWord.like, undefined);
  assert.strictEqual(r.fillers.byWord.so, undefined);
});
test('flags sentence-initial "So," and tag "right?"', () => {
  const r = A.analyze({ transcript: 'So, I tested it. It was broken, right? Then I fixed it.', durationSec: 5 });
  assert.strictEqual(r.fillers.byWord.so, 1);
  assert.strictEqual(r.fillers.byWord.right, 1);
});
test('"the right tool" is not a filler', () => {
  assert.strictEqual(A.analyze({ transcript: 'We picked the right tool.', durationSec: 3 }).fillers.total, 0);
});
test('words per minute and pace bands', () => {
  const words = Array(140).fill('testing').join(' ');
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 60 }).pace, 'good');
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 120 }).wpm, 70);
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 120 }).pace, 'slow');
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 40 }).pace, 'fast');
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 0 }).pace, 'unknown');
});
test('long pauses from segment gaps', () => {
  const segments = [{ start: 0, end: 3 }, { start: 4, end: 8 }, { start: 11.5, end: 14 }, { start: 20, end: 22 }];
  const r = A.analyze({ transcript: 'a b c', durationSec: 22, segments });
  assert.strictEqual(r.pauses.count, 2);
  assert.strictEqual(r.pauses.longest, 6);
  assert.strictEqual(A.analyze({ transcript: 'a', durationSec: 5 }).pauses.available, false);
});
test('hedges detected', () => {
  const r = A.analyze({ transcript: 'I think maybe it was probably fine, I guess.', durationSec: 5 });
  assert.strictEqual(r.hedges.total, 4);
});
test('STAR cues detected in a structured answer', () => {
  const t = 'At my previous company our team had a flaky release. My role was to stabilise tests. I decided to quarantine flaky tests and then I added retries. As a result, failures dropped by 40 percent.';
  const r = A.analyze({ transcript: t, durationSec: 30, category: 'behavioral' });
  assert.ok(r.star.situation && r.star.task && r.star.action && r.star.result);
  assert.strictEqual(r.star.count, 4);
});
test('missing STAR parts produce a tip for behavioral', () => {
  const r = A.analyze({ transcript: 'It was a hard week and stuff happened and it was fine overall honestly.', durationSec: 10, category: 'behavioral' });
  assert.ok(r.tips.some((t) => t.startsWith('Use STAR')));
});
test('repeated words and stutters', () => {
  const r = A.analyze({ transcript: 'The the pipeline pipeline was a pipeline and the pipeline failed.', durationSec: 10 });
  assert.ok(r.repeated.overused.some((o) => o.word === 'pipeline' && o.count === 4));
  assert.ok(r.repeated.stutters.includes('the'));
});
test('length verdicts', () => {
  assert.strictEqual(A.analyze({ transcript: 'Too short.', durationSec: 5 }).length, 'short');
  const words = Array(300).fill('word').join(' ');
  assert.strictEqual(A.analyze({ transcript: words, durationSec: 150, targetSec: 120 }).length, 'long');
});
test('clean answer scores higher than filler-heavy one, always 3 tips, score in range', () => {
  const clean = 'At my previous company our release pipeline failed often. My role was to fix test stability before launch. I analyzed three months of failures, I set up quarantine for flaky tests, and I wrote a dashboard for the team. As a result, pipeline failures dropped by forty percent and we shipped two weeks early. I learned to measure before changing anything, and I now start every project with a baseline.';
  const messy = 'Um, so, like, I think, uh, we had, you know, like a thing, um, and basically, uh, I mean, it was kind of, like, fine I guess, um, maybe.';
  const a = A.analyze({ transcript: clean, durationSec: 30, category: 'behavioral' });
  const b = A.analyze({ transcript: messy, durationSec: 30, category: 'behavioral' });
  assert.ok(a.score > b.score + 30, `${a.score} vs ${b.score}`);
  for (const r of [a, b]) { assert.strictEqual(r.tips.length, 3); assert.ok(r.score >= 0 && r.score <= 100); }
});
test('empty transcript scores 0', () => {
  assert.strictEqual(A.analyze({ transcript: '', durationSec: 10 }).score, 0);
});
test('highlight reconstructs original text', () => {
  const text = 'Um, I think it was like, fine.';
  const parts = A.highlight(text, A.analyze({ transcript: text, durationSec: 4 }));
  assert.strictEqual(parts.map((p) => p.text).join(''), text);
  assert.ok(parts.some((p) => p.type === 'filler') && parts.some((p) => p.type === 'hedge'));
});
test('markdown export includes question, score and transcript', () => {
  const text = 'So, I tested the app.';
  const md = A.toMarkdown({ question: 'Q?', category: 'qa', at: 0, transcript: text, result: A.analyze({ transcript: text, durationSec: 5 }) });
  assert.match(md, /## Q\?/); assert.match(md, /score \d+\/100/); assert.match(md, /> So, I tested the app\./);
});
