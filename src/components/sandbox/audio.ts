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
  sfx.gain.value = 0.7;
  sfx.connect(master);
  master.connect(ctx.destination);
  const data = new Float32Array(ctx.sampleRate * 1);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
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
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
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

function tone(freq: number, type: OscillatorType, start: number, dur: number, peak: number) {
  if (!ctx || !sfx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const g = envGain(start, peak, 0.008, dur);
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
  kind: "scoop" | "dump" | "dig" | "water" | "smash" | "castle" | "find" | "drop" | "wood",
) {
  if (muted) return;
  const ac = ensure();
  if (ac.state === "suspended") return;
  const t = ac.currentTime;
  const jitter = 0.92 + Math.random() * 0.16;

  if (kind === "scoop" || kind === "dig") {
    const src = noiseSrc(0.7 * jitter);
    if (!src) return;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = kind === "dig" ? 420 : 680;
    bp.Q.value = 0.7;
    const g = envGain(t, 0.18, 0.01, 0.16);
    if (!g) return;
    src.connect(bp);
    bp.connect(g);
    src.start(t);
    src.stop(t + 0.2);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    return;
  }

  if (kind === "dump") {
    const src = noiseSrc(0.45 * jitter);
    if (!src) return;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = envGain(t, 0.28, 0.02, 0.28);
    if (!g) return;
    src.connect(lp);
    lp.connect(g);
    src.start(t);
    src.stop(t + 0.32);
    src.onended = () => {
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };
    return;
  }

  if (kind === "water") {
    const src = noiseSrc(1.4 * jitter);
    if (!src) return;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    const g = envGain(t, 0.12, 0.005, 0.12);
    if (!g) return;
    src.connect(bp);
    bp.connect(g);
    src.start(t);
    src.stop(t + 0.14);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    return;
  }

  if (kind === "smash") {
    tone(90 * jitter, "sine", t, 0.22, 0.28);
    const src = noiseSrc(0.5);
    if (!src) return;
    const g = envGain(t, 0.32, 0.005, 0.25);
    if (!g) return;
    src.connect(g);
    src.start(t);
    src.stop(t + 0.28);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    return;
  }

  if (kind === "castle") {
    tone(220 * jitter, "triangle", t, 0.12, 0.12);
    tone(330 * jitter, "triangle", t + 0.04, 0.14, 0.08);
    return;
  }

  if (kind === "find") {
    tone(523, "sine", t, 0.16, 0.14);
    tone(659, "sine", t + 0.08, 0.18, 0.12);
    tone(784, "sine", t + 0.16, 0.28, 0.1);
    return;
  }

  if (kind === "drop") {
    tone(180 * jitter, "triangle", t, 0.1, 0.1);
    return;
  }

  if (kind === "wood") {
    tone(140 * jitter, "sine", t, 0.08, 0.12);
    const src = noiseSrc(0.9);
    if (!src) return;
    const g = envGain(t, 0.08, 0.002, 0.06);
    if (!g) return;
    src.connect(g);
    src.start(t);
    src.stop(t + 0.08);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}
