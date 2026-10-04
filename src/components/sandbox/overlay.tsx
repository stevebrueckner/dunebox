import {
  BrickWall,
  Droplets,
  Hammer,
  Hand,
  Layers,
  Move,
  Pickaxe,
  RotateCcw,
  Shovel,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { unlockAudio } from "./audio";
import { TOOLS, type Tool, useGame } from "./store";

const ICONS: Record<Tool, typeof Shovel> = {
  scoop: Shovel,
  dig: Pickaxe,
  castle: BrickWall,
  water: Droplets,
  smash: Hammer,
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
        Scoop dunes, pack a keep, pour water, and dig through layers for what the tide hid. Wet sand holds.
        Dry sand slumps. Flooded walls melt.
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
        Left drag uses the tool. Right drag orbits. WASD turns and moves. Keys 1–7 switch tools.
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

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useGame.getState().setToast(""), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useGame.getState().playing) return;
      const t = TOOLS.find((x) => x.key === e.key);
      if (t) useGame.getState().setTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!playing) return null;

  const meta = TOOLS.find((t) => t.id === tool);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/90 px-4 py-3 shadow-sm">
          <p className="font-display text-lg italic text-fg">Dunebox</p>
          <p className="mt-1 text-xs text-muted">
            Finds {finds.length}/8 · Buried {buriedLeft}
          </p>
          {finds.length > 0 && (
            <ul className="mt-2 flex max-w-52 flex-wrap gap-1">
              {finds.map((f) => (
                <li
                  key={f.kind}
                  className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg"
                  title={f.name}
                >
                  {f.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              className="grid size-11 place-items-center rounded-lg border border-border bg-surface/90 text-fg"
              onClick={() => useGame.getState().toggleMute()}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              type="button"
              aria-label="Reset pit"
              className="grid size-11 place-items-center rounded-lg border border-border bg-surface/90 text-fg"
              onClick={() => useGame.getState().resetPit()}
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
          <label className="flex w-40 flex-col gap-1 rounded-xl border border-border bg-surface/90 px-3 py-2 sm:w-52">
            <span className="flex items-center justify-between text-xs text-muted">
              Pit moisture
              <span className="font-medium tabular-nums text-fg">{Math.round(soak * 100)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(soak * 100)}
              onChange={(e) => useGame.getState().setSoak(Number(e.target.value) / 100)}
              className="w-full accent-primary"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
          <div className="rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 font-medium text-fg">
              <Layers className="size-3.5" />
              {layerName}
            </span>
            <span className="ml-2 hidden sm:inline">{layerHint}</span>
          </div>
          {tool === "scoop" && (
            <div className="rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs text-muted">
              Pail
              <span className="font-medium tabular-nums text-fg">
                {" "}
                {Math.round((scooped / cap) * 100)}%
              </span>
            </div>
          )}
          {heldId && (
            <div className="rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs text-fg">
              Holding — click sand to drop
            </div>
          )}
        </div>

        {toast && (
          <div className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg shadow-sm">{toast}</div>
        )}

        <div className="pointer-events-auto w-full max-w-xl">
          <div className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface/95 p-2">
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
                    "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-fg transition-colors duration-150",
                    active ? "bg-primary text-primary-fg" : "hover:bg-surface-2",
                  )}
                  onClick={() => useGame.getState().setTool(t.id)}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  <span className="hidden text-xs leading-none sm:block">{t.label}</span>
                </button>
              );
            })}
          </div>
          {meta && <p className="mt-2 text-center text-xs text-muted">{meta.hint}</p>}
        </div>
      </div>
    </div>
  );
}
