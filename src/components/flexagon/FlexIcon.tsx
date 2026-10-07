import { useEffect, useRef } from "react";
import type { FaceImages } from "@/lib/flexagon/render";
import { renderStripAssets } from "@/lib/flexagon/custom-folding-instructions/render";
import { buildFlexLoop, finishedHexagon } from "@/lib/flexagon/paper-model/flex-loop";
import { createPaperRenderer, type PaperRenderer } from "@/lib/flexagon/paper-model/renderer";

interface FlexIconProps {
  faces: FaceImages;
  className?: string;
}

/** A small, calm loop of the finished toy flexing through the chosen faces. */
export function FlexIcon({ faces, className }: FlexIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PaperRenderer | null>(null);
  const facesRef = useRef(faces);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let frame = 0;
    const loop = buildFlexLoop(finishedHexagon(), { flexMs: 6500, holdMs: 3500, closeUp: true });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void renderStripAssets(facesRef.current)
      .then((assets) => {
        if (cancelled) return;
        const renderer = createPaperRenderer(canvas, assets, { decorative: true });
        rendererRef.current = renderer;
        const start = performance.now();
        const draw = (now: number) => {
          const sample = loop.sample(still ? 0 : now - start);
          renderer.render(sample.pose, sample.frame);
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((reason) => {
        // Purely decorative: without WebGL the page simply goes without it.
        console.warn("[flexagon] Flex icon could not be rendered:", reason);
      });

    const observer = new ResizeObserver(() => rendererRef.current?.resize());
    observer.observe(canvas);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (facesRef.current === faces) return;
    facesRef.current = faces;
    let cancelled = false;
    void renderStripAssets(faces)
      .then((assets) => {
        if (!cancelled) rendererRef.current?.setAssets(assets);
      })
      .catch((reason) => console.warn("[flexagon] Flex icon could not be updated:", reason));
    return () => {
      cancelled = true;
    };
  }, [faces]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
    </div>
  );
}
