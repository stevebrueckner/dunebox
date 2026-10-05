import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "./audio";
import { BeachBall, Pail, Shell, Spade, Starfish, Umbrella } from "./props";
import { PIT, SIZE, SandSim, type TreasureKind } from "./sim";
import { useGame } from "./store";

export type ToyKind = TreasureKind | "bucket" | "shovel" | "ball" | "umbrella";
export let meshPickedAt = 0;

export type ToySpec = {
  id: string;
  kind: ToyKind;
  name: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  buried: boolean;
  depth: number;
  treasure: boolean;
  radius: number;
};

function meshFor(kind: ToyKind) {
  switch (kind) {
    case "shell":
      return <Shell />;
    case "star":
      return <Starfish />;
    case "marble":
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.09, 20, 16]} />
          <meshPhysicalMaterial
            color="#7ec8c2"
            roughness={0.05}
            metalness={0}
            transmission={0.92}
            thickness={0.2}
            ior={1.5}
            envMapIntensity={1.2}
          />
        </mesh>
      );
    case "car":
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.22, 0.08, 0.12]} />
            <meshStandardMaterial color="#c45c26" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.12, 0.06, 0.1]} />
            <meshStandardMaterial color="#f6f0e6" roughness={0.35} />
          </mesh>
          {[
            [-0.07, 0.03, 0.07],
            [0.07, 0.03, 0.07],
            [-0.07, 0.03, -0.07],
            [0.07, 0.03, -0.07],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.04, 10]} />
              <meshStandardMaterial color="#1c1917" roughness={0.7} />
            </mesh>
          ))}
        </group>
      );
    case "coin":
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.02, 20]} />
          <meshStandardMaterial color="#b08a5a" metalness={0.7} roughness={0.3} />
        </mesh>
      );
    case "key":
      return (
        <group rotation={[0, 0, 0.4]}>
          <mesh castShadow>
            <torusGeometry args={[0.045, 0.016, 8, 14]} />
            <meshStandardMaterial color="#a67c52" metalness={0.65} roughness={0.35} />
          </mesh>
          <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
            <meshStandardMaterial color="#a67c52" metalness={0.65} roughness={0.35} />
          </mesh>
        </group>
      );
    case "bell":
      return (
        <group>
          <mesh position={[0, 0.02, 0]} castShadow>
            <coneGeometry args={[0.08, 0.12, 12]} />
            <meshStandardMaterial color="#d9c4a0" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.04, 0]} castShadow>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#7a5133" />
          </mesh>
        </group>
      );
    case "beetle":
      return (
        <group>
          <mesh rotation={[0, 0, 0.2]} castShadow>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color="#3d6b4f" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0.06, 0.02, 0]} castShadow>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color="#2c4f3a" roughness={0.35} />
          </mesh>
        </group>
      );
    case "bucket":
      return (
        <group scale={0.85}>
          <Pail />
        </group>
      );
    case "shovel":
      return (
        <group scale={0.95} rotation={[Math.PI / 2, 0.6, 0]} position={[0, 0.05, 0]}>
          <Spade />
        </group>
      );
    case "ball":
      return <BeachBall />;
    case "umbrella":
      return <Umbrella />;
    default:
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color="#e2c19a" />
        </mesh>
      );
  }
}

