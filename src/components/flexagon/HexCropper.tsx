import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { themeColor } from "@/lib/theme-colors";
import { HEXAGON_OUTPUT_PATH, HEXAGON_OUTPUT_POINTS } from "@/lib/flexagon/hex-mask";

interface HexCropperProps {
  open: boolean;
  src: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

const OUT_SIZE = 1024;
const CONTROL_MIN_RADIUS = 72;
const CONTROL_MAX_RADIUS = 140;

export function HexCropper({ open, src, onCancel, onConfirm }: HexCropperProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [minimumScale, setMinimumScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rotation, setRotation] = useState(0);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const controlDragging = useRef<"handle" | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!src) return setImg(null);
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      setImg(i);
      // Start at the smallest uniform scale that covers the full hexagon.
      const stage = stageRef.current;
      if (stage) {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const s = Math.max(w / i.width, h / i.height);
        setMinimumScale(s);
        setScale(s);
        setTx(0);
        setTy(0);
        setRotation(0);
      }
    };
    i.src = src;
  }, [src]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX - tx, y: e.clientY - ty };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (controlDragging.current === "handle") {
      updateControlFromPointer(e);
      return;
    }
    if (!dragging.current) return;
    setTx(e.clientX - dragging.current.x);
    setTy(e.clientY - dragging.current.y);
  }
  function onPointerUp() {
    dragging.current = null;
    controlDragging.current = null;
  }

  function updateControlFromPointer(e: React.PointerEvent) {
    if (controlDragging.current !== "handle") return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const radius = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const radiusT = Math.min(
      1,
      Math.max(0, (radius - CONTROL_MIN_RADIUS) / (CONTROL_MAX_RADIUS - CONTROL_MIN_RADIUS)),
    );
    setRotation(angle);
    setScale(minimumScale + radiusT * minimumScale * 3);
  }

  function startHandleDrag(e: React.PointerEvent<SVGCircleElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    controlDragging.current = "handle";
    updateControlFromPointer(e);
  }

  function resetCrop() {
    setScale(minimumScale);
    setTx(0);
    setTy(0);
    setRotation(0);
  }

  function handleConfirm() {
    if (!img || !stageRef.current) return;
    const stage = stageRef.current;
    const sw = stage.clientWidth,
      sh = stage.clientHeight;
    // Render at OUT_SIZE square
    const canvas = document.createElement("canvas");
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d")!;
    // paper background
    ctx.fillStyle = themeColor("paper");
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

    // hex clip (flat-top hex inscribed in square)
    const cx = OUT_SIZE / 2,
      cy = OUT_SIZE / 2;
    const r = OUT_SIZE / 2;
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();

    // Map the square preview directly to the square output canvas.
    const kx = OUT_SIZE / sw;
    const ky = OUT_SIZE / sh;
    const drawW = img.width * scale * kx;
    const drawH = img.height * scale * ky;
    ctx.translate(OUT_SIZE / 2 + tx * kx, OUT_SIZE / 2 + ty * ky);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  }

  const controlAngle = (rotation * Math.PI) / 180;
  const controlRadius =
    CONTROL_MIN_RADIUS +
    ((scale - minimumScale) / (minimumScale * 3)) * (CONTROL_MAX_RADIUS - CONTROL_MIN_RADIUS);
  const controlX = 199 + controlRadius * Math.cos(controlAngle);
  const controlY = 199 + controlRadius * Math.sin(controlAngle);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Zoom, move, and rotate.</DialogTitle>
        </DialogHeader>
        <div
          ref={stageRef}
          className="group relative mx-auto aspect-square w-[398px] cursor-grab active:cursor-grabbing select-none overflow-hidden bg-[var(--color-paper-deep)]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <button
            type="button"
            onClick={resetCrop}
            disabled={!img}
            aria-label="Reset crop"
            title="Reset crop"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-[var(--color-ink)]/75 text-[var(--color-paper)] transition-colors hover:bg-[var(--color-ink)] disabled:pointer-events-none disabled:opacity-0"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {img && (
            <img
              src={img.src}
              draggable={false}
              alt=""
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: img.width * scale,
                height: img.height * scale,
                maxWidth: "none",
                maxHeight: "none",
                transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rotation}deg)`,
                pointerEvents: "none",
              }}
            />
          )}
          <svg
            viewBox="0 0 398 398"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <g transform="scale(3.98)">
              <path
                d={`M0 0H100V100H0Z ${HEXAGON_OUTPUT_PATH}`}
                fill="rgba(0,0,0,0.52)"
                fillRule="evenodd"
              />
              <polygon
                points={HEXAGON_OUTPUT_POINTS}
                fill="none"
                stroke="var(--color-paper)"
                strokeWidth="0.8"
              />
            </g>
            <g className="opacity-0 transition-opacity duration-150 md:group-hover:opacity-100">
              <line
                x1="199"
                y1="199"
                x2={controlX}
                y2={controlY}
                stroke="var(--color-paper)"
                strokeWidth="1.5"
              />
              <circle cx="199" cy="199" r="6" fill="var(--color-paper)" />
              <circle
                cx={controlX}
                cy={controlY}
                r="11"
                fill="var(--color-paper)"
                stroke="var(--color-oxblood)"
                strokeWidth="3"
                pointerEvents="auto"
                onPointerDown={startHandleDrag}
                onPointerMove={updateControlFromPointer}
                onPointerUp={onPointerUp}
              />
            </g>
          </svg>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-[var(--color-oxblood)] text-[var(--color-paper)] hover:bg-[var(--color-oxblood)]/90"
          >
            Use this crop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
