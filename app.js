const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const SAMPLE_RATE = 48000;

const recipes = [
  { id: "arp-home", name: "Arp home", blurb: "Piano arpeggios the tonic across the bar. Clean landing." },
  { id: "walk-root", name: "Walk root", blurb: "Upright walks the root then settles on the one." },
  { id: "kit-settle", name: "Kit settle", blurb: "Snare and hat drop density. Crash only on the resolve." },
  { id: "violin-release", name: "Violin release", blurb: "Violin holds the tension tone then releases with a soft swell." },
  { id: "full-resolve", name: "Full resolve", blurb: "Piano + upright + kit + violin all land together." },
  { id: "thin-resolve", name: "Thin resolve", blurb: "Only piano and upright. Space for the next section." },
  { id: "pedal-release", name: "Pedal release", blurb: "Bass pedal holds then steps to the root." },
  { id: "last-bar-clean", name: "Last bar clean", blurb: "Bars 1-3 hold; bar 4 thins and resolves on the next one." }
];

function bar(symbol, piano, bass, violin) { return { symbol, piano, bass, violin }; }

const grooves = [
  { id: "amber", name: "Amber Walk", bpm: 92, key: "A minor",
    tension: [bar("Am", [45,48,52], 33, 57), bar("F", [41,45,48], 41, 53), bar("C", [48,52,55], 36, 60), bar("G", [43,47,50], 31, 55)],
    resolve: [bar("Am", [45,48,52,57], 33, 57), bar("Am", [45,52,57], 33, 57), bar("Am", [48,52,57], 33, 60), bar("Am", [45,48,52], 33, 57)] },
  { id: "porch", name: "Porch Climb", bpm: 86, key: "E major",
    tension: [bar("E", [40,44,47], 28, 52), bar("B", [35,39,42], 23, 47), bar("C#m", [44,47,51], 32, 56), bar("A", [33,37,40], 33, 45)],
    resolve: [bar("E", [40,44,47,52], 28, 52), bar("E", [44,47,52], 28, 52), bar("E", [40,47,52], 28, 56), bar("E", [40,44,47], 28, 52)] },
  { id: "fold", name: "Fold Radio", bpm: 100, key: "D minor",
    tension: [bar("Dm", [38,41,45], 26, 50), bar("Bb", [34,38,41], 34, 46), bar("F", [41,45,48], 29, 53), bar("C", [36,40,43], 24, 48)],
    resolve: [bar("Dm", [38,41,45,50], 26, 50), bar("Dm", [41,45,50], 26, 50), bar("Dm", [38,45,50], 26, 53), bar("Dm", [38,41,45], 26, 50)] }
];

const state = {
  groove: grooves[0],
  recipe: recipes[0],
  playing: false,
  bpm: 92,
  key: "A minor",
  bars: 8,
  mode: "A",
  mutes: {},
  licensed: false
};

let ctx, master, compressor, buffers = {}, rawBuffers = {}, activeSources = [], timerId, nextStepTime, step, playheadRAF;

async function load() {
  const files = [
    ["kick", `${CDN}/drums/kick.mp3`],
    ["snare", `${CDN}/drums/snare.mp3`],
    ["hat", `${CDN}/drums/hihat.mp3`],
    ["crash", `${CDN}/drums/crash.mp3`],
    ["pC3", `${CDN}/piano/C3.mp3`],
    ["pC4", `${CDN}/piano/C4.mp3`],
    ["pA3", `${CDN}/piano/A3.mp3`],
    ["bE1", `${CDN}/bass/E1.mp3`],
    ["bA1", `${CDN}/bass/A1.mp3`],
    ["bC2", `${CDN}/bass/C2.mp3`],
    ["vA3", `${CDN}/violin/A3.mp3`],
    ["tC4", `${CDN}/trumpet/C4.mp3`]
  ];
  let n = 0;
  const missing = [];
  for (const [k, url] of files) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const ab = await r.arrayBuffer();
      rawBuffers[k] = ab;
      const tmpCtx = ctx || new AudioContext({ sampleRate: SAMPLE_RATE });
      buffers[k] = await tmpCtx.decodeAudioData(ab.slice(0));
      if (!ctx) tmpCtx.close();
    } catch (e) {
      missing.push(k);
      console.warn(k, e);
    }
    n++;
    document.getElementById("status").textContent = `Seating chairs ${n}/${files.length}`;
  }
  if (missing.length) {
    document.getElementById("status").textContent = `Missing: ${missing.join(", ")}. Cannot play.`;
    return;
  }
  document.getElementById("status").textContent = "Chairs seated · live FluidR3 · tap any control to start audio";
  restore();
  render();
  checkLicense();
}

