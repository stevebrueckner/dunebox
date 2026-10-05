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
    256,
    (g, s) => {
      const img = g.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const i = (y * s + x) * 4;
          const n = 198 + ((x * 13 + y * 7) % 37) + Math.random() * 18;
          img.data[i] = n;
          img.data[i + 1] = n * 0.84;
          img.data[i + 2] = n * 0.58;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
    7,
  );
}

export function makeSandBump() {
  const tex = canvasTexture(
    256,
    (g, s) => {
      const img = g.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const i = (y * s + x) * 4;
          const v = 110 + Math.random() * 90;
          img.data[i] = v;
          img.data[i + 1] = v;
          img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
    9,
  );
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makeWoodAlbedo() {
  return canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = "#6b4428";
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        const wobble = Math.sin(x * 0.07) * 8;
        g.strokeStyle = `rgba(40, 22, 10, ${0.12 + (x % 17) * 0.01})`;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + wobble, s);
        g.stroke();
      }
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(90, 50, 24, ${0.15 + Math.random() * 0.2})`;
        g.beginPath();
        g.ellipse(Math.random() * s, Math.random() * s, 6 + Math.random() * 10, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
    2,
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
