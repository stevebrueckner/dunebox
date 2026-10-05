import { useMemo } from "react";
import * as THREE from "three";

const GREEN = "#79d64a";
const TEAL = "#1f8f86";
const SAND = "#c4a36a";
const SKIN = "#c98464";

function lathe(pts: [number, number][], segments = 48) {
  const geo = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
  geo.computeVertexNormals();
  return geo;
}

function usePlastic(color: string, roughness = 0.34, map?: THREE.Texture | null) {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        map: map ?? null,
        roughness,
        metalness: 0,
        clearcoat: 0.38,
        clearcoatRoughness: 0.48,
        envMapIntensity: 0.72,
        sheen: 0.18,
        sheenColor: new THREE.Color("#f4fff0"),
        sheenRoughness: 0.7,
      }),
    [color, roughness, map],
  );
}

function skinMat() {
  return new THREE.MeshStandardMaterial({
    color: "#e4b396",
    roughness: 0.72,
    metalness: 0,
  });
}

export function Pail() {
  const body = useMemo(
    () =>
      lathe([
        [0.02, 0.02],
        [0.16, 0.02],
        [0.175, 0.04],
        [0.168, 0.06],
        [0.172, 0.11],
        [0.188, 0.125],
        [0.172, 0.14],
        [0.18, 0.2],
        [0.198, 0.218],
        [0.182, 0.232],
        [0.2, 0.3],
        [0.228, 0.34],
        [0.246, 0.362],
        [0.22, 0.378],
        [0.205, 0.348],
      ]),
    [],
  );
  const plastic = usePlastic(TEAL, 0.3);
  return (
    <group>
      <mesh geometry={body} material={plastic} castShadow receiveShadow />
      <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]} material={plastic} receiveShadow>
        <circleGeometry args={[0.162, 32]} />
      </mesh>
      <mesh position={[0, 0.358, 0]} rotation={[Math.PI / 2, 0, 0]} material={plastic} castShadow>
        <torusGeometry args={[0.232, 0.016, 12, 40]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.2, 0.355, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.028, 10]} />
          <meshStandardMaterial color="#d5dbe0" metalness={0.8} roughness={0.28} />
        </mesh>
      ))}
      <group name="pail-handle" position={[0, 0.355, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.2, 0.01, 10, 32, Math.PI]} />
          <meshStandardMaterial color="#e7edf0" metalness={0.86} roughness={0.22} />
        </mesh>
      </group>
      <mesh name="sand-fill" position={[0, 0.12, 0]} visible={false}>
        <cylinderGeometry args={[0.175, 0.15, 0.16, 24]} />
        <meshStandardMaterial color={SAND} roughness={0.96} />
      </mesh>
    </group>
  );
}

export function Spade() {
  const plastic = usePlastic("#f0b429", 0.42);
  const scoop = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.01);
    shape.bezierCurveTo(0.09, 0.0, 0.11, 0.04, 0.1, 0.09);
    shape.bezierCurveTo(0.09, 0.13, 0.05, 0.155, 0, 0.16);
    shape.bezierCurveTo(-0.05, 0.155, -0.09, 0.13, -0.1, 0.09);
    shape.bezierCurveTo(-0.11, 0.04, -0.09, 0.0, 0, 0.01);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 12,
    });
    geo.translate(0, 0, -0.02);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, pos.getZ(i) + Math.sin((y / 0.16) * Math.PI) * 0.012);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow material={plastic}>
        <cylinderGeometry args={[0.016, 0.018, 0.34, 16]} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={plastic}>
        <capsuleGeometry args={[0.018, 0.09, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.1, 0.01]} geometry={scoop} castShadow material={plastic} />
      <mesh name="blade-sand" position={[0, 0.09, 0.02]} visible={false}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
    </group>
  );
}

export function CastleMold() {
  const plastic = usePlastic(GREEN, 0.4);
  const shell = useMemo(
    () =>
      lathe(
        [
          [0.02, 0.015],
          [0.32, 0.015],
          [0.34, 0.03],
          [0.31, 0.05],
          [0.29, 0.12],
          [0.26, 0.26],
          [0.23, 0.38],
          [0.21, 0.44],
          [0.16, 0.46],
        ],
        48,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={shell} material={plastic} castShadow receiveShadow />
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} material={plastic}>
        <torusGeometry args={[0.325, 0.016, 8, 40]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]} material={plastic}>
        <torusGeometry args={[0.2, 0.012, 8, 36]} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2]}
            rotation={[0, -a, 0]}
            material={plastic}
            castShadow
          >
            <boxGeometry args={[0.05, 0.08, 0.03]} />
          </mesh>
        );
      })}
    </group>
  );
}

