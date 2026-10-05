import { Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { playSfx } from "./audio";
import { CameraRig } from "./camera";
import { gesture } from "./gesture";
import { meshPickedAt, Toys } from "./items";
import { CastleMold, GrabHand, KickingLeg, Pail, Spade, WateringCan } from "./props";
import { CELL, COLS, PIT, SIZE, SandSim, layerAt } from "./sim";
import { useGame } from "./store";
import { makeGrassAlbedo, makeSandAlbedo, makeSandBump, makeWoodAlbedo } from "./textures";

const HALF = SIZE / 2;
const PIT_HALF = PIT / 2;
const WALL = 0.18;
const WALL_H = 0.72;
const _color = { r: 0, g: 0, b: 0 };
const _hit = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export const sandSurface: { mesh: THREE.Mesh | null } = { mesh: null };

function buildSandGeometry() {
  const geo = new THREE.BufferGeometry();
  const verts = COLS * COLS;
  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  const indices: number[] = [];
  for (let iz = 0; iz < COLS; iz++) {
    for (let ix = 0; ix < COLS; ix++) {
      const i = iz * COLS + ix;
      positions[i * 3] = ix * CELL - HALF;
      positions[i * 3 + 1] = 0.7;
      positions[i * 3 + 2] = iz * CELL - HALF;
      uvs[i * 2] = ix / (COLS - 1);
      uvs[i * 2 + 1] = iz / (COLS - 1);
      if (ix < COLS - 1 && iz < COLS - 1) {
        const a = i;
        const b = i + 1;
        const c = i + COLS;
        const d = i + COLS + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function syncSand(geo: THREE.BufferGeometry, sim: SandSim) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  for (let iz = 0; iz < COLS; iz++) {
    for (let ix = 0; ix < COLS; ix++) {
      const i = iz * COLS + ix;
      pos.setY(i, sim.heights[i]);
      sim.colorAt(ix, iz, _color);
      col.setXYZ(i, _color.r, _color.g, _color.b);
    }
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals();
}

function SandMesh({ sim }: { sim: SandSim }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => buildSandGeometry(), []);
  const albedo = useMemo(() => makeSandAlbedo(), []);
  const bump = useMemo(() => makeSandBump(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: albedo,
        bumpMap: bump,
        bumpScale: 0.015,
        roughness: 0.94,
        metalness: 0,
        envMapIntensity: 0.16,
      }),
    [albedo, bump],
  );

  useEffect(() => {
    syncSand(geo, sim);
    sandSurface.mesh = meshRef.current;
    return () => {
      if (sandSurface.mesh === meshRef.current) sandSurface.mesh = null;
      geo.dispose();
      mat.dispose();
      albedo.dispose();
      bump.dispose();
    };
  }, [geo, mat, albedo, bump, sim]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    sim.step(d, useGame.getState().soak, useGame.getState().place);
    if (sim.dirty) {
      syncSand(geo, sim);
      sim.dirty = false;
    }
    if (sim.crumbles.length) sim.crumbles.length = 0;
  });

  return <mesh ref={meshRef} geometry={geo} material={mat} receiveShadow castShadow />;
}

type Burst = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number };
const bursts: Burst[] = [];

function spawnBurst(
  x: number,
  y: number,
  z: number,
  n: number,
  mag = 1,
  toward?: { x: number; y: number; z: number },
) {
  for (let i = 0; i < n; i++) {
    if (bursts.length > 140) bursts.shift();
    let vx = (Math.random() - 0.5) * 1.4 * mag;
    let vy = 0.8 + Math.random() * 1.4 * mag;
    let vz = (Math.random() - 0.5) * 1.4 * mag;
    if (toward) {
      const dx = toward.x - x;
      const dy = toward.y - y;
      const dz = toward.z - z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const sp = (1.5 + Math.random() * 1.3) * mag;
      vx = (dx / len) * sp + (Math.random() - 0.5) * 0.3;
      vy = (dy / len) * sp + 0.35 + Math.random() * 0.25;
      vz = (dz / len) * sp + (Math.random() - 0.5) * 0.3;
    }
    bursts.push({
      x,
      y,
      z,
      vx,
      vy,
      vz,
      life: 0.45 + Math.random() * 0.35,
      size: 0.025 + Math.random() * 0.03,
    });
  }
}

function Dust() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const g = 6.5;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.vy -= g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < 0) bursts.splice(i, 1);
    }
    for (let i = 0; i < 140; i++) {
      const b = bursts[i];
      if (!b) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -10, 0);
      } else {
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.setScalar(b.size * Math.max(0.1, b.life * 2));
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 140]} castShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#d2b48c" roughness={1} />
    </instancedMesh>
  );
}

