import { create } from "zustand";
import type { TreasureKind } from "./sim";

export type Tool = "scoop" | "dig" | "castle" | "water" | "smash" | "pick" | "orbit";
export type Place = "pit" | "beach";

export const TOOLS: { id: Tool; label: string; hint: string; key: string }[] = [
  { id: "scoop", label: "Scoop", hint: "Lower the bucket, drag to fill, release to lift and dump.", key: "1" },
  { id: "dig", label: "Shovel", hint: "Set the blade and drag. Spoil piles on the rim.", key: "2" },
  { id: "castle", label: "Castle", hint: "Plant the mold, release to lift it. Damp sand stacks.", key: "3" },
  { id: "water", label: "Water", hint: "Sprinkle a patch. Flooded sand will not hold a castle.", key: "4" },
  { id: "smash", label: "Kick", hint: "Drive a foot in. Packed walls give way.", key: "5" },
  { id: "pick", label: "Grab", hint: "A hand closes on a toy. Click sand to drop or bury it.", key: "6" },
  { id: "orbit", label: "Look", hint: "Drag to orbit. WASD turns and moves the view.", key: "7" },
];

export type Find = { kind: TreasureKind; name: string };

type GameState = {
  playing: boolean;
  tool: Tool;
  lastTool: Tool;
  menuOpen: boolean;
  place: Place;
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
  undoTick: number;
  snapTick: number;
  setPlaying: (v: boolean) => void;
  setTool: (t: Tool) => void;
  setMenuOpen: (v: boolean) => void;
  setPlace: (p: Place) => void;
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
  requestUndo: () => void;
  requestSnap: () => void;
  resetPit: () => void;
};

export const useGame = create<GameState>((set, get) => ({
  playing: false,
  tool: "scoop",
  lastTool: "scoop",
  menuOpen: false,
  place: "pit",
  soak: 0.42,
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
  undoTick: 0,
  snapTick: 0,
  setPlaying: (v) => set({ playing: v, menuOpen: false }),
  setTool: (t) =>
    set({
      tool: t,
      lastTool: t === "orbit" ? get().lastTool : t,
      heldId: t === "pick" ? get().heldId : null,
    }),
  setMenuOpen: (v) => set({ menuOpen: v }),
  setPlace: (p) =>
    set({
      place: p,
      scooped: 0,
      finds: [],
      heldId: null,
      toast: p === "beach" ? "The tide is in." : "Back in the box.",
      resetNonce: get().resetNonce + 1,
    }),
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
  requestUndo: () => set({ undoTick: get().undoTick + 1 }),
  requestSnap: () => set({ snapTick: get().snapTick + 1 }),
  resetPit: () =>
    set({
      scooped: 0,
      finds: [],
      buriedLeft: 8,
      toast: get().place === "beach" ? "Beach raked smooth." : "Pit raked smooth.",
      heldId: null,
      trauma: 0,
      resetNonce: get().resetNonce + 1,
    }),
}));
