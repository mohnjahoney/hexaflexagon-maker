// LEGACY: the original hand-choreographed folding animation. It is no longer
// part of the main flow (see ../paper-model and routes/flex.tsx) and is kept
// only for reference at #/animation-legacy. Do not build new features on it.

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
// import volleyballBall from "@/assets/volleyball-ball.png";
// import volleyballBump from "@/assets/volleyball-bump.png";
// import volleyballSpike from "@/assets/volleyball-spike.png";
import sunflower_5 from "@/assets/sunflower_5.png";
import sunflower_7 from "@/assets/sunflower_7.png";
import sunflower_8 from "@/assets/sunflower_8.png";
import type { FaceImages } from "@/lib/flexagon/render";
import {
  createInitialFoldingState,
  FIRST_FOLD,
  SECOND_FOLD,
  applyOperation,
  applyOperations,
  resolveFoldHingeSide,
  rotateFoldingStateAroundVerticalAxis,
  withFoldAngle,
  withFoldThickness,
  type FoldOperation,
  type SurfaceId,
} from "@/lib/flexagon/custom-folding-instructions/folding-engine";
import { renderStripAssets } from "@/lib/flexagon/custom-folding-instructions/render";
import { createFoldingAnimationRenderer } from "@/lib/flexagon/custom-folding-instructions/three-renderer";
import { HashLink } from "@/components/HashLink";

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

function buildThicknessAwareSequence(paperThickness: number) {
  const thicken = (state: ReturnType<typeof createInitialFoldingState>, fold: FoldOperation) =>
    withFoldThickness(fold, paperThickness, resolveFoldHingeSide(state, fold, fold.angle));

  const initial = applyOperation(createInitialFoldingState(), { kind: "flip" });
  const firstFold = thicken(initial, withFoldAngle(FIRST_FOLD, -Math.PI));
  const firstFoldDone = applyOperation(initial, firstFold);
  const secondFold = thicken(firstFoldDone, withFoldAngle(SECOND_FOLD, Math.PI));
  const secondFoldDone = applyOperation(firstFoldDone, secondFold);
  const thirdFold = thicken(secondFoldDone, {
    kind: "fold",
    between: [1, 2],
    moving: [1],
    angle: (2 * Math.PI) / 3,
    placement: "front",
  });
  const thirdFoldDone = applyOperation(secondFoldDone, thirdFold);

  const tailTemplates = [
    {
      kind: "fold",
      between: [7, 8],
      moving: [8, 9, 10],
      angle: -Math.PI / 3,
      placement: "front",
    },
    {
      kind: "fold",
      between: [8, 9],
      moving: [9, 10],
      angle: Math.PI / 3,
      placement: "front",
    },
    {
      kind: "fold",
      between: [9, 10],
      moving: [10],
      angle: -Math.PI / 3,
      placement: "front",
    },
  ] as const satisfies readonly FoldOperation[];
  const lastThreeJointFolds: FoldOperation[] = [];
  let fourthFoldDone = thirdFoldDone;
  tailTemplates.forEach((template) => {
    const fold = thicken(fourthFoldDone, template);
    lastThreeJointFolds.push(fold);
    fourthFoldDone = applyOperation(fourthFoldDone, fold);
  });

  // Unfold on the latched hinge side until theta reaches zero.
  const returnFirstTriangleToFlat = withFoldAngle(thirdFold, -thirdFold.angle);
  const firstTriangleFlat = applyOperation(fourthFoldDone, returnFirstTriangleToFlat);
  // At zero the transform is identical on either axis, so the side can switch continuously.
  const firstTriangleBeyondFlat = withFoldThickness(
    {
      ...thirdFold,
      angle: (-2 * Math.PI) / 180,
      placement: "behind",
    },
    paperThickness,
    thirdFold.hingeSide === 1 ? -1 : 1,
  );
  const fifthFoldDone = applyOperation(firstTriangleFlat, firstTriangleBeyondFlat);

  const flattenLastThreeJointFolds = [...lastThreeJointFolds]
    .reverse()
    .map((fold) => withFoldAngle(fold, -fold.angle));
  const sixthFoldDone = applyOperations(fifthFoldDone, flattenLastThreeJointFolds);
  const seventhFoldDone = rotateFoldingStateAroundVerticalAxis(sixthFoldDone, Math.PI);
  const eighthFold = thicken(seventhFoldDone, {
    kind: "fold",
    between: [9, 10],
    moving: [10],
    angle: Math.PI,
    placement: "front",
  });
  const eighthFoldDone = applyOperation(seventhFoldDone, eighthFold);

  return {
    initial,
    firstFold,
    firstFoldDone,
    secondFold,
    secondFoldDone,
    thirdFold,
    thirdFoldDone,
    lastThreeJointFolds,
    fourthFoldDone,
    returnFirstTriangleToFlat,
    firstTriangleFlat,
    firstTriangleBeyondFlat,
    fifthFoldDone,
    flattenLastThreeJointFolds,
    sixthFoldDone,
    seventhFoldDone,
    eighthFold,
    eighthFoldDone,
  };
}

