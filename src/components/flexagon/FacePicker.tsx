import { useRef, useState } from "react";
import { Camera, ImagePlus, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HexCropper, type CropPlacement } from "./HexCropper";
import { CameraCapture } from "./CameraCapture";
import { IdeasPanel } from "./IdeasPanel";
import { TRIANGLE_DEBUG } from "@/lib/flexagon/debug";

interface FacePickerProps {
  numeral: "I" | "II" | "III";
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function FacePicker({ numeral, value, onChange }: FacePickerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [placement, setPlacement] = useState<CropPlacement | null>(null);
  // The uncropped original behind the current face, and how it was cropped.
  const [applied, setApplied] = useState<{
    face: string;
    src: string;
    placement: CropPlacement;
  } | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);

  function openCrop(src: string) {
    setRawSrc(src);
    setPlacement(null);
    setCropOpen(true);
  }

  function reopenCrop() {
    if (!value) return;
    // Go back to the original with its crop if we have it; a face that was
    // never cropped here (a bundled default) opens as it is.
    const original = applied?.face === value ? applied : null;
    setRawSrc(original?.src ?? value);
    setPlacement(original?.placement ?? null);
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
          <button
            type="button"
            onClick={reopenCrop}
            aria-label={`Adjust the crop of face ${numeral}`}
            title="Adjust crop"
            className="group absolute inset-0 cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.03] focus-visible:scale-[1.03] focus-visible:outline-none"
          >
            <img
              src={value}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
            />
            {TRIANGLE_DEBUG.faceOverlay && <FaceTriangleOverlay />}
            <svg
              viewBox="0 0 86.60254 100"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <polygon
                points="43.30127,0 86.60254,25 86.60254,75 43.30127,100 0,75 0,25"
                fill="none"
                stroke="var(--color-oxblood)"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
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
          onClick={() => setIdeasOpen(true)}
          title="Emoji, text, or a random cat"
        >
          <Lightbulb /> Ideas
        </Button>
      </div>

      <HexCropper
        open={cropOpen}
        src={rawSrc}
        initial={placement}
        onCancel={() => setCropOpen(false)}
        onConfirm={(d, cropped) => {
          if (rawSrc) setApplied({ face: d, src: rawSrc, placement: cropped });
          onChange(d);
          setCropOpen(false);
        }}
      />
      <IdeasPanel
        open={ideasOpen}
        onCancel={() => setIdeasOpen(false)}
        onPick={(d) => {
          setIdeasOpen(false);
          openCrop(d);
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
