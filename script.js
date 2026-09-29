
// Creating the Inital Strings
const strings = [
  { name: "1st String", short: 1, note: "E2", freq: 82.41,  group: "groupA" },
  { name: "2nd String", short: 2, note: "A2", freq: 110.000, group: "groupB" },
  { name: "3rd String", short: 3, note: "D3", freq: 146.83, group: "groupA" },
  { name: "4th String", short: 4, note: "G3", freq: 196, group: "groupB" },
  { name: "5th String", short: 5, note: "B3", freq: 246.94, group: "groupA" },
  { name: "6th String", short: 6, note: "E4", freq: 329.63, group: "groupB" }
];

const toCents = ratio => 1200 * Math.log2(ratio);

const TEMPERED_FIFTH_CENTS = toCents(Math.pow(5, 1/4));     // ~696.6¢
const WOLF_FIFTH_CENTS     = TEMPERED_FIFTH_CENTS + toCents(128 / 125); // ~737.6¢


// Reference intervals in cents (calculated from exact ratios)
const REFERENCE_INTERVALS = [
  { name: "Minor 3rd (pure, 6:5)",       cents: toCents (6 / 5) },
  { name: "Minor 3rd (tempered)",        cents: toCents(4 * Math.pow(5, -3/4)) },
  { name: "Major 3rd (pure, 5:4)",       cents: toCents(5 / 4) },
  { name: "Perfect 4th (pure, 4:3)",     cents: toCents(4 / 3) },
  { name: "Perfect 4th (tempered)",      cents: toCents(2 * Math.pow(5, -1/4)) },
  { name: "Perfect 5th (tempered)",      cents: TEMPERED_FIFTH_CENTS },
  { name: "Perfect 5th (pure, 3:2)",     cents: toCents(3 / 2) }
];

const MATCH_TOLERANCE = 15; // cents — how close counts as "this interval"

// Creating the Tuning Logic
function frequencyToNote(freq) {
  if (!freq || freq <= 0) return null;
  const A4 = 440;
  const noteNames = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const midi = 69 + 12 * Math.log2(freq / A4);
  const midiRounded = Math.round(midi);
  const cents = Math.round((midi - midiRounded) * 100);
  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  return {
    name: noteNames[noteIndex] + octave,
    cents: cents
  };
}

// Creating Logic for Measuring Cents
function centsBetween(freqA, freqB) {
  return Math.abs(toCents(freqB / freqA)) % 1200;
}

function classifyInterval(freqA, freqB) {
  const reduced = centsBetween(freqA, freqB);

// Closest named interval
const best = REFERENCE_INTERVALS.reduce((a,b) =>
  Math.abs(reduced - b.cents) <Math.abs(reduced - a.cents) ? b: a);
const diff = reduced - best.cents;
if (Math.abs(diff) <= MATCH_TOLERANCE) 
  return { label: best.name, deviation: diff };

// Fifth-sized but not matching anything: wolf, or out of tune
if (reduced>= 660 && reduced <= 750) {
  const woldDiff = reduced - WOLF_FIFTH_CENTS;
  return Math.abs(woldDiff) <= MATCH_TOLERANCE
  ? { label: "Wolf Fifth", deviation: woldDiff}
  : {label: "Fifth-ish, out of tune", deviation: reduced - TEMPERED_FIFTH_CENTS};
}
return null;
}

// Updates Interval Relationships
function updateIntervalPanel() {
  const panel = document.getElementById("intervalPanel");
  if (!panel) return;
  const entries = strings.map((s, i) => ({
    label: `${s.short} (${s.note})`,
    freq: parseFloat(document.getElementById("freq-string-" + i).value)
  }));


  const customEl = document.getElementById("customFreq");
  if (customEl && !isNaN(parseFloat(customEl.value))) {
    entries.push({ label: "Ref", freq: parseFloat(customEl.value) });
  }

  const results = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (!a.freq || !b.freq) continue;
      const match = classifyInterval(a.freq, b.freq);
      if (match) {
        const sign = match.deviation > 0 ? "+" : "";
        results.push(`${a.label} ↔ ${b.label}: ${match.label} (${sign}${match.deviation.toFixed(1)}¢)`);
      }
    }
  }

  panel.innerHTML = results.length
    ? results.map(r => `<div class="intervalRow">${r}</div>`).join("")
    : `<div class="intervalRow muted">No significant just/tempered relationships detected</div>`;
}

