import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import sunflower_5 from "@/assets/sunflower_5.png";
import sunflower_7 from "@/assets/sunflower_7.png";
import sunflower_8 from "@/assets/sunflower_8.png";
import type { FaceImages } from "@/lib/flexagon/render";
import { renderStripAssets } from "@/lib/flexagon/custom-folding-instructions/render";
import { buildFlexLoop, finishedHexagon } from "@/lib/flexagon/paper-model/flex-loop";
import { buildFoldTimeline } from "@/lib/flexagon/paper-model/fold-sequence";
import { createPaperRenderer } from "@/lib/flexagon/paper-model/renderer";

type Mode = "fold" | "flex";

function storedFaces(): FaceImages {
  const fallback = {
    face1: sunflower_5,
    face2: sunflower_7,
    face3: sunflower_8,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const value = sessionStorage.getItem("flexagon-animation-faces");
    return value ? (JSON.parse(value) as FaceImages) : fallback;
  } catch {
    return fallback;
  }
}

function buildTimelines() {
  return { fold: buildFoldTimeline(), flex: buildFlexLoop(finishedHexagon()) };
}

export function Flex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seekRef = useRef<number | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const timelines = useMemo(buildTimelines, []);
  const [mode, setMode] = useState<Mode>("fold");
  const modeRef = useRef(mode);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [timelineMs, setTimelineMs] = useState(0);
  const [faces] = useState(storedFaces);
  const timeline = timelines[mode];

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let frame = 0;
    let elapsed = 0;
    let previous = performance.now();
    let previousStep = -1;
    let lastTimelineUpdate = 0;
    let activeMode = modeRef.current;
    let renderer: ReturnType<typeof createPaperRenderer> | undefined;

    void renderStripAssets(faces)
      .then((assets) => {
        if (cancelled) return;
        renderer = createPaperRenderer(canvas, assets);
        setLoading(false);

        const draw = (now: number) => {
          if (playingRef.current) elapsed += Math.min(now - previous, 100);
          previous = now;
          let didSeek = false;
          if (seekRef.current !== null) {
            elapsed = seekRef.current;
            seekRef.current = null;
            didSeek = true;
          }
          if (activeMode === "fold" && elapsed >= timelines.fold.duration) {
            // The toy is finished: go and play with it.
            modeRef.current = "flex";
            setMode("flex");
          }
          if (modeRef.current !== activeMode) {
            activeMode = modeRef.current;
            elapsed = 0;
            didSeek = true;
          }

          const timeline = timelines[activeMode];
          const time = elapsed % timeline.duration;
          if (didSeek || now - lastTimelineUpdate >= 50) {
            lastTimelineUpdate = now;
            setTimelineMs(time);
          }
          const sample = timeline.sample(time);
          if (sample.step !== previousStep) {
            previousStep = sample.step;
            setStep(sample.step);
          }
          renderer?.render(sample.pose, sample.frame);
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((reason) => {
        console.error("[flexagon] Paper model setup failed:", reason);
        setLoading(false);
        setError("The 3-D model could not be rendered in this browser.");
      });

    const observer = new ResizeObserver(() => renderer?.resize());
    observer.observe(canvas);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer?.dispose();
    };
  }, [faces, timelines]);

  const current = timeline.steps[Math.min(step, timeline.steps.length - 1)];
  const disabled = loading || !!error;

  return (
    <main className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="label-eyebrow">3-D paper model</p>
            <h1 className="mt-1 font-display text-2xl">
              {mode === "fold" ? "Follow along and fold" : "Flex through the three faces"}
            </h1>
          </div>
          <div className="flex gap-2">
            {(["fold", "flex"] as const).map((option) => (
              <Button
                key={option}
                variant={mode === option ? "default" : "outline"}
                onClick={() => {
                  setMode(option);
                  setPlaying(true);
                }}
              >
                {option === "fold" ? "Fold it" : "Flex it"}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-sm border border-[var(--color-hairline)] bg-[var(--color-paper-deep)]">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
            aria-label={
              mode === "fold"
                ? "Animated flexagon strip being folded into a hexagon"
                : "Animated flexagon flexing through its three faces"
            }
          />
          {loading && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-ink-soft)]">
              Preparing the printed strip…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-oxblood)]">
              {error}
            </div>
          )}
        </div>

        <div className="min-h-[3.5rem] text-center text-sm">
          {!disabled && (
            <>
              <p className="font-display text-lg text-[var(--color-ink)]">{current.label}</p>
              {current.note && (
                <p className="mx-auto mt-1 max-w-2xl text-[var(--color-ink-soft)]">
                  {current.note}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 border-t border-[var(--color-hairline)] pt-4">
          <Button
            variant="outline"
            onClick={() => setPlaying((value) => !value)}
            disabled={disabled}
          >
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              seekRef.current = 0;
              setPlaying(true);
            }}
            disabled={disabled}
          >
            <RotateCcw />
            Restart
          </Button>
          <input
            type="range"
            min={0}
            max={timeline.duration}
            step={10}
            value={Math.min(timelineMs, timeline.duration)}
            onPointerDown={() => {
              resumeAfterScrubRef.current = playingRef.current;
              setPlaying(false);
            }}
            onPointerUp={() => {
              if (resumeAfterScrubRef.current) setPlaying(true);
              resumeAfterScrubRef.current = false;
            }}
            onPointerCancel={() => {
              if (resumeAfterScrubRef.current) setPlaying(true);
              resumeAfterScrubRef.current = false;
            }}
            onInput={(event) => {
              const nextTime = Math.min(Number(event.currentTarget.value), timeline.duration - 1);
              seekRef.current = nextTime;
              setTimelineMs(nextTime);
            }}
            disabled={disabled}
            aria-label="Animation timeline"
            className="h-2 min-w-48 flex-1 cursor-pointer accent-[var(--color-oxblood)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <output className="min-w-[6.5rem] text-right font-mono text-xs tabular-nums text-[var(--color-ink-soft)]">
            {formatTime(timelineMs)} / {formatTime(timeline.duration)}
          </output>
        </div>
      </section>
    </main>
  );
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