function BoxFrame() {
  const wood = useMemo(() => makeWoodAlbedo(), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: wood, roughness: 0.72, metalness: 0.02, color: "#c4a07a" }),
    [wood],
  );
  const floorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8, color: "#8a6240" }),
    [wood],
  );

  useEffect(
    () => () => {
      wood.dispose();
      mat.dispose();
      floorMat.dispose();
    },
    [wood, mat, floorMat],
  );

  const inner = PIT_HALF + WALL / 2;
  const len = PIT + WALL * 2;
  const place = useGame((s) => s.place);
  if (place !== "pit") return null;

  return (
    <group>
      <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[PIT + 0.05, PIT + 0.05]} />
      </mesh>
      <mesh position={[0, WALL_H / 2 - 0.05, inner]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H, WALL]} />
      </mesh>
      <mesh position={[0, WALL_H / 2 - 0.05, -inner]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H, WALL]} />
      </mesh>
      <mesh position={[inner, WALL_H / 2 - 0.05, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[WALL, WALL_H, PIT]} />
      </mesh>
      <mesh position={[-inner, WALL_H / 2 - 0.05, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[WALL, WALL_H, PIT]} />
      </mesh>
      {[
        [inner, -inner],
        [inner, inner],
        [-inner, -inner],
        [-inner, inner],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, WALL_H / 2 + 0.08, z]} material={mat} castShadow>
          <boxGeometry args={[WALL * 1.35, WALL_H + 0.16, WALL * 1.35]} />
        </mesh>
      ))}
    </group>
  );
}

function Lawn() {
  const place = useGame((s) => s.place);
  const grass = useMemo(() => makeGrassAlbedo(), []);
  const sand = useMemo(() => {
    const tex = makeSandAlbedo();
    tex.repeat.set(18, 18);
    return tex;
  }, []);
  const grassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, color: "#7aa05c" }),
    [grass],
  );
  const sandMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: sand, roughness: 0.96, color: "#e4c48a", envMapIntensity: 0.08 }),
    [sand],
  );
  useEffect(
    () => () => {
      grass.dispose();
      sand.dispose();
      grassMat.dispose();
      sandMat.dispose();
    },
    [grass, sand, grassMat, sandMat],
  );
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.14, 0]}
      receiveShadow
      material={place === "beach" ? sandMat : grassMat}
    >
      <planeGeometry args={[48, 48]} />
    </mesh>
  );
}

function PlaceTone() {
  const place = useGame((s) => s.place);
  const beach = place === "beach";
  return (
    <>
      <color attach="background" args={[beach ? "#e6d3b0" : "#9eb4b0"]} />
      <fog attach="fog" args={[beach ? "#ead8b6" : "#b7c6c2", 18, 52]} />
    </>
  );
}