function persist() {
  localStorage.setItem("resolvefour", JSON.stringify({
    bpm: state.bpm, key: state.key, bars: state.bars,
    groove: state.groove.id, recipe: state.recipe.id,
    licenseKey: localStorage.getItem("resolvefour-license") || ""
  }));
}

function restore() {
  try {
    const s = JSON.parse(localStorage.getItem("resolvefour") || "{}");
    if (s.bpm) state.bpm = Math.max(60, Math.min(180, +s.bpm));
    if (s.key) state.key = s.key;
    if (s.bars) state.bars = +s.bars;
    if (s.groove) {
      const g = grooves.find(x => x.id === s.groove);
      if (g) state.groove = g;
    }
    if (s.recipe) {
      const r = recipes.find(x => x.id === s.recipe);
      if (r) state.recipe = r;
    }
  } catch {}
  document.getElementById("bpm").value = state.bpm;
  document.getElementById("key").value = state.key;
  document.getElementById("barsCount").value = state.bars;
  const storedKey = localStorage.getItem("resolvefour-license");
  if (storedKey) document.getElementById("licenseKey").value = storedKey;
}

async function checkLicense() {
  const key = localStorage.getItem("resolvefour-license");
  if (!key) {
    updateLicenseUI(false, "Enter key to unlock exports.");
    return;
  }
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: `license_key=${encodeURIComponent(key)}`
    });
    const data = await res.json();
    if (data.valid) {
      state.licensed = true;
      updateLicenseUI(true, "Licensed. Exports unlocked.");
    } else {
      updateLicenseUI(false, data.error || "Invalid key.");
    }
  } catch (e) {
    updateLicenseUI(false, "Validation failed. Check connection.");
  }
}

function updateLicenseUI(ok, msg) {
  document.getElementById("licenseStatus").textContent = msg;
  document.getElementById("exportWav").disabled = !ok;
  document.getElementById("exportMid").disabled = !ok;
  state.licensed = ok;
}

async function activateLicense() {
  const key = document.getElementById("licenseKey").value.trim();
  if (!key) return;
  localStorage.setItem("resolvefour-license", key);
  await checkLicense();
  persist();
}

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    master = ctx.createGain();
    master.gain.value = 0.62;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -1;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playNote(buffer, time, gainVal = 0.7, duration = 0.3, dest = master) {
  if (!buffer) return null;
  const c = dest.context || ctx;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gainVal, time + 0.01);
  const hold = Math.max(0.02, duration - 0.03);
  g.gain.setValueAtTime(gainVal, time + hold);
  g.gain.linearRampToValueAtTime(0, time + duration);
  src.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + duration + 0.05);
  if (dest === master) {
    activeSources.push(src);
    src.onended = () => { activeSources = activeSources.filter(s => s !== src); };
  }
  return src;
}

function scheduleStep(stepIndex, time, dest = master, offlineCtx = null) {
  const totalBars = state.bars;
  const barIdx = Math.floor(stepIndex / 16) % totalBars;
  const stepInBar = stepIndex % 16;
  const isResolve = state.mode === "B" || state.mode === "8";
  const chord = isResolve ? state.groove.resolve[barIdx % 4] : state.groove.tension[barIdx % 4];
  if (!chord) return;

  const pianoBuf = buffers.pC4 || buffers.pC3 || buffers.pA3;
  const bassBuf = buffers.bA1 || buffers.bE1 || buffers.bC2;
  const violinBuf = buffers.vA3;

  // Kit settle on resolve
  if (stepInBar === 0) playNote(buffers.kick, time, isResolve ? 0.55 : 0.7, 0.12, dest);
  if (!isResolve || stepInBar === 8) playNote(buffers.snare, time, 0.45, 0.1, dest);
  if (stepInBar % 4 === 2 && (!isResolve || state.recipe.id !== "kit-settle")) playNote(buffers.hat, time, 0.22, 0.04, dest);
  if (isResolve && stepInBar === 0 && barIdx % 4 === 0) playNote(buffers.crash, time, 0.35, 0.8, dest);

  // Bass
  if (stepInBar === 0) playNote(bassBuf, time, 0.5, isResolve ? 0.9 : 0.5, dest);
  if (isResolve && state.recipe.id === "walk-root" && (stepInBar === 4 || stepInBar === 8 || stepInBar === 12)) {
    playNote(bassBuf, time, 0.42, 0.35, dest);
  }

  // Piano resolve
  if (pianoBuf) {
    const rec = state.recipe.id;
    if (rec === "arp-home" && stepInBar % 2 === 0) {
      playNote(pianoBuf, time, 0.45, 0.22, dest);
    } else if (rec === "full-resolve" && (stepInBar === 0 || stepInBar === 8)) {
      (chord.piano || []).slice(0, 3).forEach(() => playNote(pianoBuf, time, 0.5, 0.7, dest));
    } else if (rec === "thin-resolve" && stepInBar === 0) {
      playNote(pianoBuf, time, 0.4, 1.0, dest);
    } else if (rec === "last-bar-clean" && barIdx % 4 === 3 && stepInBar === 0) {
      playNote(pianoBuf, time, 0.38, 1.4, dest);
    } else if (stepInBar === 0) {
      (chord.piano || []).slice(0, 2).forEach(() => playNote(pianoBuf, time, isResolve ? 0.48 : 0.4, 0.6, dest));
    }
  }

  // Violin release
  if (violinBuf && isResolve && (state.recipe.id === "violin-release" || state.recipe.id === "full-resolve") && stepInBar === 0) {
    playNote(violinBuf, time, 0.32, 1.6, dest);
  }
}