function ToyBody({
  spec,
  sim,
  onBury,
  grabPoint,
}: {
  spec: ToySpec;
  sim: SandSim;
  onBury: (id: string) => void;
  grabPoint: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const state = useRef({ ...spec });
  const heldId = useGame((s) => s.heldId);
  const tool = useGame((s) => s.tool);
  const held = heldId === spec.id;

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const s = state.current;
    const g = ref.current;
    if (!g) return;

    if (held) {
      const p = grabPoint.current;
      s.x = p.x;
      s.y = p.y;
      s.z = p.z;
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      g.position.set(s.x, s.y, s.z);
      return;
    }

    s.vy -= 9.81 * d;
    s.x += s.vx * d;
    s.y += s.vy * d;
    s.z += s.vz * d;

    const limit = useGame.getState().place === "beach" ? SIZE / 2 - 0.35 : PIT / 2 - 0.22;
    if (s.x > limit) {
      s.x = limit;
      s.vx *= -0.25;
    } else if (s.x < -limit) {
      s.x = -limit;
      s.vx *= -0.25;
    }
    if (s.z > limit) {
      s.z = limit;
      s.vz *= -0.25;
    } else if (s.z < -limit) {
      s.z = -limit;
      s.vz *= -0.25;
    }

    const h = sim.heightAt(s.x, s.z);
    const support = h + spec.radius;
    if (s.y < support) {
      s.y = support;
      if (s.vy < 0) s.vy *= -0.12;
      const moist = sim.moistureAt(s.x, s.z);
      const packed = sim.packedAt(s.x, s.z);
      const grip = 0.18 + moist * 0.55 + packed * 0.35;
      s.vx *= 1 - grip * 0.35;
      s.vz *= 1 - grip * 0.35;
      const slope = sim.gradient(s.x, s.z);
      const steep = Math.hypot(slope.x, slope.z);
      if (steep > 0.32) {
        const slip = (1 - grip) * 1.8 * d;
        s.vx += slope.x * slip;
        s.vz += slope.z * slip;
      }
    }

    if (h > s.y + spec.radius * 0.55) {
      onBury(spec.id);
      return;
    }

    g.position.set(s.x, s.y, s.z);
    g.rotation.y += s.vx * d * 2;
    g.rotation.x += s.vz * d * 2;
    spec.x = s.x;
    spec.y = s.y;
    spec.z = s.z;
  });

  return (
    <group ref={ref} position={[spec.x, spec.y, spec.z]}>
      {meshFor(spec.kind)}
      <mesh
        visible={false}
        onPointerDown={(e) => {
          if (tool !== "pick") return;
          e.stopPropagation();
          meshPickedAt = performance.now();
          const st = useGame.getState();
          if (st.heldId === spec.id) {
            st.setHeldId(null);
            playSfx("drop");
          } else {
            st.setHeldId(spec.id);
            playSfx("grab");
          }
        }}
      >
        <sphereGeometry args={[spec.radius * 1.6, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

export function Toys({ sim, grabPoint }: { sim: SandSim; grabPoint: React.MutableRefObject<THREE.Vector3> }) {
  const resetNonce = useGame((s) => s.resetNonce);
  const place = useGame((s) => s.place);

  const initial = useMemo(() => {
    const list: ToySpec[] = [
      { id: "bucket", kind: "bucket", name: "Pail", x: 1.2, y: 1.2, z: 0.8, vx: 0, vy: 0, vz: 0, buried: false, depth: 0, treasure: false, radius: 0.12 },
      { id: "shovel", kind: "shovel", name: "Shovel", x: 1.0, y: 1.2, z: 1.05, vx: 0, vy: 0, vz: 0, buried: false, depth: 0, treasure: false, radius: 0.1 },
      { id: "ball", kind: "ball", name: "Beach ball", x: -1.3, y: 1.4, z: 0.35, vx: 0.4, vy: 0, vz: 0.15, buried: false, depth: 0, treasure: false, radius: 0.1 },
    ];
    if (place === "beach") {
      list.push(
        { id: "ball2", kind: "ball", name: "Stripe ball", x: 2.4, y: 1.3, z: 1.6, vx: 0, vy: 0, vz: 0, buried: false, depth: 0, treasure: false, radius: 0.11 },
        { id: "umbrella", kind: "umbrella", name: "Umbrella", x: -2.6, y: 1.2, z: 2.2, vx: 0, vy: 0, vz: 0, buried: false, depth: 0, treasure: false, radius: 0.16 },
        { id: "pail2", kind: "bucket", name: "Spare pail", x: 3.1, y: 1.2, z: 0.4, vx: 0, vy: 0, vz: 0, buried: false, depth: 0, treasure: false, radius: 0.12 },
      );
    }
    for (const b of sim.buried) {
      list.push({
        id: b.id,
        kind: b.kind,
        name: b.name,
        x: b.x,
        y: Math.max(0.2, b.depth + 0.12),
        z: b.z,
        vx: 0,
        vy: 1.2,
        vz: 0,
        buried: true,
        depth: b.depth,
        treasure: true,
        radius: 0.09,
      });
    }
    return list;
  }, [sim, resetNonce, place]);

  const [toys, setToys] = useState<ToySpec[]>(initial);
  const toysRef = useRef(toys);
  toysRef.current = toys;

  useEffect(() => {
    setToys(initial);
    useGame.getState().setBuriedLeft(initial.filter((t) => t.buried && t.treasure).length);
  }, [initial]);

  useFrame(() => {
    const prev = toysRef.current;
    let changed = false;
    const next = prev.map((t) => {
      if (!t.buried) return t;
      const h = sim.heightAt(t.x, t.z);
      if (h <= t.depth + 0.08) {
        changed = true;
        playSfx("find");
        useGame.getState().addTrauma(0.28);
        if (t.treasure) {
          useGame.getState().addFind({ kind: t.kind as TreasureKind, name: t.name });
          useGame.getState().setToast(`Found ${t.name}.`);
        }
        return { ...t, buried: false, y: h + 0.22, vy: 1.6 };
      }
      return t;
    });
    if (!changed) return;
    toysRef.current = next;
    setToys(next);
    useGame.getState().setBuriedLeft(next.filter((t) => t.buried && t.treasure).length);
  });

  const onBury = (id: string) => {
    setToys((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id || t.buried) return t;
        playSfx("dump");
        useGame.getState().setToast(`Buried ${t.name}.`);
        if (useGame.getState().heldId === id) useGame.getState().setHeldId(null);
        const pos = grabPoint.current;
        return {
          ...t,
          buried: true,
          x: pos.x,
          z: pos.z,
          depth: Math.max(0.05, sim.heightAt(pos.x, pos.z) * 0.35),
          vx: 0,
          vy: 0,
          vz: 0,
        };
      });
      useGame.getState().setBuriedLeft(next.filter((t) => t.buried && t.treasure).length);
      return next;
    });
  };

  return (
    <>
      {toys
        .filter((t) => !t.buried)
        .map((t) => (
          <ToyBody key={`${t.id}-${resetNonce}`} spec={t} sim={sim} onBury={onBury} grabPoint={grabPoint} />
        ))}
    </>
  );
}