function playHalf() {
  return useGame.getState().place === "beach" ? HALF - 0.25 : PIT_HALF - 0.08;
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function smooth01(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function ToolCursors({ grabPoint }: { grabPoint: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  const tool = useGame((s) => s.tool);
  const held = useGame((s) => s.heldId);
  const kick = useRef({ wind: 0, hit: 0 });
  const pour = useRef(0);
  const curl = useRef(0.08);
  const handleLag = useRef(0.35);
  const yaw = useRef(0);
  const prevGrab = useRef(new THREE.Vector3(0, 1, 0));
  const bladeLoad = useRef(0);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const st = useGame.getState();
    const p = grabPoint.current;
    g.position.x = damp(g.position.x, p.x, 14, dt);
    g.position.y = damp(g.position.y, p.y, 14, dt);
    g.position.z = damp(g.position.z, p.z, 14, dt);
    g.visible = st.playing && tool !== "orbit";

    const bucket = g.getObjectByName("bucket");
    const shovel = g.getObjectByName("shovel");
    const mold = g.getObjectByName("mold");
    const foot = g.getObjectByName("foot");
    const hand = g.getObjectByName("hand");
    const can = g.getObjectByName("can");
    if (bucket) bucket.visible = tool === "scoop";
    if (shovel) shovel.visible = tool === "dig";
    if (mold) mold.visible = tool === "castle";
    if (foot) foot.visible = tool === "smash";
    if (hand) hand.visible = tool === "pick";
    if (can) can.visible = tool === "water";

    const acting = gesture.acting;
    if (tool === "smash") {
      if (acting) {
        kick.current.wind = Math.min(1, kick.current.wind + dt * 3.1);
        if (kick.current.wind > 0.9) kick.current.hit = Math.min(1, kick.current.hit + dt * 14);
      } else {
        kick.current.hit = damp(kick.current.hit, 0, 8, dt);
        kick.current.wind = damp(kick.current.wind, 0, 4.5, dt);
      }
      gesture.press = kick.current.hit;
    } else if (tool === "castle") {
      gesture.press = damp(gesture.press, acting ? 1 : 0, acting ? 7 : 5, dt);
    } else {
      gesture.press = damp(gesture.press, acting ? 1 : 0, acting ? 8 : 5.5, dt);
    }

    if (gesture.pendingDump) pour.current = damp(pour.current, 1, 4.2, dt);
    else pour.current = damp(pour.current, 0, 7, dt);
    gesture.pour = pour.current;

    const press = gesture.press;
    const tip = gesture.pour;
    const amt = st.scooped / st.scoopCap;
    const idle = Math.sin(performance.now() * 0.0016) * (acting ? 0 : 0.012);
    const dx = p.x - prevGrab.current.x;
    const dz = p.z - prevGrab.current.z;
    if (dx * dx + dz * dz > 0.000008) {
      const target = Math.atan2(dx, dz);
      let delta = target - yaw.current;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      yaw.current += delta * (1 - Math.exp(-14 * dt));
    }
    prevGrab.current.copy(p);
    if (bucket) bucket.rotation.y = yaw.current;
    if (shovel) shovel.rotation.y = yaw.current;

    if (bucket) {
      const rig = bucket.children[0];
      const bite = smooth01(press) * (1 - tip);
      rig.position.y = THREE.MathUtils.lerp(0.52, 0.22, bite) + tip * 0.2 + idle;
      rig.position.z = THREE.MathUtils.lerp(0, 0.05, bite);
      rig.rotation.x = THREE.MathUtils.lerp(-0.12, 0.28, bite) - tip * 1.45;
      rig.rotation.z = 0;
      const handle = bucket.getObjectByName("pail-handle");
      handleLag.current = damp(handleLag.current, 0.25 + bite * 0.9 - tip * 1.5, 3.5, dt);
      if (handle) handle.rotation.x = handleLag.current;
      const fill = bucket.getObjectByName("sand-fill");
      if (fill) {
        const level = Math.max(0, amt * (1 - tip * 0.92));
        fill.visible = level > 0.04;
        fill.scale.y = Math.max(0.08, level);
        fill.position.y = 0.08 + level * 0.1;
      }
    }
    if (shovel) {
      const rig = shovel.children[0];
      const swing = smooth01(press);
      rig.position.y = THREE.MathUtils.lerp(0.4, 0.16, swing) + idle;
      rig.position.z = 0;
      rig.rotation.x = THREE.MathUtils.lerp(-0.4, 0.22, swing);
      rig.rotation.z = 0;
      const grit = shovel.getObjectByName("blade-sand");
      if (acting && press > 0.5) bladeLoad.current = Math.min(1, bladeLoad.current + dt * 1.7);
      else bladeLoad.current = damp(bladeLoad.current, 0, 2.4, dt);
      const load = bladeLoad.current;
      if (grit) {
        grit.visible = load > 0.06;
        grit.scale.set(1.15, 0.35 + load * 0.85, 0.9);
      }
    }
    if (mold) {
      const rig = mold.children[0];
      const down = smooth01(press);
      rig.position.y = THREE.MathUtils.lerp(0.62, 0.06, down) + idle;
      rig.rotation.x = 0;
      rig.rotation.z = 0;
      rig.rotation.y = 0;
      rig.scale.set(1, 1, 1);
    }
    if (foot) {
      const rig = foot.children[0];
      const wind = kick.current.wind;
      const hit = kick.current.hit;
      rig.position.y = THREE.MathUtils.lerp(0.62, 0.4, Math.max(wind * 0.25, hit)) + idle;
      rig.position.z = THREE.MathUtils.lerp(-0.08, 0.2, hit);
      const knee = foot.getObjectByName("knee");
      const ankle = foot.getObjectByName("ankle");
      const toes = foot.getObjectByName("toes");
      if (knee) knee.rotation.x = THREE.MathUtils.lerp(0.35, -1.05, wind) + hit * 1.7;
      if (ankle) ankle.rotation.x = 0.2 + wind * 0.45 - hit * 0.35;
      if (toes) toes.rotation.x = -hit * 0.55;
    }
    curl.current = damp(curl.current, held ? 1 : 0.06, held ? 9 : 6, dt);
    if (hand) {
      const rig = hand.children[0];
      rig.position.y = (held ? 0.18 : 0.46) + idle;
      rig.rotation.x = held ? 1.05 : 0.65;
      rig.rotation.z = held ? -0.15 : 0;
      const grip = curl.current;
      const thumb = hand.getObjectByName("thumb");
      if (thumb) {
        thumb.rotation.y = 0.9 - grip * 0.35;
        const tk = thumb.getObjectByName("knuckle");
        const tm = thumb.getObjectByName("mid");
        const tt = thumb.getObjectByName("tip");
        if (tk) tk.rotation.x = grip * 0.7;
        if (tm) tm.rotation.x = grip * 0.9;
        if (tt) tt.rotation.x = grip * 0.6;
      }
      for (let i = 0; i < 4; i++) {
        const finger = hand.getObjectByName(`finger-${i}`);
        if (!finger) continue;
        const local = THREE.MathUtils.clamp((grip - i * 0.07) / 0.72, 0, 1);
        const knuckle = finger.getObjectByName("knuckle");
        const mid = finger.getObjectByName("mid");
        const tipJ = finger.getObjectByName("tip");
        if (knuckle) knuckle.rotation.x = local * 1.25;
        if (mid) mid.rotation.x = local * 1.45;
        if (tipJ) tipJ.rotation.x = local * 0.9;
      }
    }
    if (can) {
      const rig = can.children[0];
      const tilt = smooth01(press);
      rig.position.y = THREE.MathUtils.lerp(0.48, 0.2, tilt) + idle;
      rig.rotation.z = THREE.MathUtils.lerp(-0.2, -1.28, tilt);
      const stream = can.getObjectByName("stream");
      if (stream) {
        stream.visible = tilt > 0.45;
        const t = performance.now() * 0.005;
        stream.children.forEach((drop, i) => {
          const u = (t + i / stream.children.length) % 1;
          drop.position.set(0.26 + u * 0.05, 0.07 - u * u * 0.42, ((i % 3) - 1) * 0.012);
          drop.scale.setScalar((1 - u * 0.55) * (0.7 + tilt));
        });
      }
    }
  });

  return (
    <group ref={ref} position={[0, 2, 0]}>
      <group name="bucket">
        <group>
          <Pail />
        </group>
      </group>
      <group name="shovel">
        <group>
          <Spade />
        </group>
      </group>
      <group name="mold">
        <group>
          <CastleMold />
        </group>
      </group>
      <group name="foot">
        <group scale={1.65}>
          <KickingLeg />
        </group>
      </group>
      <group name="hand">
        <group scale={2.5}>
          <GrabHand />
        </group>
      </group>
      <group name="can">
        <group>
          <WateringCan />
        </group>
      </group>
    </group>
  );
}

function Shore() {
  const place = useGame((s) => s.place);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          float wave(vec2 p) {
            return sin(p.x * 1.4 + uTime * 1.15) * 0.09
              + sin(p.y * 0.85 - uTime * 0.8) * 0.06
              + sin((p.x + p.y) * 2.2 + uTime * 1.6) * 0.028;
          }
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += wave(pos.xy);
            float e = 0.12;
            float hx = wave(pos.xy + vec2(e, 0.0)) - wave(pos.xy - vec2(e, 0.0));
            float hy = wave(pos.xy + vec2(0.0, e)) - wave(pos.xy - vec2(0.0, e));
            vNormal = normalize(vec3(-hx, -hy, e * 2.0));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            vec3 n = normalize(vNormal);
            float fres = pow(1.0 - abs(n.z), 2.0);
            float shore = smoothstep(0.55, 0.98, vUv.y);
            float foam = shore * (0.45 + 0.55 * sin(vUv.x * 18.0 + vUv.y * 6.0));
            vec3 deep = vec3(0.06, 0.32, 0.38);
            vec3 shallow = vec3(0.45, 0.78, 0.74);
            vec3 col = mix(deep, shallow, shore);
            col += foam * 0.55;
            col += fres * vec3(0.7, 0.9, 0.95) * 0.35;
            float alpha = mix(0.78, 0.42, shore);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
  });
  if (place !== "beach") return null;
  return (
    <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, -HALF + 1.55]}>
      <planeGeometry args={[SIZE + 1.4, 4.8, 64, 28]} />
    </mesh>
  );
}

