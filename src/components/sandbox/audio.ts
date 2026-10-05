let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC({ latencyHint: "interactive" });
  master = ctx.createGain();
  sfx = ctx.createGain();
  sfx.gain.value = 0.85;
  sfx.connect(master);
  master.connect(ctx.destination);
  const data = new Float32Array(ctx.sampleRate * 2);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.003 * white;
    b1 = 0.96 * b1 + 0.04 * white;
    b2 = 0.7 * b2 + 0.3 * white;
    data[i] = b0 * 1.4 + b1 * 0.55 + (white - b2) * 0.25;
  }
  noise = ctx.createBuffer(1, data.length, ctx.sampleRate);
  noise.getChannelData(0).set(data);
  return ctx;
}

export function unlockAudio() {
  const ac = ensure();
  if (ac.state === "suspended") void ac.resume();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx?.state === "suspended") void ctx.resume();
  });
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.03);
}

function envGain(start: number, peak: number, attack: number, decay: number) {
  if (!ctx || !sfx) return null;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  g.connect(sfx);
  return g;
}

function noiseSrc(rate = 1) {
  if (!ctx || !noise) return null;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = rate;
  return src;
}

function grain(
  start: number,
  rate: number,
  filter: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
) {
  const ac = ctx;
  if (!ac) return;
  const src = noiseSrc(rate);
  const g = envGain(start, peak, attack, decay);
  if (!src || !g) return;
  const bp = ac.createBiquadFilter();
  bp.type = filter;
  bp.frequency.setValueAtTime(freq, start);
  bp.Q.value = q;
  src.connect(bp);
  bp.connect(g);
  const stop = start + attack + decay + 0.02;
  src.start(start);
  src.stop(stop);
  src.onended = () => {
    src.disconnect();
    bp.disconnect();
    g.disconnect();
  };
}

function body(freq: number, start: number, dur: number, peak: number) {
  if (!ctx || !sfx) return;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.55), start + dur);
  const g = envGain(start, peak, 0.012, dur);
  if (!g) return;
  osc.connect(g);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export function playSfx(
  kind: "scoop" | "dump" | "dig" | "water" | "smash" | "castle" | "find" | "drop" | "wood" | "lift" | "grab",
) {
  if (muted) return;
  const ac = ensure();
  if (ac.state === "suspended") return;
  const t = ac.currentTime;
  const jitter = 0.94 + Math.random() * 0.1;

  if (kind === "scoop") {
    grain(t, 0.42 * jitter, "lowpass", 720, 0.6, 0.11, 0.04, 0.22);
    grain(t, 1.15 * jitter, "bandpass", 1900, 0.8, 0.035, 0.01, 0.12);
    return;
  }
  if (kind === "dig") {
    grain(t, 0.33 * jitter, "bandpass", 280, 0.55, 0.16, 0.02, 0.16);
    grain(t + 0.02, 0.7, "highpass", 1400, 0.4, 0.03, 0.01, 0.08);
    return;
  }
  if (kind === "dump") {
    grain(t, 0.28 * jitter, "lowpass", 540, 0.5, 0.2, 0.03, 0.38);
    grain(t + 0.04, 0.9, "bandpass", 1100, 0.6, 0.05, 0.02, 0.2);
    return;
  }
  if (kind === "water") {
    grain(t, 1.35 * jitter, "bandpass", 2600, 0.45, 0.07, 0.02, 0.28);
    grain(t, 0.6, "lowpass", 900, 0.4, 0.04, 0.04, 0.3);
    return;
  }
  if (kind === "smash") {
    body(52 * jitter, t, 0.2, 0.22);
    grain(t, 0.22, "lowpass", 180, 0.7, 0.28, 0.004, 0.18);
    return;
  }
  if (kind === "castle") {
    grain(t, 0.55 * jitter, "lowpass", 480, 0.8, 0.12, 0.006, 0.1);
    body(96 * jitter, t, 0.07, 0.05);
    return;
  }
  if (kind === "lift") {
    grain(t, 0.8 * jitter, "bandpass", 900, 0.7, 0.05, 0.01, 0.09);
    return;
  }
  if (kind === "grab") {
    grain(t, 1.1, "bandpass", 700, 1.2, 0.06, 0.004, 0.05);
    return;
  }
  if (kind === "find") {
    body(523, t, 0.14, 0.06);
    body(659, t + 0.07, 0.16, 0.05);
    body(784, t + 0.14, 0.22, 0.04);
    return;
  }
  if (kind === "drop") {
    grain(t, 0.4 * jitter, "lowpass", 640, 0.6, 0.1, 0.008, 0.12);
    return;
  }
  grain(t, 0.3, "lowpass", 220, 0.5, 0.08, 0.004, 0.08);
}
