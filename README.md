# InterviewEcho

**Spoken interview practice coach that runs entirely in your browser.** InterviewEcho reads a question aloud, records your spoken answer, and shows you filler words, speaking pace, long pauses, hedging, repeated words and STAR structure, with a score and three concrete tips.

**Live app:** https://shaikbasha1437.github.io/interviewecho/

## Features

- **Question banks:** General ("Tell me about yourself"), Behavioral (STAR), QA / Testing, Data engineering, plus your own custom questions. Use Next, Prev or Random.
- **Asks out loud** with the Web Speech API (`speechSynthesis`), with a voice and rate picker.
- **Answer timer** (1–5 min, default 2 min) that warns when time is running low or over.
- **Live transcript** via `SpeechRecognition` (continuous + interim results, auto-restarts if the browser ends the session mid-answer). Timing is approximated per recognized phrase.
- **Audio playback** of your answer with `MediaRecorder`.
- **Analysis:**
  - Filler words (um, uh, like, you know, basically, actually, so, kind of, sort of, I mean, right) with counts, highlighted in the transcript. Context rules avoid false hits such as "would like to", "so that" or "the right tool".
  - Words per minute against a 120–160 wpm target band.
  - Long pauses (gaps > 2.5 s between recognized phrases): count and longest.
  - Answer length compared with your timer.
  - STAR hints: detects Situation / Task / Action / Result cues.
  - Repeated words and stutters ("the the").
  - Hedges (I think, maybe, probably, I guess…).
  - Overall score 0–100 and the three most useful tips.
- **History** in localStorage with filler-rate and WPM trend charts, best answers, and Markdown export (one answer or all).
- **No-mic fallback:** type or paste a transcript plus a duration to get the same analysis.
- **Installable PWA** that works offline (analysis and typed mode; live speech recognition needs the browser's online speech service).

## Browser support

| Browser | Live transcript | Ask aloud / playback |
|---|---|---|
| Chrome, Edge (desktop & Android) | ✅ | ✅ |
| Safari | ⚠️ partial, may stop early | ✅ |
| Firefox | ❌ (use typed mode) | ✅ |

## Privacy

There is no server. History and custom questions live only in your browser's localStorage, and recordings stay in the tab. However, Chrome and Edge perform speech recognition through the browser vendor's speech service, which may process your audio. Typed transcripts never leave your device.

## Develop

Plain HTML/CSS/JS, no build step.

```bash
npx serve .        # or any static server
npm test           # node --test, analysis engine tests
```

`analysis.js` is a dependency-free engine usable in Node or the browser:

```js
const { analyze } = require('./analysis.js');
analyze({ transcript: 'Um, so I fixed the build.', durationSec: 5, category: 'behavioral' });
```

## Limits

- Pace, pauses and fillers depend on what the browser's speech recognizer returns. Recognizers often drop "um" and "uh", so live filler counts can be lower than reality.
- Word timing is approximated from when each phrase was recognized, not measured per word.
- STAR detection is keyword-based: a hint, not a grade.

## License

MIT