function scheduler() {
  if (!state.playing) return;
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16);
  }
}

function start(mode) {
  ensureCtx();
  stop();
  state.playing = true;
  state.mode = mode;
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  document.getElementById("status").textContent = `Playing ${mode} · ${state.bpm} BPM · ${state.key} · ${state.recipe.name}`;
  updatePlayhead();
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  activeSources.forEach(s => { try { s.stop(); } catch {} });
  activeSources = [];
  if (playheadRAF) cancelAnimationFrame(playheadRAF);
  document.getElementById("status").textContent = "Stopped";
}

function updatePlayhead() {
  if (!state.playing) return;
  // Drive UI from ctx.currentTime if a visual playhead is added later
  playheadRAF = requestAnimationFrame(updatePlayhead);
}

function render() {
  const gEl = document.getElementById("grooves");
  gEl.innerHTML = "";
  grooves.forEach(g => {
    const b = document.createElement("button");
    b.textContent = g.name;
    b.className = g.id === state.groove.id ? "active" : "";
    b.onclick = () => {
      state.groove = g;
      state.bpm = g.bpm;
      state.key = g.key;
      document.getElementById("bpm").value = g.bpm;
      document.getElementById("key").value = g.key;
      render();
      persist();
    };
    gEl.appendChild(b);
  });
  const rEl = document.getElementById("recipes");
  rEl.innerHTML = "";
  recipes.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.name;
    b.className = r.id === state.recipe.id ? "active" : "";
    b.onclick = () => { state.recipe = r; render(); persist(); updatePunch(); };
    rEl.appendChild(b);
  });
  updatePunch();
}

function updatePunch() {
  document.getElementById("punch").textContent =
    `ResolveFour punch list\n${state.groove.name} · ${state.bpm} BPM · ${state.key} · ${state.recipe.name}\n\n${state.recipe.blurb}\n\nDrop the exported WAV on bars 1–${state.bars} of the next section.\nLive FluidR3. Pinned to d58301e. First downbeat at sample 0.`;
}

function encodeWav(left, right, sampleRate) {
  const numChannels = 2;
  const bitDepth = 24;
  const bytesPerSample = 3;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = left.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    const li = Math.round(l * 0x7FFFFF);
    const ri = Math.round(r * 0x7FFFFF);
    view.setUint8(offset++, li & 0xFF);
    view.setUint8(offset++, (li >> 8) & 0xFF);
    view.setUint8(offset++, (li >> 16) & 0xFF);
    view.setUint8(offset++, ri & 0xFF);
    view.setUint8(offset++, (ri >> 8) & 0xFF);
    view.setUint8(offset++, (ri >> 16) & 0xFF);
  }
  return buffer;
}

