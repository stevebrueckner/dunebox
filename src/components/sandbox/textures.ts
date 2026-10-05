import * as THREE from "three";

function canvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat = 4,
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  paint(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeSandAlbedo() {
  return canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = "#e7c892";
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 1800; i++) {
        const v = 210 + Math.random() * 35;
        g.fillStyle = `rgba(${v},${Math.round(v * 0.84)},${Math.round(v * 0.58)},0.08)`;
        g.fillRect(Math.random() * s, Math.random() * s, 1, 1);
      }
    },
    6,
  );
}

export function makeSandBump() {
  const tex = canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 800; i++) {
        const v = 120 + Math.random() * 16;
        g.fillStyle = `rgba(${v},${v},${v},0.25)`;
        g.fillRect(Math.random() * s, Math.random() * s, 1, 1);
      }
    },
    6,
  );
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makeWoodAlbedo() {
  return canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = "#8a5a34";
      g.fillRect(0, 0, s, s);
      const plank = s / 4;
      for (let p = 0; p < 4; p++) {
        const y0 = p * plank;
        g.fillStyle = p % 2 ? "#7a4e2c" : "#9a6840";
        g.fillRect(0, y0, s, plank - 2);
        for (let i = 0; i < 14; i++) {
          const y = y0 + 6 + i * (plank / 16);
          g.strokeStyle = `rgba(62, 32, 14, ${0.08 + (i % 3) * 0.04})`;
          g.beginPath();
          g.moveTo(0, y);
          g.bezierCurveTo(s * 0.3, y + Math.sin(p + i) * 4, s * 0.7, y - 3, s, y + 2);
          g.stroke();
        }
        g.fillStyle = "rgba(40, 22, 10, 0.35)";
        g.fillRect(0, y0 + plank - 3, s, 2);
      }
    },
    1.5,
  );
}

export function makeGrassAlbedo() {
  return canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = "#3d5c38";
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        g.strokeStyle = Math.random() > 0.5 ? "#4e7344" : "#2f4a2c";
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 6);
        g.stroke();
      }
    },
    10,
  );
}
