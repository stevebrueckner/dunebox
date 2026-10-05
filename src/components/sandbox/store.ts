import { create } from "zustand";
import type { TreasureKind } from "./sim";

export type Tool = "scoop" | "dig" | "castle" | "water" | "smash" | "pick" | "orbit";

export const TOOLS: { id: Tool; label: string; hint: string; key: string }[] = [
  { id: "scoop", label: "Scoop", hint: "Drag to fill the pail, release to dump.", key: "1" },
  { id: "dig", label: "Dig", hint: "Excavate a pit. Spoil piles around the rim.", key: "2" },
  { id: "castle", label: "Keep", hint: "Stamp a castle. Damp sand holds; dry slumps; soaked melts.", key: "3" },
  { id: "water", label: "Water", hint: "Sprinkle moisture. Cohesion peaks when damp, not flooded.", key: "4" },
  { id: "smash", label: "Smash", hint: "Collapse packed walls and jolt toys.", key: "5" },
  { id: "pick", label: "Pick", hint: "Grab a toy or find, drop it, or bury it in a hole.", key: "6" },
  { id: "orbit", label: "Look", hint: "Drag to orbit. WASD turns and moves the view.", key: "7" },
];

export type Find = { kind: TreasureKind; name: string };

type GameState = {
  playing: boolean;
  tool: Tool;
  soak: number;
  scooped: number;
  scoopCap: number;
  finds: Find[];
  buriedLeft: number;
  layerName: string;
  layerHint: string;
  toast: string;
  muted: boolean;
  trauma: number;
  hoverWorld: { x: number; y: number; z: number } | null;
  heldId: string | null;
  resetNonce: number;
  setPlaying: (v: boolean) => void;
  setTool: (t: Tool) => void;
  setSoak: (v: number) => void;
  setScooped: (v: number) => void;
  addFind: (f: Find) => void;
  setBuriedLeft: (n: number) => void;
  setLayer: (name: string, hint: string) => void;
  setToast: (msg: string) => void;
  toggleMute: () => void;
  addTrauma: (v: number) => void;
  decayTrauma: (dt: number) => void;
  setHoverWorld: (p: { x: number; y: number; z: number } | null) => void;
  setHeldId: (id: string | null) => void;
  resetPit: () => void;
};

export const useGame = create<GameState>((set, get) => ({
  playing: false,
  tool: "scoop",
  soak: 0.32,
  scooped: 0,
  scoopCap: 0.42,
  finds: [],
  buriedLeft: 8,
  layerName: "Loose dune",
  layerHint: "Dry grains. They slump.",
  toast: "",
  muted: false,
  trauma: 0,
  hoverWorld: null,
  heldId: null,
  resetNonce: 0,
  setPlaying: (v) => set({ playing: v }),
  setTool: (t) => set({ tool: t, heldId: t === "pick" ? get().heldId : null }),
  setSoak: (v) => set({ soak: v }),
  setScooped: (v) => set({ scooped: v }),
  addFind: (f) => {
    if (get().finds.some((x) => x.kind === f.kind)) return;
    set({ finds: [...get().finds, f] });
  },
  setBuriedLeft: (n) => set({ buriedLeft: n }),
  setLayer: (layerName, layerHint) => set({ layerName, layerHint }),
  setToast: (toast) => set({ toast }),
  toggleMute: () => set({ muted: !get().muted }),
  addTrauma: (v) => set({ trauma: Math.min(1, get().trauma + v) }),
  decayTrauma: (dt) => set({ trauma: Math.max(0, get().trauma - dt * 1.8) }),
  setHoverWorld: (hoverWorld) => set({ hoverWorld }),
  setHeldId: (heldId) => set({ heldId }),
  resetPit: () =>
    set({
      scooped: 0,
      finds: [],
      buriedLeft: 8,
      toast: "Pit raked smooth.",
      heldId: null,
      trauma: 0,
      resetNonce: get().resetNonce + 1,
    }),
}));
