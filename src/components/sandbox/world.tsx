import { Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { playSfx } from "./audio";
import { CameraRig } from "./camera";
import { meshPickedAt, Toys } from "./items";
import { CELL, COLS, FLOOR, SIZE, SandSim, layerAt } from "./sim";
import { useGame } from "./store";
import { makeGrassAlbedo, makeSandAlbedo, makeSandBump, makeWoodAlbedo } from "./textures";

const HALF = SIZE / 2;
const WALL = 0.2;
const WALL_H = 0.95;
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
        bumpScale: 0.035,
        roughness: 0.86,
        metalness: 0.02,
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
    sim.step(d, useGame.getState().soak);
    if (sim.dirty) {
      syncSand(geo, sim);
      sim.dirty = false;
    }
    if (sim.crumbles.length) {
      for (const c of sim.crumbles.splice(0, 8)) {
        spawnBurst(c.x, c.y, c.z, 10, c.mag);
      }
    }
  });

  return <mesh ref={meshRef} geometry={geo} material={mat} receiveShadow castShadow />;
}

type Burst = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number };
const bursts: Burst[] = [];

function spawnBurst(x: number, y: number, z: number, n: number, mag = 1) {
  for (let i = 0; i < n; i++) {
    if (bursts.length > 90) bursts.shift();
    bursts.push({
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 1.4 * mag,
      vy: 0.8 + Math.random() * 1.4 * mag,
      vz: (Math.random() - 0.5) * 1.4 * mag,
      life: 0.45 + Math.random() * 0.4,
      size: 0.03 + Math.random() * 0.04,
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
    for (let i = 0; i < 90; i++) {
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
    <instancedMesh ref={mesh} args={[undefined, undefined, 90]} castShadow>
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

  const inner = HALF + WALL / 2;
  const len = SIZE + WALL * 2;

  return (
    <group>
      <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[SIZE + 0.04, SIZE + 0.04]} />
      </mesh>
      <mesh position={[0, WALL_H / 2 - 0.05, inner]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H, WALL]} />
      </mesh>
      <mesh position={[0, WALL_H / 2 - 0.05, -inner]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H, WALL]} />
      </mesh>
      <mesh position={[inner, WALL_H / 2 - 0.05, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[WALL, WALL_H, SIZE]} />
      </mesh>
      <mesh position={[-inner, WALL_H / 2 - 0.05, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[WALL, WALL_H, SIZE]} />
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
  const tex = useMemo(() => makeGrassAlbedo(), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: "#7aa05c" }),
    [tex],
  );
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]} receiveShadow material={mat}>
      <planeGeometry args={[48, 48]} />
    </mesh>
  );
}