export function KickingLeg() {
  const skin = useMemo(() => skinMat(), []);
  const toes = [
    { x: -0.038, len: 0.055, r: 0.018 },
    { x: -0.012, len: 0.05, r: 0.014 },
    { x: 0.012, len: 0.046, r: 0.013 },
    { x: 0.034, len: 0.038, r: 0.012 },
    { x: 0.052, len: 0.028, r: 0.01 },
  ];
  return (
    <group name="knee">
      <mesh position={[0, 0.02, 0]} material={skin} castShadow>
        <capsuleGeometry args={[0.052, 0.38, 16, 24]} />
      </mesh>
      <group name="ankle" position={[0, -0.22, 0.02]}>
        <mesh position={[0, -0.02, -0.045]} scale={[1, 0.72, 1.1]} material={skin} castShadow>
          <sphereGeometry args={[0.058, 28, 20]} />
        </mesh>
        <mesh position={[0, -0.038, 0.04]} scale={[0.9, 0.4, 1.35]} material={skin} castShadow>
          <sphereGeometry args={[0.058, 28, 20]} />
        </mesh>
        <mesh position={[0, -0.046, 0.12]} scale={[1.15, 0.36, 0.75]} material={skin} castShadow>
          <sphereGeometry args={[0.056, 28, 18]} />
        </mesh>
        <group name="toes" position={[0, -0.05, 0.17]}>
          {toes.map((t) => (
            <mesh key={t.x} position={[t.x, 0, t.len * 0.35]} rotation={[Math.PI / 2, 0, 0]} material={skin} castShadow>
              <capsuleGeometry args={[t.r, t.len, 8, 12]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function Finger({
  name,
  lengths,
  radius,
}: {
  name: string;
  lengths: [number, number, number];
  radius: number;
}) {
  const [a, b, c] = lengths;
  return (
    <group name={name}>
      <group name="knuckle">
        <mesh position={[0, 0, a * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[radius, Math.max(0.004, a * 0.65), 4, 8]} />
          <meshPhysicalMaterial color={SKIN} roughness={0.62} sheen={0.15} sheenColor="#e7b49a" />
        </mesh>
        <group name="mid" position={[0, 0, a]}>
          <mesh position={[0, 0, b * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[radius * 0.92, Math.max(0.004, b * 0.6), 4, 8]} />
            <meshPhysicalMaterial color={SKIN} roughness={0.6} />
          </mesh>
          <group name="tip" position={[0, 0, b]}>
            <mesh position={[0, 0, c * 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <capsuleGeometry args={[radius * 0.82, Math.max(0.004, c * 0.5), 4, 8]} />
              <meshPhysicalMaterial color="#c98464" roughness={0.55} />
            </mesh>
            <mesh name="digit-tip" position={[0, radius * 0.3, c * 0.7]}>
              <boxGeometry args={[radius * 1.15, 0.004, radius * 0.9]} />
              <meshStandardMaterial color="#f4ddd0" roughness={0.32} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export function GrabHand() {
  const skin = useMemo(() => skinMat(), []);
  const fingers: { name: string; x: number; len: [number, number, number]; r: number }[] = [
    { name: "finger-0", x: -0.034, len: [0.038, 0.026, 0.02], r: 0.011 },
    { name: "finger-1", x: -0.012, len: [0.042, 0.03, 0.022], r: 0.011 },
    { name: "finger-2", x: 0.01, len: [0.04, 0.028, 0.02], r: 0.0105 },
    { name: "finger-3", x: 0.03, len: [0.032, 0.022, 0.018], r: 0.0095 },
  ];
  return (
    <group>
      <mesh position={[0, 0.01, -0.03]} rotation={[0.4, 0, 0]} material={skin} castShadow>
        <capsuleGeometry args={[0.018, 0.05, 6, 10]} />
      </mesh>
      <mesh position={[0, -0.006, 0.035]} scale={[1.2, 0.42, 1.45]} material={skin} castShadow>
        <sphereGeometry args={[0.042, 28, 18]} />
      </mesh>
      <group name="thumb" position={[-0.05, -0.01, 0.02]} rotation={[0.15, 1.35, -0.8]}>
        <Finger name="thumb-digit" lengths={[0.034, 0.024, 0.018]} radius={0.012} />
      </group>
      {fingers.map((f) => (
        <group key={f.name} position={[f.x, -0.004, 0.075]}>
          <Finger name={f.name} lengths={f.len} radius={f.r} />
        </group>
      ))}
    </group>
  );
}

export function WateringCan() {
  const plastic = usePlastic("#3c86c4", 0.32);
  const spout = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.06, 0.14, 0),
      new THREE.Vector3(0.16, 0.16, 0),
      new THREE.Vector3(0.22, 0.08, 0),
    );
    return new THREE.TubeGeometry(curve, 16, 0.016, 10, false);
  }, []);
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={plastic} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.16, 24]} />
      </mesh>
      <mesh position={[0, 0.185, 0]} rotation={[Math.PI / 2, 0, 0]} material={plastic}>
        <torusGeometry args={[0.078, 0.012, 10, 24]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={plastic}>
        <cylinderGeometry args={[0.055, 0.07, 0.02, 20]} />
      </mesh>
      <mesh position={[-0.02, 0.16, 0]} rotation={[0, 0, 0.4]} material={plastic} castShadow>
        <torusGeometry args={[0.07, 0.01, 8, 18, Math.PI]} />
      </mesh>
      <mesh geometry={spout} material={plastic} castShadow />
      <mesh name="rose" position={[0.24, 0.075, 0]} rotation={[0, 0, Math.PI / 2]} material={plastic} castShadow>
        <cylinderGeometry args={[0.038, 0.028, 0.016, 16]} />
      </mesh>
      <group name="stream">
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} name={`drop-${i}`}>
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshPhysicalMaterial color="#d5f4f8" transparent opacity={0.72} roughness={0.05} metalness={0} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function BeachBall() {
  const map = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d")!;
    const colors = ["#f7f3ea", "#e07a32", "#f0c84a", "#2a8f86", "#f2f6f8", "#d4543a"];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = colors[i];
      g.beginPath();
      g.moveTo(256, 128);
      g.arc(256, 128, 280, (i / 6) * Math.PI * 2 - 0.02, ((i + 1) / 6) * Math.PI * 2 + 0.02);
      g.fill();
      g.strokeStyle = "rgba(20,16,12,0.55)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(256, 128);
      g.lineTo(256 + Math.cos((i / 6) * Math.PI * 2) * 280, 128 + Math.sin((i / 6) * Math.PI * 2) * 140);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  return (
    <mesh castShadow>
      <sphereGeometry args={[0.16, 40, 28]} />
      <meshPhysicalMaterial map={map} roughness={0.38} clearcoat={0.35} clearcoatRoughness={0.4} />
    </mesh>
  );
}

function useCanopy() {
  return useMemo(() => {
    const geo = new THREE.ConeGeometry(0.55, 0.22, 64, 8, true);
    geo.translate(0, 0.11, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(z, x);
      const scallop = 1 + Math.cos(ang * 8) * 0.045 * Math.max(0, 0.12 - y);
      pos.setX(i, x * scallop);
      pos.setZ(i, z * scallop);
      const sag = (0.5 - 0.5 * Math.cos(ang * 8)) * Math.max(0, 0.16 - y) * 0.08;
      pos.setY(i, y - sag);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
}

export function Umbrella() {
  const canopy = useCanopy();
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.016, 0.5, 12]} />
        <meshStandardMaterial color="#6b4428" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.02, 12, 10]} />
        <meshStandardMaterial color="#e7c15a" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh geometry={canopy} position={[0, 0.28, 0]} castShadow>
        <meshStandardMaterial color="#d4653c" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.22, 0.36, Math.cos(a) * 0.22]} rotation={[0.55, a, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.42, 6]} />
            <meshStandardMaterial color="#f4efe6" roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Shell() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.12, 40, 20, 0, Math.PI * 2, 0.2, 1.15);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cream = new THREE.Color("#f3d7c0");
    const ridge = new THREE.Color("#e2b89a");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(x, z);
      const bands = Math.cos(ang * 16);
      const flare = 1 + bands * 0.07;
      pos.setX(i, x * flare);
      pos.setZ(i, z * flare * 0.82);
      pos.setY(i, y * 0.42 + 0.02);
      const col = bands > 0.2 ? ridge : cream;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} rotation={[-0.4, 0.3, 0.1]} castShadow>
      <meshStandardMaterial vertexColors roughness={0.42} metalness={0.04} />
    </mesh>
  );
}

export function Starfish() {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d2643a", roughness: 0.78 }),
    [],
  );
  const bump = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e37a48", roughness: 0.7 }), []);
  return (
    <group rotation={[-Math.PI / 2, 0, 0.15]}>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0]}
            rotation={[0, 0, a + Math.PI / 2]}
            scale={[0.55, 1, 0.28]}
            material={mat}
            castShadow
          >
            <capsuleGeometry args={[0.04, 0.09, 5, 8]} />
          </mesh>
        );
      })}
      <mesh scale={[1, 1, 0.35]} material={mat} castShadow>
        <sphereGeometry args={[0.05, 16, 12]} />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const rad = 0.03 + (i % 3) * 0.025;
        return (
          <mesh key={i} position={[Math.cos(a) * rad, Math.sin(a) * rad, 0.02]} material={bump}>
            <sphereGeometry args={[0.008, 8, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}
