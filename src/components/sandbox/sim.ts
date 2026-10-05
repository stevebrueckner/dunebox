export const COLS = 97;
export const SIZE = 10.4;
export const PIT = 5.7;
export const CELL = SIZE / (COLS - 1);
export const MAX_H = 2.85;
export const FLOOR = -1.28;

const DEG = Math.PI / 180;

export const LAYERS = [
  { id: "bed", name: "Bed earth", min: -2, hint: "Packed dark sand. Finds hide here." },
  { id: "deep", name: "Deep pack", min: -0.2, hint: "Damp, stubborn. Dig slowly." },
  { id: "damp", name: "Damp gold", min: 0.22, hint: "Best for keeping a castle upright." },
  { id: "loose", name: "Loose dune", min: 0.58, hint: "Dry grains. They slump." },
  { id: "surface", name: "Surface", min: 0.86, hint: "Sun-bleached top." },
] as const;

export type LayerId = (typeof LAYERS)[number]["id"];

export type Crunch = { x: number; y: number; z: number; mag: number };

export type BuriedSeed = {
  id: string;
  kind: TreasureKind;
  name: string;
  x: number;
  z: number;
  depth: number;
};

export type TreasureKind =
  | "shell"
  | "star"
  | "marble"
  | "car"
  | "coin"
  | "key"
  | "bell"
  | "beetle";

export const TREASURES: { kind: TreasureKind; name: string }[] = [
  { kind: "shell", name: "Moon shell" },
  { kind: "star", name: "Starfish" },
  { kind: "marble", name: "Sea-glass marble" },
  { kind: "car", name: "Tin racer" },
  { kind: "coin", name: "Old coin" },
  { kind: "key", name: "Brass key" },
  { kind: "bell", name: "Tiny bell" },
  { kind: "beetle", name: "Jade beetle" },
];

function hash(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x: number, z: number): number {
  let a = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    a += amp * valueNoise(x * f, z * f);
    f *= 2;
    amp *= 0.5;
  }
  return a;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Angle of repose from moisture + packing. Dry ~34°, peak cohesion ~84°, slurry ~16°. */
export function reposeAngle(moisture: number, packed: number): number {
  const dry = 34 * DEG;
  const peak = 84 * DEG;
  const slurry = 16 * DEG;
  const m = clamp(moisture, 0, 1);
  const a = m < 0.42 ? lerp(dry, peak, m / 0.42) : lerp(peak, slurry, (m - 0.42) / 0.58);
  return a + packed * 10 * DEG;
}

