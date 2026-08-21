import { useRef, useState } from "react";
import { Camera, Cat, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HexCropper } from "./HexCropper";
import { CameraCapture } from "./CameraCapture";
import { toast } from "sonner";
import { TRIANGLE_DEBUG } from "@/lib/flexagon/debug";

interface FacePickerProps {
  numeral: "I" | "II" | "III";
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function FacePicker({ numeral, value, onChange }: FacePickerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [catBusy, setCatBusy] = useState(false);

  function openCrop(src: string) {
    setRawSrc(src);
    setCropOpen(true);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => openCrop(r.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  }

  async function fetchCat() {
    if (catBusy) return;
    setCatBusy(true);
    try {
      const res = await fetch(
        `https://cataas.com/cat?width=900&height=900&t=${Date.now()}-${Math.random()}`,
      );
      if (!res.ok) throw new Error(`cataas ${res.status}`);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      openCrop(dataUrl);
    } catch (err) {
      console.error("[cats] fetch failed", err);
      toast.error("Couldn't reach the cat archive. Try again in a moment.");
    } finally {
      setCatBusy(false);
    }
  }

  return (
    <div className="sheet flex flex-col gap-3 p-5 pt-4">
      <span className="roman-numeral self-start text-2xl leading-none text-[var(--color-ink-soft)]">
        {numeral}
      </span>

      {/* Pointy-top regular hexagon: w/h = √3/2 ≈ 0.866 */}
      <div
        className="relative mx-auto w-full max-w-[180px]"
        style={{ aspectRatio: "0.8660254 / 1" }}
      >
        <div
          className="absolute inset-0 bg-[var(--color-paper-deep)]"
          style={{
            clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
          }}
        />
        {value ? (
          <>
            <img
              src={value}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
            />
            {TRIANGLE_DEBUG.faceOverlay && <FaceTriangleOverlay />}
          </>
        ) : (
          <div
            className="absolute inset-0 grid place-items-center text-[var(--color-ink-soft)]"
            style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
          >
            <span className="font-display text-sm italic">awaiting image</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImagePlus /> Upload
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCamOpen(true)}>
          <Camera /> Camera
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCat}
          disabled={catBusy}
          title="Fetch a random cat from cataas.com"
        >
          {catBusy ? <Loader2 className="animate-spin" /> : <Cat />} Cats
        </Button>
      </div>

      <HexCropper
        open={cropOpen}
        src={rawSrc}
        onCancel={() => setCropOpen(false)}
        onConfirm={(d) => {
          onChange(d);
          setCropOpen(false);
        }}
      />
      <CameraCapture
        open={camOpen}
        onCancel={() => setCamOpen(false)}
        onCapture={(d) => {
          setCamOpen(false);
          openCrop(d);
        }}
      />
    </div>
  );
}

function FaceTriangleOverlay() {
  const width = 50 * Math.sqrt(3);
  const centerX = width / 2;
  const vertices = [
    [centerX, 0],
    [width, 25],
    [width, 75],
    [centerX, 100],
    [0, 75],
    [0, 25],
  ];

  return (
    <svg
      viewBox={`0 0 ${width} 100`}
      aria-label="Six numbered image triangles"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {vertices.map(([x, y], index) => (
        <line
          key={index}
          x1={centerX}
          y1="50"
          x2={x}
          y2={y}
          stroke="var(--color-paper)"
          strokeWidth="0.8"
        />
      ))}
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (-60 + index * 60) * (Math.PI / 180);
        const x = centerX + Math.cos(angle) * 11;
        const y = 50 + Math.sin(angle) * 11;
        return (
          <g key={index}>
            <circle
              cx={x}
              cy={y}
              r="4.8"
              fill="color-mix(in srgb, var(--color-ink) 82%, transparent)"
            />
            <text
              x={x}
              y={y + 0.4}
              fill="var(--color-paper)"
              fontSize="6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