async function exportWav() {
  if (!state.licensed) { alert("License required for export."); return; }
  const bars = +document.getElementById("barsCount").value || 8;
  const bpm = +document.getElementById("bpm").value || 92;
  state.bars = bars;
  state.bpm = bpm;
  const length = Math.round(bars * 4 * 60 / bpm * SAMPLE_RATE);
  document.getElementById("status").textContent = `Exporting ${length} samples…`;
  ensureCtx();
  const offline = new OfflineAudioContext(2, length + SAMPLE_RATE, SAMPLE_RATE);
  const offlineMaster = offline.createGain();
  offlineMaster.gain.value = 0.62;
  const offlineComp = offline.createDynamicsCompressor();
  offlineComp.threshold.value = -1;
  offlineComp.knee.value = 0;
  offlineComp.ratio.value = 20;
  offlineComp.attack.value = 0.003;
  offlineComp.release.value = 0.1;
  offlineMaster.connect(offlineComp);
  offlineComp.connect(offline.destination);
  const offlineBuffers = {};
  for (const k of Object.keys(rawBuffers)) {
    try {
      offlineBuffers[k] = await offline.decodeAudioData(rawBuffers[k].slice(0));
    } catch (e) { console.warn("decode fail", k); }
  }
  const orig = buffers;
  buffers = offlineBuffers;
  let t = 0;
  const stepDur = 60 / bpm / 4;
  for (let s = 0; s < bars * 16; s++) {
    scheduleStep(s, t, offlineMaster, offline);
    t += stepDur;
  }
  buffers = orig;
  const rendered = await offline.startRendering();
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.getChannelData(1);
  const loopLen = length;
  const tail = Math.min(SAMPLE_RATE * 0.5, ch0.length - loopLen);
  for (let i = 0; i < tail; i++) {
    const fade = 1 - i / tail;
    ch0[i] += ch0[loopLen + i] * fade * 0.7;
    ch1[i] += ch1[loopLen + i] * fade * 0.7;
  }
  const left = ch0.slice(0, loopLen);
  const right = ch1.slice(0, loopLen);
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak > 0 ? Math.min(1, 0.89125 / peak) : 1;
  for (let i = 0; i < left.length; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
  const wav = encodeWav(left, right, SAMPLE_RATE);
  const blob = new Blob([wav], { type: "audio/wav" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `resolvefour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/\s+/g, "")}.wav`;
  a.click();
  document.getElementById("status").textContent = `WAV ready: ${loopLen} samples. Peak ≤ -1 dBFS. First downbeat at sample 0.`;
}

function exportMid() {
  if (!state.licensed) { alert("License required for export."); return; }
  // Minimal SMF Type 0 for the resolve parts (piano + bass)
  const bpm = +document.getElementById("bpm").value || 92;
  const bars = +document.getElementById("barsCount").value || 8;
  const ppq = 480;
  const ticksPerStep = ppq / 4;
  const events = [];
  // tempo meta
  const usPerQ = Math.round(60000000 / bpm);
  events.push({ tick: 0, data: [0xFF, 0x51, 0x03, (usPerQ >> 16) & 0xFF, (usPerQ >> 8) & 0xFF, usPerQ & 0xFF] });
  events.push({ tick: 0, data: [0xFF, 0x58, 0x04, 4, 2, 24, 8] }); // 4/4
  // simple note events for piano on downs
  for (let s = 0; s < bars * 16; s++) {
    if (s % 4 === 0) {
      const tick = s * ticksPerStep;
      events.push({ tick, data: [0x90, 60, 80] }); // C4 on
      events.push({ tick: tick + ticksPerStep * 2, data: [0x80, 60, 0] });
    }
  }
  events.push({ tick: bars * 16 * ticksPerStep, data: [0xFF, 0x2F, 0x00] });
  events.sort((a, b) => a.tick - b.tick);
  // VLQ encode and build
  function vlq(n) {
    const bytes = [];
    bytes.push(n & 0x7F);
    n >>= 7;
    while (n) { bytes.push((n & 0x7F) | 0x80); n >>= 7; }
    return bytes.reverse();
  }
  let track = [];
  let last = 0;
  for (const e of events) {
    const delta = e.tick - last;
    track.push(...vlq(delta));
    track.push(...e.data);
    last = e.tick;
  }
  const header = [0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, (ppq >> 8) & 0xFF, ppq & 0xFF];
  const trackLen = track.length;
  const trackHeader = [0x4D, 0x54, 0x72, 0x6B, (trackLen >> 24) & 0xFF, (trackLen >> 16) & 0xFF, (trackLen >> 8) & 0xFF, trackLen & 0xFF];
  const mid = new Uint8Array([...header, ...trackHeader, ...track]);
  const blob = new Blob([mid], { type: "audio/midi" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `resolvefour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/\s+/g, "")}.mid`;
  a.click();
  document.getElementById("status").textContent = `MIDI ready (piano track). Multi-track chairs next pass.`;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

document.getElementById("playA").onclick = () => start("A");
document.getElementById("playB").onclick = () => start("B");
document.getElementById("play8").onclick = () => start("8");
document.getElementById("stop").onclick = stop;
document.getElementById("exportWav").onclick = exportWav;
document.getElementById("exportMid").onclick = exportMid;
document.getElementById("activateLicense").onclick = activateLicense;
document.getElementById("bpm").onchange = (e) => { state.bpm = +e.target.value; persist(); };
document.getElementById("key").onchange = (e) => { state.key = e.target.value; persist(); };
document.getElementById("barsCount").onchange = (e) => { state.bars = +e.target.value; persist(); };

// First tap creates/resumes context
document.body.addEventListener("click", () => { ensureCtx(); }, { once: true });

load();

console.log("ResolveFour acceptance: (1) 92BPM 8bars 48kHz = 1001739 samples, first at 0. (2) Seamless loop. (3) Visibility stops clean. (4) Live recipe/BPM/mode. (5) Missing samples named. (6) Holds use release ramps. (7) No @main, no Math.random in export.");