export function layerAt(h: number) {
  let current: (typeof LAYERS)[number] = LAYERS[0];
  for (const layer of LAYERS) {
    if (h >= layer.min) current = layer;
  }
  return current;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export class SandSim {
  readonly cols = COLS;
  readonly size = SIZE;
  readonly cell = CELL;
  heights: Float32Array;
  moisture: Float32Array;
  packed: Float32Array;
  dirty = true;
  crumbles: Crunch[] = [];
  buried: BuriedSeed[] = [];
  private dH: Float32Array;
  private dM: Float32Array;
  private dP: Float32Array;
  private seedValue = 1337;
  private history: { h: Float32Array; m: Float32Array; p: Float32Array }[] = [];
  time = 0;

  constructor() {
    const n = COLS * COLS;
    this.heights = new Float32Array(n);
    this.moisture = new Float32Array(n);
    this.packed = new Float32Array(n);
    this.dH = new Float32Array(n);
    this.dM = new Float32Array(n);
    this.dP = new Float32Array(n);
    this.seed(1337);
  }

  idx(ix: number, iz: number) {
    return iz * COLS + ix;
  }

  inBounds(ix: number, iz: number) {
    return ix >= 0 && iz >= 0 && ix < COLS && iz < COLS;
  }

  worldToCell(x: number, z: number) {
    const ix = (x + SIZE / 2) / CELL;
    const iz = (z + SIZE / 2) / CELL;
    return { ix, iz };
  }

  cellToWorld(ix: number, iz: number) {
    return {
      x: ix * CELL - SIZE / 2,
      z: iz * CELL - SIZE / 2,
    };
  }

  sample(field: Float32Array, x: number, z: number) {
    const { ix, iz } = this.worldToCell(x, z);
    const x0 = clamp(Math.floor(ix), 0, COLS - 1);
    const z0 = clamp(Math.floor(iz), 0, COLS - 1);
    const x1 = clamp(x0 + 1, 0, COLS - 1);
    const z1 = clamp(z0 + 1, 0, COLS - 1);
    const tx = clamp(ix - x0, 0, 1);
    const tz = clamp(iz - z0, 0, 1);
    const a = field[this.idx(x0, z0)];
    const b = field[this.idx(x1, z0)];
    const c = field[this.idx(x0, z1)];
    const d = field[this.idx(x1, z1)];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  heightAt(x: number, z: number) {
    const half = SIZE / 2;
    if (Math.abs(x) > half + 0.02 || Math.abs(z) > half + 0.02) return FLOOR;
    return this.sample(this.heights, x, z);
  }

  moistureAt(x: number, z: number) {
    return this.sample(this.moisture, x, z);
  }

  packedAt(x: number, z: number) {
    return this.sample(this.packed, x, z);
  }

  gradient(x: number, z: number) {
    const e = CELL;
    const dhdx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dhdz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return { x: -dhdx, z: -dhdz };
  }

  avgMoisture(ix: number, iz: number, radius: number) {
    let sum = 0;
    let n = 0;
    const r = Math.ceil(radius);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = ix + dx;
        const z = iz + dz;
        if (!this.inBounds(x, z)) continue;
        if (dx * dx + dz * dz > radius * radius) continue;
        sum += this.moisture[this.idx(x, z)];
        n++;
      }
    }
    return n ? sum / n : 0;
  }

  seed(seed = 1337, place: "pit" | "beach" = "pit") {
    this.seedValue = seed;
    const rand = mulberry32(seed);
    const beach = place === "beach";
    for (let iz = 0; iz < COLS; iz++) {
      for (let ix = 0; ix < COLS; ix++) {
        const i = this.idx(ix, iz);
        const { x, z } = this.cellToWorld(ix, iz);
        const nx = ix / (COLS - 1);
        const nz = iz / (COLS - 1);
        const wx = (nx - 0.5) * 4.2;
        const wz = (nz - 0.5) * 4.2;
        let h = beach ? 0.62 : 0.72;
        h += (fbm(wx * 1.1 + 2.2, wz * 1.1 + 0.4) - 0.5) * (beach ? 0.22 : 0.26);
        h += Math.sin(ix * 0.31) * Math.cos(iz * 0.27) * 0.05;
        h += (rand() - 0.5) * 0.01;
        if (!beach) {
          const outside = Math.max(Math.abs(x), Math.abs(z)) / (PIT / 2);
          if (outside > 0.98) h = -0.42;
          else if (outside > 0.9) h += (outside - 0.9) * 1.4;
        } else {
          const shore = (z + SIZE / 2) / SIZE;
          h -= (1 - shore) * 0.38;
        }
        this.heights[i] = clamp(h, FLOOR, beach ? 1.15 : 1.2);
        if (beach) {
          const wet = clamp((-z - 1.4) / 3.2, 0, 1);
          this.moisture[i] = clamp(0.08 + wet * 0.78 + (fbm(wx + 9, wz + 3) - 0.5) * 0.05, 0, 1);
        } else if (Math.max(Math.abs(x), Math.abs(z)) > PIT / 2) {
          this.moisture[i] = 0.2;
        } else {
          this.moisture[i] = 0.28 + 0.12 * (1 - nx) + (fbm(wx + 9, wz + 3) - 0.5) * 0.06;
        }
        this.packed[i] = 0;
      }
    }

    if (!beach) {
      this.soakDisk(-0.35, -1.35, 1.5, 0.48);
      this.stampCastle(-0.35, -1.35, true);
      this.dig(-0.15, 1.55, 0.5, 0.5, false);
      this.water(-0.15, 1.55, 0.65, 0.2);
    }

    const count = TREASURES.length;
    this.buried = TREASURES.map((t, k) => {
      const ang = (k / count) * Math.PI * 2 + 0.35;
      const span = beach ? 3.6 : 1.6;
      let x = Math.cos(ang) * (0.6 + (k % 4) * 0.45) * (beach ? 1.15 : 0.7);
      let z = Math.sin(ang) * span * 0.45 + (beach ? 0.8 : 0);
      if (!beach && k === 0) {
        x = -0.15;
        z = 1.55;
      }
      if (beach) {
        x = clamp((rand() - 0.5) * 7.2, -4.2, 4.2);
        z = 0.4 + rand() * 3.4;
      }
      const surface = this.heightAt(x, z);
      const depth = beach
        ? clamp(surface - (0.35 + rand() * 0.9), FLOOR + 0.08, surface - 0.12)
        : k === 0
          ? Math.max(FLOOR + 0.08, surface - 0.22)
          : FLOOR + 0.15 + rand() * 0.35;
      return { id: `t-${k}`, kind: t.kind, name: t.name, x, z, depth };
    });

    this.history = [];
    this.dirty = true;
    this.crumbles.length = 0;
  }

  pushHistory() {
    if (this.history.length > 14) this.history.shift();
    this.history.push({
      h: this.heights.slice(),
      m: this.moisture.slice(),
      p: this.packed.slice(),
    });
  }

  undo() {
    const snap = this.history.pop();
    if (!snap) return false;
    this.heights.set(snap.h);
    this.moisture.set(snap.m);
    this.packed.set(snap.p);
    this.dirty = true;
    return true;
  }

  soakDisk(x: number, z: number, radius: number, moisture: number) {
    this.brush(x, z, radius, (i, w) => {
      this.moisture[i] = clamp(this.moisture[i] + (moisture - this.moisture[i]) * w, 0, 1);
    });
  }

  stampCastle(x: number, z: number, force = false): { quality: "dry" | "good" | "wet"; moisture: number; stacked: boolean } {
    const base = this.heightAt(x, z);
    const { ix: fx, iz: fz } = this.worldToCell(x, z);
    const m = this.avgMoisture(Math.round(fx), Math.round(fz), 6);
    let lift = 1;
    let packAmt = 0.97;
    let quality: "dry" | "good" | "wet" = "good";
    if (!force && m < 0.14) {
      lift = 0.42;
      packAmt = 0.2;
      quality = "dry";
    }
    const stacked = base > 1.05;
    const R = 0.46;
    const body = 0.4 * lift;
    this.brush(x, z, R + 0.06, (i, _w, ix, iz) => {
      const { x: wx, z: wz } = this.cellToWorld(ix, iz);
      const dx = wx - x;
      const dz = wz - z;
      const dist = Math.hypot(dx, dz);
      if (dist > R) return;
      const ang = Math.atan2(dz, dx);
      const side = smoothstep(R - 0.1, R, dist);
      let h = body * (1 - side);
      if (dist > 0.18 && dist < 0.36 && Math.cos(ang * 8) > 0.15) h += 0.12 * lift;
      const target = base + h;
      this.heights[i] = clamp(Math.max(this.heights[i], target), FLOOR, MAX_H);
      this.packed[i] = Math.max(this.packed[i], packAmt);
      if (quality === "good") this.moisture[i] = clamp(Math.max(this.moisture[i], 0.45), 0, 0.8);
    });
    this.dirty = true;
    return { quality, moisture: m, stacked };
  }

  brush(
    x: number,
    z: number,
    radius: number,
    fn: (i: number, weight: number, ix: number, iz: number) => void,
  ) {
    const { ix: fx, iz: fz } = this.worldToCell(x, z);
    const rCells = radius / CELL;
    const r = Math.ceil(rCells + 1);
    const cx = Math.round(fx);
    const cz = Math.round(fz);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (!this.inBounds(ix, iz)) continue;
        const dist = Math.hypot(ix - fx, iz - fz);
        if (dist > rCells) continue;
        const w = (1 - dist / rCells) ** 1.35;
        fn(this.idx(ix, iz), w, ix, iz);
      }
    }
    this.dirty = true;
  }

  scoop(x: number, z: number, radius: number, amount: number) {
    let taken = 0;
    this.brush(x, z, radius, (i, w) => {
      const room = this.heights[i] - FLOOR;
      const take = Math.min(room, amount * w);
      this.heights[i] -= take;
      this.packed[i] *= 1 - w * 0.7;
      taken += take * CELL * CELL;
    });
    return taken;
  }

  deposit(x: number, z: number, radius: number, volume: number, moisture: number) {
    if (volume <= 0) return;
    const area = Math.PI * radius * radius;
    const addH = volume / Math.max(area, 0.08);
    this.brush(x, z, radius, (i, w) => {
      this.heights[i] = clamp(this.heights[i] + addH * w * 1.8, FLOOR, MAX_H);
      this.moisture[i] = clamp(lerp(this.moisture[i], moisture, w * 0.55), 0, 1);
      this.packed[i] *= 1 - w * 0.5;
    });
  }

  /** Excavate a pit and pile spoil in a ring — real digging. */
  dig(x: number, z: number, radius: number, amount: number, pile = true) {
    let taken = 0;
    const spoil: { ix: number; iz: number; v: number }[] = [];
    this.brush(x, z, radius, (i, w, ix, iz) => {
      const layer = layerAt(this.heights[i]);
      const resist =
        layer.id === "bed" ? 0.42 : layer.id === "deep" ? 0.62 : layer.id === "damp" ? 0.85 : 1;
      const room = this.heights[i] - FLOOR;
      const take = Math.min(room, amount * w * resist);
      this.heights[i] -= take;
      this.packed[i] *= 1 - w * 0.85;
      taken += take;
      if (pile && take > 0) spoil.push({ ix, iz, v: take * 0.86 });
    });
    if (pile) {
      for (const s of spoil) {
        const ang = Math.atan2(s.iz - z / CELL - (COLS - 1) / 2, s.ix - x / CELL - (COLS - 1) / 2);
        const ring = radius / CELL + 1.8;
        const { ix: fx } = this.worldToCell(x, z);
        const { iz: fz } = this.worldToCell(x, z);
        const tx = Math.round(fx + Math.cos(ang) * ring);
        const tz = Math.round(fz + Math.sin(ang) * ring);
        if (this.inBounds(tx, tz)) {
          const j = this.idx(tx, tz);
          this.heights[j] = clamp(this.heights[j] + s.v * 0.55, FLOOR, MAX_H);
        }
      }
    }
    this.dirty = true;
    return taken * CELL * CELL;
  }

  water(x: number, z: number, radius: number, amount: number) {
    this.brush(x, z, radius, (i, w) => {
      this.moisture[i] = clamp(this.moisture[i] + amount * w, 0, 1);
      // oversaturated packed walls lose structure
      if (this.moisture[i] > 0.78) this.packed[i] *= 1 - w * 0.35;
    });
  }

  pack(x: number, z: number, radius: number, amount: number) {
    this.brush(x, z, radius, (i, w) => {
      this.packed[i] = clamp(this.packed[i] + amount * w, 0, 1);
      this.heights[i] = clamp(this.heights[i] - amount * w * 0.04, FLOOR, MAX_H);
    });
  }

  smash(x: number, z: number, radius: number) {
    let crushed = 0;
    this.brush(x, z, radius, (i, w, ix, iz) => {
      const p = this.packed[i];
      if (p > 0.2) {
        crushed += p * w;
        const { x: wx, z: wz } = this.cellToWorld(ix, iz);
        if (w > 0.45 && p > 0.5) {
          this.crumbles.push({ x: wx, y: this.heights[i], z: wz, mag: p });
        }
      }
      this.packed[i] *= 1 - w * 0.95;
      this.heights[i] = clamp(this.heights[i] - w * 0.08, FLOOR, MAX_H);
    });
    this.dirty = true;
    return crushed;
  }

  step(dt: number, soak: number, place: "pit" | "beach" = "pit") {
    const n = COLS * COLS;
    this.time += dt;
    this.dH.fill(0);
    this.dM.fill(0);
    this.dP.fill(0);
    const { heights: h, moisture: m, packed: p } = this;
    const halfPit = PIT / 2 - CELL;

    const pinned = (ix: number, iz: number) => {
      if (place !== "pit") return false;
      const { x, z } = this.cellToWorld(ix, iz);
      return Math.abs(x) > halfPit || Math.abs(z) > halfPit;
    };

    for (let iz = 0; iz < COLS; iz++) {
      for (let ix = 0; ix < COLS; ix++) {
        if (pinned(ix, iz)) continue;
        const i = this.idx(ix, iz);
        if (p[i] > 0.82) continue;
        const repose = reposeAngle(m[i], p[i]);
        const maxSlope = Math.tan(repose);
        const flow =
          0.28 *
          dt *
          60 *
          (1 - p[i] * 0.88) *
          (m[i] > 0.8 ? 1.45 : m[i] < 0.15 ? 1.12 : 0.85);

        for (const [dx, dz, diag] of DIRS) {
          const nx = ix + dx;
          const nz = iz + dz;
          if (!this.inBounds(nx, nz) || pinned(nx, nz)) continue;
          const j = this.idx(nx, nz);
          const dist = CELL * diag;
          const dh = h[i] - h[j];
          if (dh <= 0.0005) continue;
          const slope = dh / dist;
          // packed walls hold until severely undercut
          if (p[i] > 0.55 && slope < maxSlope * 1.85) continue;
          if (slope <= maxSlope) continue;
          let excess = (dh - maxSlope * dist) * 0.5;
          excess = Math.min(excess, h[i] - FLOOR, flow * CELL * (diag > 1.1 ? 0.62 : 1));
          if (excess <= 0) continue;
          this.dH[i] -= excess;
          this.dH[j] += excess;
          const carryM = m[i] * 0.35;
          this.dM[i] -= carryM * (excess / Math.max(h[i], 0.05)) * 0.4;
          this.dM[j] += carryM * (excess / Math.max(h[i], 0.05)) * 0.4;
        }

        // undercutting: tall packed columns lose structure
        let minN = h[i];
        if (ix > 0) minN = Math.min(minN, h[this.idx(ix - 1, iz)]);
        if (ix < COLS - 1) minN = Math.min(minN, h[this.idx(ix + 1, iz)]);
        if (iz > 0) minN = Math.min(minN, h[this.idx(ix, iz - 1)]);
        if (iz < COLS - 1) minN = Math.min(minN, h[this.idx(ix, iz + 1)]);
        if (p[i] > 0.4 && h[i] - minN > CELL * 2.4) {
          this.dP[i] -= p[i] * 0.08 * dt * 60;
          if (p[i] > 0.7 && hash(ix, iz + (this.seedValue % 17)) > 0.96) {
            const { x, z } = this.cellToWorld(ix, iz);
            this.crumbles.push({ x, y: h[i], z, mag: p[i] });
          }
        }

        const target = place === "beach" ? soak * 0.35 : soak * 0.72;
        this.dM[i] += (target - m[i]) * 0.012 * dt * 60;
        this.dM[i] -= m[i] * 0.003 * dt * 60;

        if (place === "beach") {
          const { z } = this.cellToWorld(ix, iz);
          const shore = -2.05 + Math.sin(this.time * 0.7 + ix * 0.08) * 0.42;
          if (z < shore) this.dM[i] += (0.94 - m[i]) * 0.09;
          else if (z < shore + 1.4) this.dM[i] += (0.45 - m[i]) * 0.02;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      if (p[i] < 0.85) h[i] = clamp(h[i] + this.dH[i], FLOOR, MAX_H);
      m[i] = clamp(m[i] + this.dM[i], 0, 1);
      if (p[i] < 0.85) p[i] = clamp(p[i] + this.dP[i], 0, 1);
    }

    // moisture diffusion (small)
    this.dM.fill(0);
    for (let iz = 1; iz < COLS - 1; iz++) {
      for (let ix = 1; ix < COLS - 1; ix++) {
        const i = this.idx(ix, iz);
        const lap =
          m[this.idx(ix - 1, iz)] +
          m[this.idx(ix + 1, iz)] +
          m[this.idx(ix, iz - 1)] +
          m[this.idx(ix, iz + 1)] -
          4 * m[i];
        this.dM[i] = lap * 0.02 * dt * 60;
      }
    }
    for (let i = 0; i < n; i++) m[i] = clamp(m[i] + this.dM[i], 0, 1);

    this.dirty = true;
  }

  colorAt(ix: number, iz: number, out: { r: number; g: number; b: number }) {
    const i = this.idx(ix, iz);
    const h = this.heights[i];
    const m = this.moisture[i];
    const p = this.packed[i];
    let r: number;
    let g: number;
    let b: number;
    if (h < -0.55) {
      r = 0.22;
      g = 0.12;
      b = 0.07;
    } else if (h < -0.05) {
      r = 0.36;
      g = 0.2;
      b = 0.1;
    } else if (h < 0.28) {
      r = 0.55;
      g = 0.34;
      b = 0.16;
    } else if (h < 0.55) {
      r = 0.72;
      g = 0.5;
      b = 0.26;
    } else if (h < 0.78) {
      r = 0.88;
      g = 0.72;
      b = 0.46;
    } else {
      r = 0.95;
      g = 0.86;
      b = 0.64;
    }
    const n = (hash(ix, iz) - 0.5) * 0.02;
    r += n;
    g += n * 0.85;
    b += n * 0.55;
    const wet = 1 - 0.42 * m;
    r *= wet;
    g *= wet * (0.95 + 0.05 * (1 - m));
    b *= wet * 0.9;
    r = r * (1 - 0.16 * p) + 0.36 * p * 0.12;
    g *= 1 - 0.2 * p;
    b *= 1 - 0.12 * p;
    out.r = clamp(r, 0, 1);
    out.g = clamp(g, 0, 1);
    out.b = clamp(b, 0, 1);
  }
}
