import { useEffect, useRef, useState } from "react";
import { Cat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface IdeasPanelProps {
  open: boolean;
  onCancel: () => void;
  /** Called with a square image, ready to be zoomed, moved and rotated. */
  onPick: (dataUrl: string) => void;
}

type Tab = "emoji" | "text" | "cat";
type FontId = "serif" | "sans" | "mono" | "script" | "poster";
type SizeId = "small" | "medium" | "large";

const OUT_SIZE = 900;
// The face is a hexagon inside the square, so keep artwork away from the corners.
const SAFE_WIDTH = OUT_SIZE * 0.66;
const SAFE_HEIGHT = OUT_SIZE * 0.66;
const HEXAGON = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

const COLORS = [
  "#1f1a17",
  "#ffffff",
  "#f6efe2",
  "#8c2f2a",
  "#e4572e",
  "#f2b705",
  "#3a9d5d",
  "#2f7fd1",
  "#7a4fd6",
  "#e85d9f",
];

const EMOJI = [
  "😀",
  "😍",
  "🤪",
  "😎",
  "🥳",
  "🤖",
  "👻",
  "👽",
  "🐱",
  "🐶",
  "🦊",
  "🐸",
  "🐙",
  "🦄",
  "🐝",
  "🦋",
  "🌻",
  "🌈",
  "🌙",
  "⭐",
  "🔥",
  "🌊",
  "🍕",
  "🍉",
  "🍩",
  "🎈",
  "🎲",
  "🎸",
  "⚽",
  "🚀",
  "💎",
  "❤️",
];

const FONTS: { id: FontId; label: string; family: string; weight: number }[] = [
  { id: "serif", label: "Serif", family: '"Fraunces", Georgia, serif', weight: 600 },
  { id: "sans", label: "Sans", family: '"Inter Tight", system-ui, sans-serif', weight: 600 },
  { id: "mono", label: "Mono", family: 'ui-monospace, "Courier New", monospace', weight: 700 },
  {
    id: "script",
    label: "Script",
    family: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive',
    weight: 700,
  },
  { id: "poster", label: "Poster", family: 'Impact, "Arial Black", sans-serif', weight: 400 },
];

const SIZES: { id: SizeId; label: string; pixels: number }[] = [
  { id: "small", label: "S", pixels: 110 },
  { id: "medium", label: "M", pixels: 170 },
  { id: "large", label: "L", pixels: 250 },
];

interface Artwork {
  background: string;
  lines: string[];
  color: string;
  font: string;
  weight: number;
  pixels: number;
}

function drawArtwork(canvas: HTMLCanvasElement, art: Artwork) {
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = art.background;
  ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
  ctx.fillStyle = art.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const setFont = (pixels: number) => {
    ctx.font = `${art.weight} ${pixels}px ${art.font}`;
  };

  // Break the text into lines that fit, then shrink the lot if it is still too big.
  setFont(art.pixels);
  const lines = art.lines.flatMap((paragraph) => {
    const wrapped: string[] = [];
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > SAFE_WIDTH) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    return current ? [...wrapped, current] : wrapped;
  });
  if (lines.length === 0) return;

  const lineHeight = 1.15;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const tallest = lines.length * art.pixels * lineHeight;
  const pixels = art.pixels * Math.min(1, SAFE_WIDTH / widest, SAFE_HEIGHT / tallest);
  setFont(pixels);
  lines.forEach((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * pixels * lineHeight;
    ctx.fillText(line, OUT_SIZE / 2, OUT_SIZE / 2 + offset);
  });
}

