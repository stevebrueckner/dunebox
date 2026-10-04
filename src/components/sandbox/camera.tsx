import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "./store";

const TMP = new THREE.Vector3();
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

type Probe = {
  getYaw: () => number;
  getSpeed: () => number;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: Probe;
    __ready?: boolean;
  }
}

export function CameraRig() {
  const { camera, gl } = useThree();
  const yaw = useRef(0.55);
  const pitch = useRef(0.72);
  const radius = useRef(8.4);
  const target = useRef(new THREE.Vector3(0, 0.45, 0.15));
  const speed = useRef(0);
  const keys = useRef(new Set<string>());
  const injected = useRef<Set<string> | null>(null);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const shake = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = gl.domElement;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.repeat) return;
      if (down) keys.current.add(e.code);
      else keys.current.delete(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => keys.current.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    const orbitOk = (e: PointerEvent) => {
      const tool = useGame.getState().tool;
      return e.button === 2 || e.button === 1 || tool === "orbit" || pointers.current.size >= 2;
    };

    const onDown = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        pinch.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        dragging.current = true;
        return;
      }
      if (orbitOk(e)) {
        dragging.current = true;
        last.current = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch.current > 0) {
          const delta = (pinch.current - d) * 0.02;
          radius.current = THREE.MathUtils.clamp(radius.current + delta, 3.2, 16);
        }
        pinch.current = d;
        const mx = (pts[0].x + pts[1].x) * 0.5;
        const my = (pts[0].y + pts[1].y) * 0.5;
        if (last.current.x || last.current.y) {
          yaw.current -= (mx - last.current.x) * 0.005;
          pitch.current = THREE.MathUtils.clamp(pitch.current + (my - last.current.y) * 0.004, 0.18, 1.32);
        }
        last.current = { x: mx, y: my };
        return;
      }
      if (!dragging.current) return;
      yaw.current -= (e.clientX - last.current.x) * 0.0055;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + (e.clientY - last.current.y) * 0.0045,
        0.18,
        1.32,
      );
      last.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = 0;
      if (pointers.current.size === 0) dragging.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      radius.current = THREE.MathUtils.clamp(radius.current + e.deltaY * 0.008, 3.2, 16);
    };
    const prevent = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("contextmenu", prevent);

    window.__controlsTest = {
      getYaw: () => yaw.current,
      getSpeed: () => speed.current,
      setKeys: (codes) => {
        injected.current = new Set(codes);
      },
    };

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", prevent);
      if (window.__controlsTest) delete window.__controlsTest;
    };
  }, [camera, gl]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    const k = injected.current ?? keys.current;
    let steer = 0;
    if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
    if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
    yaw.current += steer * 1.35 * d;

    const fx = -Math.sin(yaw.current);
    const fz = -Math.cos(yaw.current);
    FWD.set(fx, 0, fz);
    RIGHT.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    let move = 0;
    let strafe = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) move += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) move -= 1;
    if (k.has("KeyQ")) strafe -= 1;
    if (k.has("KeyE")) strafe += 1;
    const pan = 3.4;
    target.current.addScaledVector(FWD, move * pan * d);
    target.current.addScaledVector(RIGHT, strafe * pan * d);
    target.current.x = THREE.MathUtils.clamp(target.current.x, -2.6, 2.6);
    target.current.z = THREE.MathUtils.clamp(target.current.z, -2.6, 2.6);
    speed.current = Math.hypot(move, strafe) * pan;

    if (k.has("Space")) target.current.y = Math.min(1.6, target.current.y + 1.6 * d);
    if (k.has("ShiftLeft") || k.has("ShiftRight")) target.current.y = Math.max(0.1, target.current.y - 1.6 * d);

    const horiz = radius.current * Math.cos(pitch.current);
    TMP.set(
      target.current.x + Math.sin(yaw.current) * horiz,
      target.current.y + radius.current * Math.sin(pitch.current),
      target.current.z + Math.cos(yaw.current) * horiz,
    );

    const trauma = useGame.getState().trauma;
    const shakeAmt = trauma * trauma;
    if (shakeAmt > 0.001) {
      shake.current.set((Math.random() - 0.5) * shakeAmt * 0.18, (Math.random() - 0.5) * shakeAmt * 0.12, 0);
      useGame.getState().decayTrauma(d);
    } else {
      shake.current.set(0, 0, 0);
    }

    camera.position.lerp(TMP, 1 - Math.exp(-10 * d));
    camera.position.add(shake.current);
    camera.lookAt(target.current);
  });

  return null;
}