export function Animation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef(0);
  const seekRef = useRef<number | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("Blank side up");
  const [phaseNote, setPhaseNote] = useState<string | null>(
    "For single-sided prints only: fold the wide strip in half along its long centre line. Double-sided prints are already prepared.",
  );
  const [timelineMs, setTimelineMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [faces] = useState(storedFaces);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let frame = 0;
    let elapsed = 0;
    let previous = performance.now();
    let renderer: ReturnType<typeof createFoldingAnimationRenderer> | undefined;
    const preparationHold = 1200;
    const preparationDuration = 4200;
    const preparationEndHold = 900;
    const firstFoldDuration = 2200;
    const firstHold = 700;
    const secondFoldDuration = 2600;
    const secondHold = 700;
    const thirdFoldDuration = 1800;
    const thirdHold = 700;
    const fourthFoldDuration = 1800;
    const fourthHold = 700;
    const fifthFoldDuration = 2200;
    const fifthHold = 700;
    const sixthFoldDuration = 1800;
    const sixthHold = 700;
    const seventhFoldDuration = 2600;
    const seventhHold = 700;
    const eighthFoldDuration = 2400;
    const endHold = 1200;
    const preparationEnd = preparationHold + preparationDuration;
    const firstFoldStart = preparationEnd + preparationEndHold;
    const firstFoldEnd = firstFoldStart + firstFoldDuration;
    const secondFoldStart = firstFoldEnd + firstHold;
    const secondFoldEnd = secondFoldStart + secondFoldDuration;
    const thirdFoldStart = secondFoldEnd + secondHold;
    const thirdFoldEnd = thirdFoldStart + thirdFoldDuration;
    const fourthFoldStart = thirdFoldEnd + thirdHold;
    const fourthFoldEnd = fourthFoldStart + fourthFoldDuration;
    const fifthFoldStart = fourthFoldEnd + fourthHold;
    const fifthFoldEnd = fifthFoldStart + fifthFoldDuration;
    const sixthFoldStart = fifthFoldEnd + fifthHold;
    const sixthFoldEnd = sixthFoldStart + sixthFoldDuration;
    const seventhFoldStart = sixthFoldEnd + sixthHold;
    const seventhFoldEnd = seventhFoldStart + seventhFoldDuration;
    const eighthFoldStart = seventhFoldEnd + seventhHold;
    const eighthFoldEnd = eighthFoldStart + eighthFoldDuration;
    const cycleMs = eighthFoldEnd + endHold;
    let previousPhase = "";
    let previousNote: string | null = null;
    let previousCycleTime = 0;
    let lastTimelineUpdate = 0;
    setDurationMs(cycleMs);

    void renderStripAssets(faces)
      .then((assets) => {
        if (cancelled) return;
        renderer = createFoldingAnimationRenderer(canvas, assets);
        let sequenceThickness = renderer.paperThickness();
        let sequence = buildThicknessAwareSequence(sequenceThickness);
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
          if (restartRef.current) {
            elapsed = 0;
            restartRef.current = 0;
            didSeek = true;
          }

          const currentThickness = renderer?.paperThickness() ?? sequenceThickness;
          if (Math.abs(currentThickness - sequenceThickness) > 1e-8) {
            sequenceThickness = currentThickness;
            sequence = buildThicknessAwareSequence(sequenceThickness);
          }

          const {
            initial,
            firstFold,
            firstFoldDone,
            secondFold,
            secondFoldDone,
            thirdFold,
            thirdFoldDone,
            lastThreeJointFolds,
            fourthFoldDone,
            returnFirstTriangleToFlat,
            firstTriangleFlat,
            firstTriangleBeyondFlat,
            fifthFoldDone,
            flattenLastThreeJointFolds,
            sixthFoldDone,
            seventhFoldDone,
            eighthFold,
            eighthFoldDone,
          } = sequence;

          const cycleTime = elapsed % cycleMs;
          const cycleRestarted = cycleTime < previousCycleTime;
          previousCycleTime = cycleTime;
          if (didSeek || now - lastTimelineUpdate >= 50) {
            lastTimelineUpdate = now;
            setTimelineMs(cycleTime);
          }
          let nextPhase = "Blank side up";
          let nextNote: string | null = null;
          let state = initial;
          let surfaceOpacity: Partial<Record<SurfaceId, number>> | undefined;
          let preparationFoldProgress: number | undefined;

          if (cycleTime < preparationHold) {
            nextPhase = "Phase 0 · Prepare the double-sided strip";
            nextNote =
              "For single-sided prints only: fold the wide strip in half along its long centre line. Double-sided prints are already prepared.";
            preparationFoldProgress = 0;
          } else if (cycleTime < preparationEnd) {
            nextPhase = "Phase 0 · Fold the top half back and down";
            nextNote =
              "For single-sided prints only: fold the wide strip in half along its long centre line. Double-sided prints are already prepared.";
            preparationFoldProgress = easeInOut(
              (cycleTime - preparationHold) / preparationDuration,
            );
          } else if (cycleTime < firstFoldStart) {
            nextPhase = "Phase 0 complete · Blank side up";
            state = initial;
          } else if (cycleTime < firstFoldEnd) {
            nextPhase = "Phase 1 · Fold left three forward";
            const progress = easeInOut((cycleTime - firstFoldStart) / firstFoldDuration);
            state = applyOperation(initial, withFoldAngle(firstFold, firstFold.angle * progress));
          } else if (cycleTime >= firstFoldEnd && cycleTime < secondFoldStart) {
            nextPhase = "Phase 1 complete";
            state = firstFoldDone;
          } else if (cycleTime >= secondFoldStart && cycleTime < secondFoldEnd) {
            nextPhase = "Phase 2 · Fold right four behind";
            const progress = easeInOut((cycleTime - secondFoldStart) / secondFoldDuration);
            state = applyOperation(
              firstFoldDone,
              withFoldAngle(secondFold, secondFold.angle * progress),
            );
          } else if (cycleTime >= secondFoldEnd && cycleTime < thirdFoldStart) {
            nextPhase = "Phase 2 complete";
            state = secondFoldDone;
          } else if (cycleTime >= thirdFoldStart && cycleTime < thirdFoldEnd) {
            nextPhase = "Phase 3 · Fold original leftmost triangle forward 120°";
            const progress = easeInOut((cycleTime - thirdFoldStart) / thirdFoldDuration);
            state = applyOperation(
              secondFoldDone,
              withFoldAngle(thirdFold, thirdFold.angle * progress),
            );
          } else if (cycleTime >= thirdFoldEnd && cycleTime < fourthFoldStart) {
            nextPhase = "Phase 3 complete";
            state = thirdFoldDone;
          } else if (cycleTime >= fourthFoldStart && cycleTime < fourthFoldEnd) {
            nextPhase = "Phase 4 · Bend original joints 6–7, 7–8, and 8–9";
            const progress = easeInOut((cycleTime - fourthFoldStart) / fourthFoldDuration);
            state = applyOperations(
              thirdFoldDone,
              lastThreeJointFolds.map((fold) => withFoldAngle(fold, fold.angle * progress)),
            );
          } else if (cycleTime >= fourthFoldEnd && cycleTime < fifthFoldStart) {
            nextPhase = "Phase 4 complete";
            state = fourthFoldDone;
          } else if (cycleTime >= fifthFoldStart && cycleTime < fifthFoldEnd) {
            const phaseTime = cycleTime - fifthFoldStart;
            const progress = easeInOut(phaseTime / fifthFoldDuration);
            const returnAngle = Math.abs(returnFirstTriangleToFlat.angle);
            const beyondAngle = Math.abs(firstTriangleBeyondFlat.angle);
            const angleTraveled = (returnAngle + beyondAngle) * progress;
            nextPhase = "Phase 5 · Return original first triangle 2° past flat";
            if (angleTraveled <= returnAngle) {
              state = applyOperation(
                fourthFoldDone,
                withFoldAngle(
                  returnFirstTriangleToFlat,
                  Math.sign(returnFirstTriangleToFlat.angle) * angleTraveled,
                ),
              );
            } else {
              state = applyOperation(
                firstTriangleFlat,
                withFoldAngle(
                  firstTriangleBeyondFlat,
                  Math.sign(firstTriangleBeyondFlat.angle) * (angleTraveled - returnAngle),
                ),
              );
            }
          } else if (cycleTime >= fifthFoldEnd && cycleTime < sixthFoldStart) {
            nextPhase = "Phase 5 complete";
            state = fifthFoldDone;
          } else if (cycleTime >= sixthFoldStart && cycleTime < sixthFoldEnd) {
            nextPhase = "Phase 6 · Return rightmost three joints to flat";
            const progress = easeInOut((cycleTime - sixthFoldStart) / sixthFoldDuration);
            const concealProgress = easeInOut(Math.max(0, Math.min(1, (progress - 0.55) / 0.45)));
            surfaceOpacity = { 1: 1 - concealProgress, 19: 1 - concealProgress };
            state = applyOperations(
              fifthFoldDone,
              flattenLastThreeJointFolds.map((fold) => withFoldAngle(fold, fold.angle * progress)),
            );
          } else if (cycleTime >= sixthFoldEnd && cycleTime < seventhFoldStart) {
            nextPhase = "Phase 6 complete";
            surfaceOpacity = { 1: 0, 19: 0 };
            state = sixthFoldDone;
          } else if (cycleTime >= seventhFoldStart && cycleTime < seventhFoldEnd) {
            nextPhase = "Phase 7 · Rotate the whole object 180°";
            const progress = easeInOut((cycleTime - seventhFoldStart) / seventhFoldDuration);
            surfaceOpacity = { 1: 0, 19: 0 };
            state = rotateFoldingStateAroundVerticalAxis(sixthFoldDone, Math.PI * progress);
          } else if (cycleTime >= seventhFoldEnd && cycleTime < eighthFoldStart) {
            nextPhase = "Phase 7 complete";
            surfaceOpacity = { 1: 0, 19: 0 };
            state = seventhFoldDone;
          } else if (cycleTime >= eighthFoldStart && cycleTime < eighthFoldEnd) {
            nextPhase = "Phase 8 · Fold rightmost triangle onto the blank face";
            const progress = easeInOut((cycleTime - eighthFoldStart) / eighthFoldDuration);
            const concealProgress = easeInOut(Math.max(0, Math.min(1, (progress - 0.55) / 0.45)));
            surfaceOpacity = {
              1: 0,
              19: 0,
              11: 1 - concealProgress,
              20: 1 - concealProgress,
            };
            state = applyOperation(
              seventhFoldDone,
              withFoldAngle(eighthFold, eighthFold.angle * progress),
            );
          } else if (cycleTime >= eighthFoldEnd) {
            nextPhase = "All eight phases complete";
            surfaceOpacity = { 1: 0, 11: 0, 19: 0, 20: 0 };
            state = eighthFoldDone;
          }

          if (nextPhase !== previousPhase) {
            previousPhase = nextPhase;
            setPhaseLabel(nextPhase);
          }
          if (nextNote !== previousNote) {
            previousNote = nextNote;
            setPhaseNote(nextNote);
          }
          renderer?.render(state, {
            surfaceOpacity,
            preparationFoldProgress,
            smoothVerticalCenter: playingRef.current,
            snapVerticalCenter: didSeek || cycleRestarted,
          });
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((reason) => {
        console.error("[flexagon] Animation setup failed:", reason);
        setLoading(false);
        setError("The 3-D strip could not be rendered in this browser.");
      });

    const observer = new ResizeObserver(() => renderer?.resize());
    observer.observe(canvas);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer?.dispose();
    };
  }, [faces]);

  return (
    <main className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="label-eyebrow">3-D folding animation</p>
            <h1 className="mt-1 font-display text-2xl">Follow along and fold</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-sm border border-[var(--color-hairline)] bg-[var(--color-paper-deep)]">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            aria-label="Animated flexagon strip preparation and eight-phase fold"
          />
          {/* <div className="pointer-events-none absolute left-4 top-4 rounded-sm border border-[var(--color-hairline)] bg-[var(--color-paper)]/90 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
            {phaseLabel} · Diagnostic gap: 2 px
          </div> */}
          {phaseNote && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 rounded-sm border border-[var(--color-hairline)] bg-[var(--color-paper)]/95 px-4 py-3 text-center text-sm text-[var(--color-ink-soft)] shadow-sm">
              {phaseNote}
            </div>
          )}
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

        <div className="flex flex-col gap-4">
          <div className="flex w-full flex-wrap items-center gap-3 border-t border-[var(--color-hairline)] pt-4">
            <Button
              variant="outline"
              onClick={() => setPlaying((value) => !value)}
              disabled={loading || !!error}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                restartRef.current = 1;
                setPlaying(true);
              }}
              disabled={loading || !!error}
            >
              <RotateCcw />
              Restart
            </Button>
            <input
              type="range"
              min={0}
              max={durationMs}
              step={10}
              value={Math.min(timelineMs, durationMs)}
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
                const nextTime = Math.min(Number(event.currentTarget.value), durationMs - 1);
                seekRef.current = nextTime;
                setTimelineMs(nextTime);
              }}
              disabled={loading || !!error}
              aria-label="Animation timeline"
              className="h-2 min-w-48 flex-1 cursor-pointer accent-[var(--color-oxblood)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <output className="min-w-[6.5rem] text-right font-mono text-xs tabular-nums text-[var(--color-ink-soft)]">
              {formatTime(timelineMs)} / {formatTime(durationMs)}
            </output>
          </div>
        </div>
      </section>
    </main>
  );
}

function easeInOut(progress: number) {
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