export function IdeasPanel({ open, onCancel, onPick }: IdeasPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tab, setTab] = useState<Tab>("emoji");
  const [emoji, setEmoji] = useState("🌻");
  const [emojiBackground, setEmojiBackground] = useState("#f2b705");
  const [text, setText] = useState("Hello!");
  const [font, setFont] = useState<FontId>("serif");
  const [size, setSize] = useState<SizeId>("medium");
  const [color, setColor] = useState("#ffffff");
  const [textBackground, setTextBackground] = useState("#8c2f2a");
  const [catBusy, setCatBusy] = useState(false);

  const chosenFont = FONTS.find((option) => option.id === font)!;
  const artwork: Artwork | null =
    tab === "emoji"
      ? {
          background: emojiBackground,
          lines: [emoji],
          color: "#000000",
          font: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          weight: 400,
          pixels: 460,
        }
      : tab === "text"
        ? {
            background: textBackground,
            lines: text.split("\n"),
            color,
            font: chosenFont.family,
            weight: chosenFont.weight,
            pixels: SIZES.find((option) => option.id === size)!.pixels,
          }
        : null;
  const artworkKey = JSON.stringify(artwork);

  useEffect(() => {
    if (!open || !artwork) return;
    let cancelled = false;
    const draw = () => {
      // The dialog mounts its content a moment after opening.
      if (!cancelled && canvasRef.current) drawArtwork(canvasRef.current, artwork);
    };
    const frame = requestAnimationFrame(draw);
    // Web fonts may not be ready the first time they are asked for.
    void document.fonts.load(`${artwork.weight} 100px ${artwork.font}`).then(draw, () => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // `artworkKey` stands in for the artwork object, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artworkKey]);

  async function fetchCat() {
    if (catBusy) return;
    setCatBusy(true);
    try {
      const res = await fetch(
        `https://cataas.com/cat?width=900&height=900&t=${Date.now()}-${Math.random()}`,
      );
      if (!res.ok) throw new Error(`cataas ${res.status}`);
      onPick(await blobToDataUrl(await res.blob()));
    } catch (err) {
      console.error("[cats] fetch failed", err);
      toast.error("Couldn't reach the cat archive. Try again in a moment.");
    } finally {
      setCatBusy(false);
    }
  }

  const hasArtwork = tab === "emoji" ? emoji.trim() !== "" : text.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Need an idea?</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="cat">Random cat</TabsTrigger>
          </TabsList>

          <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_168px]">
            <div className="min-h-[15rem]">
              <TabsContent value="emoji" className="mt-0 flex flex-col gap-4">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setEmoji(option)}
                      aria-label={`Use ${option}`}
                      aria-pressed={emoji === option}
                      className={`grid aspect-square place-items-center rounded-sm border text-xl transition-colors ${
                        emoji === option
                          ? "border-[var(--color-oxblood)] bg-[var(--color-paper-deep)]"
                          : "border-transparent hover:border-[var(--color-hairline)]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
                  <span className="shrink-0">Or type your own</span>
                  <Input
                    value={emoji}
                    onChange={(event) => setEmoji(event.target.value)}
                    maxLength={8}
                    className="w-24 text-center"
                  />
                </label>
                <Swatches
                  label="Background"
                  value={emojiBackground}
                  onChange={setEmojiBackground}
                />
              </TabsContent>

              <TabsContent value="text" className="mt-0 flex flex-col gap-4">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={2}
                  maxLength={80}
                  placeholder="A word or two"
                  aria-label="Text for this face"
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Choices
                  label="Font"
                  options={FONTS}
                  value={font}
                  onChange={setFont}
                  style={(option) => ({ fontFamily: option.family, fontWeight: option.weight })}
                />
                <Choices label="Size" options={SIZES} value={size} onChange={setSize} />
                <Swatches label="Color" value={color} onChange={setColor} />
                <Swatches label="Background" value={textBackground} onChange={setTextBackground} />
              </TabsContent>

              <TabsContent value="cat" className="mt-0 flex flex-col items-start gap-4">
                <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  Fetch a random cat photo from cataas.com. You can zoom, move and rotate it before
                  it goes on the face.
                </p>
                <Button variant="outline" onClick={fetchCat} disabled={catBusy}>
                  {catBusy ? <Loader2 className="animate-spin" /> : <Cat />}
                  {catBusy ? "Finding a cat…" : "Find me a cat"}
                </Button>
              </TabsContent>
            </div>

            {artwork && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-full max-w-[168px]" style={{ aspectRatio: "0.8660254 / 1" }}>
                  <canvas
                    ref={canvasRef}
                    width={OUT_SIZE}
                    height={OUT_SIZE}
                    aria-label="Preview of this face"
                    className="h-full w-full object-cover"
                    style={{ clipPath: HEXAGON }}
                  />
                </div>
              </div>
            )}
          </div>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {artwork && (
            <Button
              disabled={!hasArtwork}
              onClick={() => {
                if (canvasRef.current) onPick(canvasRef.current.toDataURL("image/png"));
              }}
              className="bg-[var(--color-oxblood)] text-[var(--color-paper)] hover:bg-[var(--color-oxblood)]/90"
            >
              Use this
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Swatches({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-[var(--color-ink-soft)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-label={`${label} ${option}`}
            aria-pressed={value === option}
            className={`h-6 w-6 rounded-full border transition-shadow ${
              value === option
                ? "border-[var(--color-oxblood)] ring-2 ring-[var(--color-oxblood)] ring-offset-2 ring-offset-[var(--color-card)]"
                : "border-[var(--color-hairline)]"
            }`}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}

function Choices<Option extends { id: string; label: string }>({
  label,
  options,
  value,
  onChange,
  style,
}: {
  label: string;
  options: Option[];
  value: Option["id"];
  onChange: (id: Option["id"]) => void;
  style?: (option: Option) => React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-[var(--color-ink-soft)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            style={style?.(option)}
            className={`rounded-sm border px-2.5 py-1 text-sm transition-colors ${
              value === option.id
                ? "border-[var(--color-oxblood)] bg-[var(--color-paper-deep)] text-[var(--color-oxblood)]"
                : "border-[var(--color-hairline)] hover:border-[var(--color-ink-soft)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