function updateNoteDisplay(id) {
  const freqInput = document.getElementById("freq-" + id);
  const noteDiv = document.getElementById("note-" + id);
  if (!freqInput || !noteDiv) return;
  const result = frequencyToNote(parseFloat(freqInput.value));
  if (!result) { noteDiv.textContent = "—"; return; }
  const sign = result.cents > 0 ? "+" : "";
  noteDiv.textContent = `${result.name}  (${sign}${result.cents}¢)`;
}

let audioCtx = null;
const activeVoices = {}; // id -> { osc, gain }

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function masterVol() {
  return parseFloat(document.getElementById("masterVolume").value);
}


// Generates the Oscillators and Controlling Buttons
function startTone(id, freq, btn) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(masterVol(), ctx.currentTime + 0.03);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  activeVoices[id] = { osc, gain };
  btn.classList.add("playing");
  btn.textContent = "Stop";
}

function stopTone(id, btn) {
  const voice = activeVoices[id];
  if (!voice) return;
  const ctx = getCtx();
  voice.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
  voice.osc.stop(ctx.currentTime + 0.05);
  delete activeVoices[id];
  if (btn) {
    btn.classList.remove("playing");
    btn.textContent = "Play";
  }
}

function stopAll() {
  Object.keys(activeVoices).forEach(id => {
    const btn = document.querySelector(`button[data-id="${id}"]`);
    stopTone(id, btn);
  });
}