function Snapshotter() {
  const { gl, scene, camera } = useThree();
  const tick = useGame((s) => s.snapTick);
  useEffect(() => {
    if (!tick) return;
    gl.render(scene, camera);
    const a = document.createElement("a");
    a.href = gl.domElement.toDataURL("image/png");
    a.download = `dunebox-${Date.now()}.png`;
    a.click();
    useGame.getState().setToast("Snapshot saved.");
  }, [tick, gl, scene, camera]);
  return null;
}

function ToolSystem({ sim, grabPoint }: { sim: SandSim; grabPoint: React.MutableRefObject<THREE.Vector3> }) {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const lastSfx = useRef(0);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    const el = gl.domElement;
    const project = (cx: number, cy: number, out: THREE.Vector3) => {
      const rect = el.getBoundingClientRect();
      _ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
      _ray.setFromCamera(_ndc, camera);
      if (sandSurface.mesh) {
        const hits = _ray.intersectObject(sandSurface.mesh);
        if (hits[0]) {
          out.copy(hits[0].point);
          out.y += 0.12;
          return true;
        }
      }
      const hit = _ray.ray.intersectPlane(plane, out);
      if (!hit) return false;
      const h = sim.heightAt(out.x, out.z);
      out.y = h + 0.16;
      return true;
    };

    const apply = (dt: number) => {
      const st = useGame.getState();
      if (!st.playing || st.menuOpen) return;
      if (st.tool === "orbit" || st.tool === "pick") return;
      if (gesture.press < 0.62) return;
      const p = grabPoint.current;
      const limit = playHalf();
      const inside = Math.abs(p.x) <= limit && Math.abs(p.z) <= limit;
      if (!inside) return;
      const now = performance.now();

      if (st.tool === "scoop") {
        if (st.scooped < st.scoopCap - 0.001) {
          const got = sim.scoop(p.x, p.z, 0.36, 0.04 * dt * 60);
          st.setScooped(Math.min(st.scoopCap, st.scooped + got));
          if (now - lastSfx.current > 160) {
            playSfx("scoop");
            lastSfx.current = now;
          }
        }
      } else if (st.tool === "dig") {
        sim.dig(p.x, p.z, 0.3, 0.055 * dt * 60, true);
        if (now - lastSfx.current > 140) {
          playSfx("dig");
          lastSfx.current = now;
        }
      } else if (st.tool === "water") {
        sim.water(p.x, p.z, 0.48, 0.04 * dt * 60);
        if (now - lastSfx.current > 140) {
          playSfx("water");
          lastSfx.current = now;
        }
      }
    };

    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (dragging.current) apply(dt);
      const st = useGame.getState();
      if (gesture.didCastle && gesture.press > 0.84 && st.tool === "castle" && !st.menuOpen) {
        gesture.didCastle = false;
        const p = grabPoint.current;
        const res = sim.stampCastle(p.x, p.z);
        playSfx("castle");
        st.addTrauma(0.12);
        if (res.quality === "dry") st.setToast("Too dry — it will slump.");
        else if (res.quality === "wet") st.setToast("Too wet — the mold will not hold.");
        else if (res.stacked) st.setToast("Stacked.");
        else st.setToast("A castle.");
      }
      if (gesture.didKick && gesture.press > 0.82 && st.tool === "smash" && !st.menuOpen) {
        gesture.didKick = false;
        const p = grabPoint.current;
        const crushed = sim.smash(p.x, p.z, 0.5);
        playSfx("smash");
        st.addTrauma(0.4 + Math.min(0.35, crushed * 0.25));
        st.setToast(crushed > 0.35 ? "The castle gives way." : "Kicked.");
      }
      if (gesture.pendingDump && gesture.pour > 0.62) {
        gesture.pendingDump = false;
        const live = useGame.getState();
        if (live.scooped > 0.002) {
          const p = grabPoint.current;
          const m = 0.35 + sim.moistureAt(p.x, p.z) * 0.4;
          sim.deposit(p.x, p.z, 0.4, live.scooped, m);
          playSfx("dump");
          live.setScooped(0);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const st = useGame.getState();
      if (!st.playing || st.menuOpen) return;
      if (st.tool === "orbit") return;
      if (!project(e.clientX, e.clientY, _hit)) return;
      grabPoint.current.copy(_hit);
      const limit = playHalf();
      const inside = Math.abs(_hit.x) <= limit + 0.12 && Math.abs(_hit.z) <= limit + 0.12;
      if (!inside) return;

      if (st.tool === "castle") {
        sim.pushHistory();
        gesture.acting = true;
        gesture.didCastle = true;
        return;
      }
      if (st.tool === "smash") {
        sim.pushHistory();
        gesture.acting = true;
        gesture.didKick = true;
        return;
      }
      if (st.tool === "pick") return;
      sim.pushHistory();
      gesture.acting = true;
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!project(e.clientX, e.clientY, _hit)) return;
      grabPoint.current.copy(_hit);
      const h = sim.heightAt(_hit.x, _hit.z);
      const layer = layerAt(h);
      const st = useGame.getState();
      if (st.layerName !== layer.name) st.setLayer(layer.name, layer.hint);
      st.setHoverWorld({ x: _hit.x, y: h, z: _hit.z });
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;
      const st = useGame.getState();
      if (st.tool === "castle" && gesture.didCastle) {
        gesture.didCastle = false;
        const p = grabPoint.current;
        const res = sim.stampCastle(p.x, p.z);
        playSfx("castle");
        st.addTrauma(0.12);
        if (res.quality === "dry") st.setToast("Too dry — it will slump.");
        else if (res.quality === "wet") st.setToast("Too wet — the mold will not hold.");
        else if (res.stacked) st.setToast("Stacked.");
        else st.setToast("A castle.");
      }
      if (st.tool === "smash" && gesture.didKick) {
        gesture.didKick = false;
        const p = grabPoint.current;
        const crushed = sim.smash(p.x, p.z, 0.5);
        playSfx("smash");
        st.addTrauma(0.35);
        st.setToast(crushed > 0.35 ? "The castle gives way." : "Kicked.");
      }
      if (dragging.current && st.tool === "scoop" && st.scooped > 0.002) {
        gesture.pendingDump = true;
        playSfx("lift");
      }
      if (st.tool === "castle" || st.tool === "dig" || st.tool === "smash") {
        if (gesture.acting) playSfx("lift");
      }
      gesture.acting = false;
      if (st.tool === "pick" && st.heldId && performance.now() - meshPickedAt > 250) {
        st.setHeldId(null);
        playSfx("drop");
      }
      dragging.current = false;
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, grabPoint, plane, sim]);

  useFrame(() => {
    const st = useGame.getState();
    if (st.tool === "pick" && st.heldId) {
      grabPoint.current.y = sim.heightAt(grabPoint.current.x, grabPoint.current.z) + 0.28;
    }
  });

  return null;
}

function StudioEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.46;
    return () => {
      env.dispose();
      pmrem.dispose();
      if (scene.environment === env) scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#d5e4ea", "#6a4a32", 0.42]} />
      <ambientLight intensity={0.18} color="#f4ead8" />
      <directionalLight
        position={[7.5, 11, 5.5]}
        intensity={2.05}
        color="#fff1d6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={28}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00025}
      />
    </>
  );
}

export function World({ sim }: { sim: SandSim }) {
  const grabPoint = useRef(new THREE.Vector3(0, 1, 0));
  const resetNonce = useGame((s) => s.resetNonce);
  const undoTick = useGame((s) => s.undoTick);

  useEffect(() => {
    sim.seed(1337 + resetNonce * 17, useGame.getState().place);
  }, [resetNonce, sim]);

  useEffect(() => {
    if (!undoTick) return;
    const ok = sim.undo();
    useGame.getState().setScooped(0);
    useGame.getState().setToast(ok ? "Oops!" : "Nothing to undo.");
  }, [undoTick, sim]);

  return (
    <>
      <PlaceTone />
      <Sky sunPosition={[8, 12, 6]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <StudioEnv />
      <Lights />
      <Lawn />
      <BoxFrame />
      <Shore />
      <SandMesh sim={sim} />
      <Dust />
      <ToolCursors grabPoint={grabPoint} />
      <ToolSystem sim={sim} grabPoint={grabPoint} />
      <Snapshotter />
      <CameraRig />
      <Toys sim={sim} grabPoint={grabPoint} />
    </>
  );
}
