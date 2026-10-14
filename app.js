/* InterviewEcho UI */
(function () {
  'use strict';
  const A = window.EchoAnalysis; const BANKS = window.ECHO_BANKS;
  const $ = (id) => document.getElementById(id);
  const LS = { hist: 'interviewecho.history.v1', custom: 'interviewecho.custom.v1', prefs: 'interviewecho.prefs.v1' };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => `${s < 0 ? '-' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, '0')}`;

  const state = { bank: 'general', idx: 0, history: load(LS.hist, []), custom: load(LS.custom, []), prefs: load(LS.prefs, {}), last: null };

  // ---------- browser support ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ua = navigator.userAgent; const isFirefox = /firefox/i.test(ua); const isSafari = /^((?!chrome|android|crios|edg).)*safari/i.test(ua);
  const sup = $('support');
  if (!SR) { sup.className = 'notice bad'; sup.innerHTML = `<b>Live transcription isn't available in this browser${isFirefox ? ' (Firefox has no speech recognition)' : ''}.</b> Use Chrome or Edge for the full experience, or type/paste a transcript below to still get the analysis.`; }
  else if (isSafari) { sup.className = 'notice warn'; sup.innerHTML = '<b>Safari support is partial.</b> Speech recognition may stop early or miss words. Chrome or Edge on desktop works best.'; }
  else { sup.innerHTML = '✅ Your browser supports live transcription. Chrome or Edge work best; allow microphone access when asked.'; }

  // ---------- questions ----------
  const bankItems = () => state.bank === 'custom' ? state.custom : BANKS[state.bank].items;
  function fillBanks() {
    const sel = $('bank'); sel.innerHTML = '';
    for (const [k, b] of Object.entries(BANKS)) sel.add(new Option(b.label, k));
    sel.add(new Option(`Custom (${state.custom.length})`, 'custom'));
    sel.value = state.bank;
  }
  function currentQ() { const items = bankItems(); return items.length ? items[state.idx % items.length] : 'Add a custom question below to practice it.'; }
  function showQ() {
    const items = bankItems(); const label = state.bank === 'custom' ? 'Custom' : BANKS[state.bank].label;
    $('question').textContent = currentQ();
    $('qMeta').textContent = `${label} · ${items.length ? (state.idx % items.length) + 1 : 0}/${items.length}`;
  }
  $('bank').addEventListener('change', (e) => { state.bank = e.target.value; state.idx = 0; savePrefs(); showQ(); });
  $('nextQ').onclick = () => { state.idx++; showQ(); };
  $('prevQ').onclick = () => { const n = bankItems().length || 1; state.idx = (state.idx - 1 + n) % n; showQ(); };
  $('randQ').onclick = () => { const n = bankItems().length; if (n > 1) { let i; do { i = Math.floor(Math.random() * n); } while (i === state.idx % n); state.idx = i; } showQ(); };

  // ---------- voice ----------
  const synth = window.speechSynthesis;
  function fillVoices() {
    if (!synth) { $('voice').add(new Option('Speech not supported', '')); $('askBtn').disabled = true; return; }
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    const sel = $('voice'); sel.innerHTML = '';
    if (!voices.length) sel.add(new Option('Default voice', ''));
    voices.forEach((v) => sel.add(new Option(`${v.name} (${v.lang})`, v.name)));
    if (state.prefs.voice && voices.some((v) => v.name === state.prefs.voice)) sel.value = state.prefs.voice;
  }
  if (synth) { fillVoices(); synth.onvoiceschanged = fillVoices; } else fillVoices();
  $('rate').value = state.prefs.rate || 1; $('rateVal').textContent = (+$('rate').value).toFixed(1);
  $('rate').oninput = () => { $('rateVal').textContent = (+$('rate').value).toFixed(1); savePrefs(); };
  $('voice').onchange = savePrefs;
  if (state.prefs.timer) $('timerSel').value = state.prefs.timer;
  $('timerSel').onchange = () => { savePrefs(); if (!rec.on) $('timer').textContent = fmt(+$('timerSel').value); };
  if (state.prefs.bank && (BANKS[state.prefs.bank] || state.prefs.bank === 'custom')) state.bank = state.prefs.bank;
  function savePrefs() { state.prefs = { voice: $('voice').value, rate: +$('rate').value, timer: $('timerSel').value, bank: state.bank }; save(LS.prefs, state.prefs); }
  function speak(text) {
    if (!synth) return; synth.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = +$('rate').value; u.lang = 'en-US';
    const v = synth.getVoices().find((x) => x.name === $('voice').value); if (v) u.voice = v;
    synth.speak(u);
  }
  $('askBtn').onclick = () => speak(currentQ());

  // ---------- recording ----------
  const rec = { on: false, t0: 0, results: [], interimStart: {}, recog: null, media: null, chunks: [], stream: null, tick: null, base: 0 };
  function timerTick() {
    const limit = +$('timerSel').value; const el = (performance.now() - rec.t0) / 1000; const left = limit - el;
    const t = $('timer'); t.textContent = fmt(left); t.className = 'timer' + (left < 0 ? ' over' : left < 15 ? ' low' : '');
  }
  function renderLive(interim) {
    const finals = rec.results.map((r) => r.text).join(' ');
    $('live').innerHTML = finals || interim ? `${esc(finals)} <i>${esc(interim || '')}</i>` : '<span class="muted">Listening… start speaking.</span>';
  }
  function startRecog() {
    const r = new SR(); r.lang = 'en-US'; r.continuous = true; r.interimResults = true;
    rec.base = rec.results.length; // result indexes restart each session
    r.onresult = (e) => {
      const now = (performance.now() - rec.t0) / 1000; let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const key = rec.base + i; if (rec.interimStart[key] == null) rec.interimStart[key] = now;
        if (e.results[i].isFinal) rec.results.push({ text: e.results[i][0].transcript, t0: rec.interimStart[key], t1: now });
        else interim += e.results[i][0].transcript;
      }
      renderLive(interim);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopRec(); sup.className = 'notice bad'; sup.textContent = 'Microphone or speech service was blocked. Allow mic access, or type your transcript below.'; } };
    r.onend = () => { if (rec.on) { try { startRecog(); } catch { /* restart failed */ } } };
    rec.recog = r; r.start();
  }
  async function startRec() {
    if (synth) synth.cancel();
    rec.results = []; rec.interimStart = {}; rec.chunks = []; $('playback').hidden = true;
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (window.MediaRecorder) { rec.media = new MediaRecorder(rec.stream); rec.media.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data); rec.media.start(); }
    } catch (err) { if (!SR) { alert('No microphone access. Use the typed transcript option.'); return; } }
    rec.on = true; rec.t0 = performance.now();
    if (SR) startRecog(); else $('live').textContent = 'Recording audio only — this browser cannot transcribe. Type your transcript below afterwards.';
    $('recBtn').textContent = '■ Stop & analyze'; $('recBtn').classList.add('rec');
    renderLive(''); rec.tick = setInterval(timerTick, 250); timerTick();
  }
  function stopRec() {
    if (!rec.on) return; rec.on = false; clearInterval(rec.tick);
    const dur = (performance.now() - rec.t0) / 1000;
    try { rec.recog && rec.recog.stop(); } catch { /* already stopped */ }
    if (rec.media && rec.media.state !== 'inactive') {
      rec.media.onstop = () => { const blob = new Blob(rec.chunks, { type: rec.media.mimeType || 'audio/webm' }); $('playback').src = URL.createObjectURL(blob); $('playback').hidden = false; };
      rec.media.stop();
    }
    if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
    $('recBtn').textContent = '● Start answer'; $('recBtn').classList.remove('rec'); $('timer').className = 'timer';
    // give the recognizer a moment to flush its last final result
    setTimeout(() => {
      const text = rec.results.map((r) => r.text.trim()).join(' ').trim();
      if (!SR) { $('typedBox').open = true; $('typedDur').value = Math.round(dur); return; }
      runAnalysis(text, dur, A.segmentsFromResults(rec.results));
    }, 600);
  }
  $('recBtn').onclick = () => rec.on ? stopRec() : startRec();

  // ---------- analysis + results ----------
  function runAnalysis(text, dur, segments) {
    const result = A.analyze({ transcript: text, durationSec: dur, segments, targetSec: +$('timerSel').value, category: state.bank });
    const entry = { id: Date.now(), at: Date.now(), question: currentQ(), category: state.bank, transcript: text, result: slim(result) };
    state.last = entry; renderResult(entry, result);
    if (result.words) { state.history.unshift(entry); state.history = state.history.slice(0, 100); save(LS.hist, state.history); renderHistory(); }
    return result;
  }
  function slim(r) { return { ...r, issues: undefined, fillers: { ...r.fillers }, hedges: { ...r.hedges }, pauses: { ...r.pauses, gaps: r.pauses.gaps.slice(0, 20) } }; }
  function stat(label, value, cls) { return `<div class="stat ${cls || ''}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`; }
  function renderResult(entry, r) {
    $('results').hidden = false;
    const s = $('score'); s.textContent = r.score; s.className = 'score ' + (r.score >= 80 ? 'ok' : r.score >= 55 ? 'mid' : 'low');
    $('summary').textContent = `"${entry.question}" · ${r.words} words in ${Math.round(r.durationSec)}s`;
    const paceCls = r.pace === 'good' ? 'ok' : r.pace === 'unknown' ? '' : 'warn';
    const fillers = Object.entries(r.fillers.byWord).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ');
    let html = stat(`words per minute (${r.pace}, target ${r.band.min}–${r.band.max})`, r.wpm || '—', paceCls)
      + stat(`fillers · ${r.fillers.rate}/100 words${fillers ? ' · ' + fillers : ''}`, r.fillers.total, r.fillers.rate <= 2 ? 'ok' : r.fillers.rate <= 5 ? 'warn' : 'bad')
      + stat(r.pauses.available ? `long pauses (>2.5s) · longest ${r.pauses.longest}s` : 'long pauses (needs live recording)', r.pauses.available ? r.pauses.count : 'n/a', !r.pauses.available ? '' : r.pauses.count ? 'warn' : 'ok')
      + stat(`length vs ${fmt(r.targetSec)} timer`, r.length, r.length === 'good' ? 'ok' : 'warn')
      + stat(`hedges ${Object.keys(r.hedges.byWord).join(', ')}`, r.hedges.total, r.hedges.total < 2 ? 'ok' : 'warn')
      + stat(`repeated ${[...r.repeated.overused.map((o) => o.word + '×' + o.count), ...r.repeated.stutters.map((x) => x + ' ' + x)].slice(0, 4).join(', ') || 'none'}`, r.repeated.overused.length + r.repeated.stutters.length, r.repeated.overused.length + r.repeated.stutters.length ? 'warn' : 'ok')
      + stat('STAR ' + ['situation', 'task', 'action', 'result'].map((k) => `${k[0].toUpperCase()}${r.star[k] ? '✓' : '✗'}`).join(' ') + (r.star.applicable ? '' : ' (hint)'), `${r.star.count}/4`, r.star.count >= 3 ? 'ok' : r.star.applicable ? 'bad' : '');
    $('stats').innerHTML = html;
    $('tips').innerHTML = r.tips.map((t) => `<li>${esc(t)}</li>`).join('');
    $('transcript').innerHTML = entry.transcript ? A.highlight(entry.transcript, r).map((p) => p.type ? `<mark class="${p.type}">${esc(p.text)}</mark>` : esc(p.text)).join('') : '<span class="muted">No speech captured.</span>';
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('analyzeTyped').onclick = () => {
    const text = $('typed').value.trim(); const dur = Math.max(1, +$('typedDur').value || 60);
    if (!text) { $('typed').focus(); return; }
    runAnalysis(text, dur, null);
  };
  $('retry').onclick = () => { $('results').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ---------- history ----------
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  $('exportOne').onclick = () => state.last && download(`interviewecho-${state.last.id}.md`, '# InterviewEcho answer\n\n' + A.toMarkdown(state.last));
  $('exportAll').onclick = () => state.history.length && download('interviewecho-history.md', '# InterviewEcho history\n\n' + state.history.map(A.toMarkdown).join('\n---\n\n'));
  $('clearHist').onclick = () => { if (confirm('Delete all saved answers in this browser?')) { state.history = []; save(LS.hist, []); renderHistory(); } };
  function spark(svg, values, band) {
    const W = 300, H = 70, P = 8;
    if (values.length < 1) { svg.innerHTML = '<text x="150" y="40" fill="#b4a9d6" font-size="12" text-anchor="middle">Answer a question to see your trend</text>'; return; }
    const lo = Math.min(...values, band ? band[0] : Infinity) * 0.9, hi = Math.max(...values, band ? band[1] : -Infinity) * 1.1 || 1;
    const y = (v) => H - P - ((v - lo) / ((hi - lo) || 1)) * (H - 2 * P);
    const x = (i) => values.length === 1 ? W / 2 : P + i * (W - 2 * P) / (values.length - 1);
    let out = band ? `<rect x="0" y="${y(band[1])}" width="${W}" height="${y(band[0]) - y(band[1])}" fill="#22c55e22"/>` : '';
    out += `<polyline fill="none" stroke="#a78bfa" stroke-width="2" points="${values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
    out += values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#ede9fe"><title>#${i + 1}: ${v}</title></circle>`).join('');
    svg.innerHTML = out;
  }
  function li(e, extra) { return `<li><span class="badge">${e.result.score}</span><span class="q">${esc(e.question)} <span class="muted small">· ${new Date(e.at).toLocaleDateString()} · ${e.result.wpm} wpm · ${e.result.fillers.total} fillers</span></span>${extra || ''}</li>`; }
  function renderHistory() {
    const chron = state.history.slice(0, 30).reverse();
    spark($('trendFiller'), chron.map((e) => e.result.fillers.rate));
    spark($('trendWpm'), chron.map((e) => e.result.wpm), [120, 160]);
    const best = [...state.history].sort((a, b) => b.result.score - a.result.score).slice(0, 5);
    $('best').innerHTML = best.length ? best.map((e) => li(e)).join('') : '<li class="muted">No answers yet.</li>';
    $('history').innerHTML = state.history.length ? state.history.slice(0, 20).map((e) => li(e, `<button data-view="${e.id}">View</button>`)).join('') : '<li class="muted">No answers yet.</li>';
  }
  $('history').onclick = (ev) => { const id = +ev.target.dataset.view; const e = state.history.find((h) => h.id === id); if (e) { state.last = e; renderResult(e, e.result); } };

  // ---------- custom questions ----------
  function renderCustom() {
    $('customList').innerHTML = state.custom.length ? state.custom.map((q, i) => `<li><span class="q">${esc(q)}</span><button data-del="${i}" class="ghost danger">Remove</button></li>`).join('') : '<li class="muted">No custom questions yet.</li>';
    fillBanks();
  }
  $('addQ').onclick = () => { const q = $('customQ').value.trim(); if (!q) return; state.custom.push(q); save(LS.custom, state.custom); $('customQ').value = ''; renderCustom(); };
  $('customQ').onkeydown = (e) => { if (e.key === 'Enter') $('addQ').click(); };
  $('customList').onclick = (e) => { if (e.target.dataset.del != null) { state.custom.splice(+e.target.dataset.del, 1); save(LS.custom, state.custom); renderCustom(); showQ(); } };

  renderCustom(); showQ(); renderHistory(); $('timer').textContent = fmt(+$('timerSel').value);
  window.InterviewEcho = { analyzeTranscript: runAnalysis };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