function PailCursor({ grabPoint }: { grabPoint: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const tool = useGame((s) => s.tool);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = grabPoint.current;
    g.position.lerp(p, 0.45);
    g.visible = tool === "scoop" && useGame.getState().playing;
    const amt = useGame.getState().scooped / useGame.getState().scoopCap;
    if (fill.current) {
      fill.current.scale.y = Math.max(0.05, amt);
      fill.current.position.y = -0.05 + amt * 0.05;
      (fill.current.material as THREE.MeshStandardMaterial).color.set(amt > 0.02 ? "#c4a06a" : "#3f7a74");
    }
  });

  return (
    <group ref={ref} position={[0, 2, 0]}>
      <mesh>
        <cylinderGeometry args={[0.12, 0.1, 0.16, 14, 1, true]} />
        <meshStandardMaterial color="#3f7a74" side={THREE.DoubleSide} roughness={0.4} />
      </mesh>
      <mesh ref={fill} position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.1, 0.085, 0.1, 12]} />
        <meshStandardMaterial color="#c4a06a" />
      </mesh>
    </group>
  );
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
      if (!st.playing) return;
      if (st.tool === "orbit" || st.tool === "pick") return;
      const p = grabPoint.current;
      const inside = Math.abs(p.x) <= HALF && Math.abs(p.z) <= HALF;
      if (!inside && st.tool !== "scoop") return;
      const now = performance.now();

      if (st.tool === "scoop") {
        if (inside && st.scooped < st.scoopCap - 0.001) {
          const got = sim.scoop(p.x, p.z, 0.38, 0.055 * dt * 60);
          st.setScooped(Math.min(st.scoopCap, st.scooped + got));
          spawnBurst(p.x, p.y, p.z, 2, 0.4);
          if (now - lastSfx.current > 80) {
            playSfx("scoop");
            lastSfx.current = now;
          }
        }
      } else if (st.tool === "dig") {
        const before = sim.heightAt(p.x, p.z);
        sim.dig(p.x, p.z, 0.28, 0.05 * dt * 60, true);
        spawnBurst(p.x, p.y, p.z, 3, 0.6);
        if (now - lastSfx.current > 90) {
          playSfx(before <= FLOOR + 0.04 ? "wood" : "dig");
          lastSfx.current = now;
        }
      } else if (st.tool === "water") {
        sim.water(p.x, p.z, 0.48, 0.045 * dt * 60);
        if (now - lastSfx.current > 70) {
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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const st = useGame.getState();
      if (!st.playing) return;
      if (st.tool === "orbit") return;
      if (!project(e.clientX, e.clientY, _hit)) return;
      grabPoint.current.copy(_hit);
      const inside = Math.abs(_hit.x) <= HALF + 0.15 && Math.abs(_hit.z) <= HALF + 0.15;

      if (st.tool === "castle" && inside) {
        const res = sim.stampCastle(_hit.x, _hit.z);
        playSfx("castle");
        st.addTrauma(0.18);
        spawnBurst(_hit.x, _hit.y, _hit.z, 16, 0.8);
        if (res.quality === "dry") st.setToast("Too dry — the keep will slump.");
        else if (res.quality === "wet") st.setToast("Too wet — the walls melt.");
        else st.setToast("Packed a keep.");
        return;
      }
      if (st.tool === "smash" && inside) {
        const crushed = sim.smash(_hit.x, _hit.z, 0.55);
        playSfx("smash");
        st.addTrauma(0.45 + Math.min(0.4, crushed * 0.3));
        spawnBurst(_hit.x, _hit.y, _hit.z, 22, 1.2);
        st.setToast(crushed > 0.4 ? "The keep gives way." : "Sand sprays.");
        return;
      }
      if (st.tool === "pick") return;
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
      if (dragging.current && st.tool === "scoop" && st.scooped > 0.002) {
        const p = grabPoint.current;
        const m = 0.35 + sim.moistureAt(p.x, p.z) * 0.4;
        sim.deposit(p.x, p.z, 0.42, st.scooped, m);
        spawnBurst(p.x, p.y, p.z, 18, 0.9);
        playSfx("dump");
        st.setScooped(0);
      }
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

function Lights() {
  return (
    <>
      <hemisphereLight args={["#e7eef2", "#6b4a2e", 0.62]} />
      <ambientLight intensity={0.38} color="#f3e6d0" />
      <directionalLight
        position={[7.5, 11, 5.5]}
        intensity={2.15}
        color="#fff1d6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={28}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
      />
    </>
  );
}

export function World({ sim }: { sim: SandSim }) {
  const grabPoint = useRef(new THREE.Vector3(0, 1, 0));
  const resetNonce = useGame((s) => s.resetNonce);

  useEffect(() => {
    sim.seed(1337 + resetNonce * 17);
  }, [resetNonce, sim]);

  return (
    <>
      <color attach="background" args={["#9eb4b0"]} />
      <fog attach="fog" args={["#b7c6c2", 16, 44]} />
      <Sky sunPosition={[8, 12, 6]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <Lights />
      <Lawn />
      <BoxFrame />
      <SandMesh sim={sim} />
      <Dust />
      <PailCursor grabPoint={grabPoint} />
      <ToolSystem sim={sim} grabPoint={grabPoint} />
      <CameraRig />
      <Toys sim={sim} grabPoint={grabPoint} />
    </>
  );
}