function buildStringRows() {
  const tbody = document.querySelector("#stringTable tbody");
  strings.forEach((s, i) => {
    const id = "string-" + i;
    const tr = document.createElement("tr");
    tr.className = "row " + s.group;
    tr.innerHTML = `
      <td><div class="stringName">${s.name}</div><div class="noteName" id="note-${id}">${s.note}</div></td>
      <td><input type="number" step="0.001" class="freqInput" id="freq-${id}" value="${s.freq}"></td>
      <td><button class="playBtn" data-id="${id}">Play</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function togglePlay(id, btn, freqInput) {
  const freq = parseFloat(freqInput.value);
  if (activeVoices[id]) stopTone(id, btn);
else if (freq > 0) startTone(id, freq, btn); 
}


function attachPlayHandlers() {
  document.querySelectorAll("#stringTable .playBtn").forEach(btn => {
    const id = btn.dataset.id;
    btn.addEventListener("click", () =>
    togglePlay(id, btn, document.getElementById("freq-" + id)));

  });
  const customBtn = document.getElementById("customPlay");
  customBtn.addEventListener("click", () =>
  togglePlay("custom", customBtn, document.getElementById("customFreq")));
}

// ------------------------------Fretboard Harmonics Graph ---------------------------------------------------
// ---------- Fretboard harmonics graph ----------
const MAX_HARMONIC = 6;   // highest harmonic shown (2 = octave, 3 = octave + fifth, ...)
const MAX_FRET = 24;
const INLAYS = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1, 17: 1, 19: 1, 21: 1, 24: 2 };

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Fret number (12-TET spacing) of a point `fraction` of the way along the string from the nut
const fretAt = fraction => -12 * Math.log2(1 - fraction);

// Every touch-point k/n that sounds harmonic n (must be fully reduced: 2/4 is really harmonic 2)
const HARMONIC_NODES = [];
for (let n = 2; n <= MAX_HARMONIC; n++) {
  for (let k = 1; k < n; k++) {
    if (gcd(k, n) !== 1) continue;
    const fret = fretAt(k / n);
    if (fret <= MAX_FRET + 0.01) HARMONIC_NODES.push({ n, k, fret });
  }
}

function drawFretboard() {
  const host = document.getElementById("fretboard");
  if (!host) return;

  const W = 1000, padL = 100, padR = 30, padT = 30, rowGap = 50;
  const count = strings.length;
  const boardBottom = padT + rowGap * (count - 1);
  const H = boardBottom + 60;
  const unit = (W - padL - padR) / (1 - Math.pow(2, -MAX_FRET / 12));
  const xAt = fret => padL + unit * (1 - Math.pow(2, -fret / 12));
  const yAt = i => boardBottom - rowGap * i;          // 1st String (low E) at the bottom
  const r = v => v.toFixed(1);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fretboard showing natural harmonics for the current tuning">`;

  // Inlay dots
  const midY = padT + (rowGap * (count - 1)) / 2;
  Object.entries(INLAYS).forEach(([fretKey, dots]) => {
    const fret = Number(fretKey);
    const x = (xAt(fret - 1) + xAt(fret)) / 2;
    const ys = dots === 2 ? [midY - rowGap, midY + rowGap] : [midY];
    ys.forEach(y => { svg += `<circle class="inlay" cx="${r(x)}" cy="${r(y)}" r="9"/>`; });
  });

  // Nut, fret wires and fret numbers
  for (let f = 0; f <= MAX_FRET; f++) {
    const x = r(xAt(f));
    svg += `<line class="${f ? "fretLine" : "nut"}" x1="${x}" y1="${padT - 12}" x2="${x}" y2="${boardBottom + 12}"/>`;
    if (f) svg += `<text class="fretNum" x="${x}" y="${boardBottom + 40}" text-anchor="middle">${f}</text>`;
  }

  // Strings and their harmonic markers
  strings.forEach((s, i) => {
    const y = yAt(i);
    const input = document.getElementById("freq-string-" + i);
    const f0 = input ? parseFloat(input.value) : s.freq;

    svg += `<text class="stringLabel" x="${padL - 14}" y="${r(y + 4)}" text-anchor="end">${s.name}</text>`;
    svg += `<line class="stringLine" x1="${padL}" y1="${r(y)}" x2="${r(xAt(MAX_FRET))}" y2="${r(y)}"/>`;
    if (!(f0 > 0)) return;

    HARMONIC_NODES.forEach(({ n, k, fret }) => {
      const x = xAt(fret), hz = f0 * n, note = frequencyToNote(hz);
      const sign = note && note.cents > 0 ? "+" : "";
      const tip = `${s.name}, harmonic ${n} (touch ${k}/${n} along the string, fret ${fret.toFixed(2)}): ${hz.toFixed(2)} Hz`
        + (note ? ` ≈ ${note.name} (${sign}${note.cents}¢)` : "");
      svg += `<g class="harmonic h${n}"><title>${tip}</title>`
        + `<circle cx="${r(x)}" cy="${r(y)}" r="10"/>`
        + `<text class="hNum" x="${r(x)}" y="${r(y + 4)}" text-anchor="middle">${n}</text>`
        + `<text class="hHz" x="${r(x)}" y="${r(y + 25)}" text-anchor="middle">${hz.toFixed(1)}</text></g>`;
    });
  });

  host.innerHTML = svg + "</svg>";
}
// ------------------------------Fretboard Harmonics Graph ---------------------------------------------------



function attachFrequencyInputHandlers() {
  strings.forEach((s, i) => {
    const id = "string-" + i;
    const freqInput = document.getElementById("freq-" + id);
    freqInput.addEventListener("input", () => {
      updateNoteDisplay(id);
      updateIntervalPanel();
      drawFretboard();
    });
    updateNoteDisplay(id); // set correct label on page load
  });
  document.getElementById("customFreq").addEventListener("input", updateIntervalPanel);
  updateIntervalPanel(); // set correct intervals on page load
  drawFretboard();
}


function attachMasterControls() {
  document.getElementById("stopAll").addEventListener("click", stopAll);

  document.getElementById("masterVolume").addEventListener("input", () => {
    const ctx = audioCtx;
    if (!ctx) return;
    Object.values(activeVoices).forEach(v => {
      v.gain.gain.setValueAtTime(masterVol(), ctx.currentTime);
    });
  });
}

function init() {
  buildStringRows();
  attachPlayHandlers();
  attachFrequencyInputHandlers();
  attachMasterControls();
}

document.addEventListener("DOMContentLoaded", init);
