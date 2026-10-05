export const COLS = 45;
export const SIZE = 6;
export const CELL = SIZE / (COLS - 1);
export const MAX_H = 1.52;
export const FLOOR = 0.02;

const DEG = Math.PI / 180;

export const LAYERS = [
  { id: "bed", name: "Bed earth", min: 0, hint: "Packed dark sand. Finds hide here." },
  { id: "deep", name: "Deep pack", min: 0.16, hint: "Damp, stubborn. Dig slowly." },
  { id: "damp", name: "Damp gold", min: 0.34, hint: "Best for keeping walls upright." },
  { id: "loose", name: "Loose dune", min: 0.55, hint: "Dry grains. They slump." },
  { id: "surface", name: "Surface", min: 0.78, hint: "Sun-bleached top." },
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

  seed(seed = 1337) {
    this.seedValue = seed;
    const rand = mulberry32(seed);
    const n = COLS * COLS;
    for (let iz = 0; iz < COLS; iz++) {
      for (let ix = 0; ix < COLS; ix++) {
        const i = this.idx(ix, iz);
        const nx = ix / (COLS - 1);
        const nz = iz / (COLS - 1);
        const wx = (nx - 0.5) * 4.2;
        const wz = (nz - 0.5) * 4.2;
        let h = 0.7;
        h += (fbm(wx * 1.1 + 2.2, wz * 1.1 + 0.4) - 0.5) * 0.28;
        h += Math.sin(ix * 0.37) * Math.cos(iz * 0.29) * 0.06;
        h += (rand() - 0.5) * 0.012;
        // slight bowl so the lip of the box holds a little extra
        const edge = Math.max(nx, 1 - nx, nz, 1 - nz);
        if (edge > 0.92) h += (edge - 0.92) * 0.8;
        this.heights[i] = clamp(h, 0.45, 1.05);
        this.moisture[i] = 0.22 + 0.16 * (1 - nx) + (fbm(wx + 9, wz + 3) - 0.5) * 0.08;
        this.packed[i] = 0;
      }
    }

    // Pre-built keep toward the back, slightly damp
    this.soakDisk(-0.35, -1.55, 1.6, 0.52);
    this.stampCastle(-0.35, -1.55, true);

    // Tutorial hole up front with a shallow find
    this.dig(-0.2, 1.7, 0.55, 0.55, false);
    this.water(-0.2, 1.7, 0.7, 0.25);

    this.buried = TREASURES.map((t, k) => {
      const ang = (k / TREASURES.length) * Math.PI * 2 + 0.4;
      const rad = 0.7 + (k % 3) * 0.55 + rand() * 0.35;
      let x = Math.cos(ang) * rad;
      let z = Math.sin(ang) * rad * 0.85 - 0.15;
      if (k === 0) {
        x = -0.2;
        z = 1.7;
      }
      const surface = this.heightAt(x, z);
      const depth =
        k === 0
          ? Math.max(FLOOR + 0.08, surface - 0.18)
          : FLOOR + 0.08 + rand() * 0.22;
      return { id: `t-${k}`, kind: t.kind, name: t.name, x, z, depth };
    });

    this.dirty = true;
    this.crumbles.length = 0;
  }

  soakDisk(x: number, z: number, radius: number, moisture: number) {
    this.brush(x, z, radius, (i, w) => {
      this.moisture[i] = clamp(this.moisture[i] + (moisture - this.moisture[i]) * w, 0, 1);
    });
  }

  private raisePack(ix: number, iz: number, h: number, packed: number) {
    if (!this.inBounds(ix, iz)) return;
    const i = this.idx(ix, iz);
    this.heights[i] = clamp(Math.max(this.heights[i], h), FLOOR, MAX_H);
    this.packed[i] = Math.max(this.packed[i], packed);
    this.moisture[i] = clamp(this.moisture[i], 0.28, 0.72);
  }

  stampCastle(x: number, z: number, force = false): { quality: "dry" | "good" | "wet"; moisture: number } {
    const { ix: fx, iz: fz } = this.worldToCell(x, z);
    const cx = Math.round(fx);
    const cz = Math.round(fz);
    const m = this.avgMoisture(cx, cz, 6);
    let packedAmt = 0.2;
    let hBoost = 0.18;
    let quality: "dry" | "good" | "wet" = "good";
    if (m < 0.2 && !force) {
      packedAmt = 0.18;
      hBoost = 0.2;
      quality = "dry";
    } else if (m > 0.76 && !force) {
      packedAmt = 0.22;
      hBoost = 0.12;
      quality = "wet";
    } else {
      packedAmt = force ? 0.92 : 0.95;
      hBoost = 0.42;
      quality = "good";
    }

    const wallH = 0.78 + hBoost * 0.55;
    const towerH = 0.92 + hBoost;
    const keepH = 0.86 + hBoost * 0.8;

    for (let d = -4; d <= 4; d++) {
      for (const s of [-4, 4]) {
        this.raisePack(cx + d, cz + s, wallH, packedAmt);
        this.raisePack(cx + s, cz + d, wallH, packedAmt);
      }
    }
    // gate on +Z
    for (let d = -1; d <= 1; d++) {
      const i = this.idx(cx + d, cz + 4);
      if (this.inBounds(cx + d, cz + 4)) {
        this.heights[i] = Math.min(this.heights[i], 0.62);
        this.packed[i] *= 0.2;
      }
    }
    const towers: [number, number][] = [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ];
    for (const [tx, tz] of towers) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const extra = dx === 0 && dz === 0 ? 0.08 : 0;
          this.raisePack(cx + tx + dx, cz + tz + dz, towerH + extra, packedAmt);
        }
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        this.raisePack(cx + dx, cz + dz, keepH, packedAmt);
      }
    }
    this.dirty = true;
    return { quality, moisture: m };
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
        layer.id === "bed" ? 0.28 : layer.id === "deep" ? 0.48 : layer.id === "damp" ? 0.78 : 1;
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

  step(dt: number, soak: number) {
    const n = COLS * COLS;
    this.dH.fill(0);
    this.dM.fill(0);
    this.dP.fill(0);
    const { heights: h, moisture: m, packed: p } = this;

    for (let iz = 0; iz < COLS; iz++) {
      for (let ix = 0; ix < COLS; ix++) {
        const i = this.idx(ix, iz);
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
          if (!this.inBounds(nx, nz)) continue;
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

        // soak toward the pit-wide water content + slight evaporation
        const target = soak * 0.72;
        this.dM[i] += (target - m[i]) * 0.018 * dt * 60;
        this.dM[i] -= m[i] * 0.004 * dt * 60;
      }
    }

    for (let i = 0; i < n; i++) {
      h[i] = clamp(h[i] + this.dH[i], FLOOR, MAX_H);
      m[i] = clamp(m[i] + this.dM[i], 0, 1);
      p[i] = clamp(p[i] + this.dP[i], 0, 1);
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
    if (h < 0.16) {
      r = 0.3;
      g = 0.18;
      b = 0.1;
    } else if (h < 0.34) {
      r = 0.48;
      g = 0.3;
      b = 0.14;
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
    const n = (hash(ix, iz) - 0.5) * 0.07;
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
