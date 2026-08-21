import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HEXAGON_OUTPUT_PATH, HEXAGON_OUTPUT_POINTS } from "@/lib/flexagon/hex-mask";

interface CameraCaptureProps {
  open: boolean;
  onCancel: () => void;
  onCapture: (dataUrl: string) => void;
}

export function CameraCapture({ open, onCancel, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Camera unavailable.";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    onCapture(c.toDataURL("image/jpeg", 0.92));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Capture from camera</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-paper-deep)] p-4 text-sm text-[var(--color-ink-soft)]">
            {error} You can upload an image instead.
          </div>
        ) : (
          <div className="relative mx-auto aspect-square w-[360px] overflow-hidden bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <svg
              viewBox="0 0 100 100"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
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
            </svg>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={snap}
            disabled={!!error}
            className="bg-[var(--color-oxblood)] text-[var(--color-paper)] hover:bg-[var(--color-oxblood)]/90"
          >
            Take photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
