import {
  Camera,
  Castle,
  Droplets,
  Footprints,
  Hand,
  Menu,
  Move,
  PaintBucket,
  RotateCcw,
  Shovel,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { unlockAudio } from "./audio";
import { TOOLS, type Tool, useGame } from "./store";

const ICONS: Record<Tool, typeof Shovel> = {
  scoop: PaintBucket,
  dig: Shovel,
  castle: Castle,
  water: Droplets,
  smash: Footprints,
  pick: Hand,
  orbit: Move,
};

function enterPit() {
  unlockAudio();
  useGame.getState().setPlaying(true);
}

export function StartOverlay() {
  const playing = useGame((s) => s.playing);
  if (playing) return null;
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/70 px-6 text-center"
      onClick={enterPit}
    >
      <p className="mb-3 text-sm font-medium tracking-wide text-primary">Backyard physics pit</p>
      <h1 className="font-display text-5xl font-medium tracking-tight text-fg italic sm:text-6xl">Dunebox</h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        Scoop with the bucket, plant a castle mold, and dig down through the layers. Open the menu only when you
        need the tools. Wet sand holds. Dry sand slumps.
      </p>
      <button
        type="button"
        className="mt-8 min-h-11 rounded-lg bg-primary px-8 text-sm font-medium text-primary-fg transition-transform duration-150 ease-out hover:brightness-110 active:scale-95"
        onClick={(e) => {
          e.stopPropagation();
          enterPit();
        }}
      >
        Enter the pit
      </button>
      <p className="mt-6 max-w-sm text-xs leading-relaxed text-subtle">
        Menu locks the sand and shows the tools. Look orbits. Right drag and WASD move the view.
      </p>
    </div>
  );
}

export function HUD() {
  const playing = useGame((s) => s.playing);
  const tool = useGame((s) => s.tool);
  const soak = useGame((s) => s.soak);
  const scooped = useGame((s) => s.scooped);
  const cap = useGame((s) => s.scoopCap);
  const finds = useGame((s) => s.finds);
  const buriedLeft = useGame((s) => s.buriedLeft);
  const layerName = useGame((s) => s.layerName);
  const layerHint = useGame((s) => s.layerHint);
  const toast = useGame((s) => s.toast);
  const muted = useGame((s) => s.muted);
  const heldId = useGame((s) => s.heldId);
  const menuOpen = useGame((s) => s.menuOpen);
  const place = useGame((s) => s.place);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useGame.getState().setToast(""), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState();
      if (!st.playing || st.menuOpen) return;
      const t = TOOLS.find((x) => x.key === e.key);
      if (t) st.setTool(t.id);
      if (e.key === "Escape") st.setMenuOpen(true);
      if (e.key === "z" || e.key === "Z") st.requestUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!playing) return null;

  const meta = TOOLS.find((t) => t.id === tool);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">

      {toast && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg shadow-sm">
          {toast}
        </div>
      )}

      {menuOpen && (
        <div
          className="pointer-events-auto absolute inset-0 z-0"
          onPointerDown={() => useGame.getState().setMenuOpen(false)}
        />
      )}

      {menuOpen && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-24 z-20 mx-auto flex max-h-[70dvh] max-w-lg flex-col gap-3 overflow-auto rounded-xl border border-border bg-surface/95 p-3 shadow-sm sm:inset-x-auto sm:w-[32rem]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg italic text-fg">Dunebox</p>
              <p className="mt-1 text-xs text-muted">
                Finds {finds.length}/8 · Buried {buriedLeft}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg"
                onClick={() => useGame.getState().toggleMute()}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <button
                type="button"
                aria-label="Reset"
                className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg"
                onClick={() => useGame.getState().resetPit()}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          </div>

          {finds.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {finds.map((f) => (
                <li key={f.kind} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg">
                  {f.name}
                </li>
              ))}
            </ul>
          )}

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-3">
            <span className="flex items-center justify-between text-sm text-muted">
              Moisture
              <span className="font-medium tabular-nums text-fg">{Math.round(soak * 100)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(soak * 100)}
              onChange={(e) => useGame.getState().setSoak(Number(e.target.value) / 100)}
              className="h-8 w-full cursor-pointer accent-primary"
            />
          </label>

          <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
            <span className="font-medium text-fg">{layerName}</span>
            <span className="ml-2">{layerHint}</span>
            {tool === "scoop" && (
              <span className="ml-2 tabular-nums text-fg">Bucket {Math.round((scooped / cap) * 100)}%</span>
            )}
            {heldId && <span className="ml-2 text-fg">Holding a toy</span>}
          </div>

          <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
            {TOOLS.map((t) => {
              const Icon = ICONS[t.id];
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={`${t.label} (${t.key})`}
                  aria-label={t.label}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-fg",
                    active ? "bg-primary text-primary-fg" : "bg-surface-2",
                  )}
                  onClick={() => useGame.getState().setTool(t.id)}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  <span className="text-xs leading-none">{t.label}</span>
                </button>
              );
            })}
          </div>
          {meta && <p className="text-center text-xs text-muted">{meta.hint}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-fg"
              onClick={() => useGame.getState().requestUndo()}
            >
              <Undo2 className="size-4" />
              Oops!
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-fg"
              onClick={() => useGame.getState().requestSnap()}
            >
              <Camera className="size-4" />
              Snapshot
            </button>
            <button
              type="button"
              className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-fg"
              onClick={() => useGame.getState().setPlace(place === "pit" ? "beach" : "pit")}
            >
              <Waves className="size-4" />
              {place === "pit" ? "Switch to the beach" : "Back to the pit"}
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex items-center justify-between sm:inset-x-5">
        <button
          type="button"
          className="flex min-h-12 min-w-12 items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 text-sm font-medium text-fg shadow-sm"
          onClick={() => useGame.getState().setMenuOpen(!menuOpen)}
        >
          <Menu className="size-4" />
          {menuOpen ? "Sand" : "Menu"}
        </button>
        <button
          type="button"
          aria-pressed={tool === "orbit"}
          className={cn(
            "flex min-h-12 min-w-12 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium shadow-sm",
            tool === "orbit" ? "bg-primary text-primary-fg" : "bg-surface/95 text-fg",
          )}
          onClick={() => {
            const st = useGame.getState();
            st.setTool(st.tool === "orbit" ? st.lastTool : "orbit");
          }}
        >
          <Move className="size-4" />
          Look
        </button>
      </div>
    </div>
  );
}
