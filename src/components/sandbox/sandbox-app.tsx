import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { setMuted } from "./audio";
import { SandSim } from "./sim";
import { type Tool, useGame } from "./store";
import { World } from "./world";

declare global {
  interface Window {
    __ready?: boolean;
    __sandbox?: {
      setTool: (t: string) => void;
      getTool: () => string;
      getScooped: () => number;
      getFinds: () => number;
      getMoisture: () => number;
      setMoisture: (v: number) => void;
      reset: () => void;
    };
  }
}

export default function SandboxApp() {
  const sim = useMemo(() => new SandSim(), []);
  const muted = useGame((s) => s.muted);
  const tool = useGame((s) => s.tool);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    window.__sandbox = {
      setTool: (t) => useGame.getState().setTool(t as Tool),
      getTool: () => useGame.getState().tool,
      getScooped: () => useGame.getState().scooped,
      getFinds: () => useGame.getState().finds.length,
      getMoisture: () => useGame.getState().soak,
      setMoisture: (v) => useGame.getState().setSoak(v),
      reset: () => useGame.getState().resetPit(),
    };
    return () => {
      delete window.__sandbox;
    };
  }, []);

  return (
    <div
      className="absolute inset-0 touch-none"
      style={{ cursor: tool === "orbit" ? "grab" : tool === "pick" ? "grab" : "crosshair" }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.12, far: 80, position: [4.4, 5.8, 6.6] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          window.__ready = true;
        }}
      >
        <Suspense fallback={null}>
          <World sim={sim} />
        </Suspense>
      </Canvas>
    </div>
  );
}
