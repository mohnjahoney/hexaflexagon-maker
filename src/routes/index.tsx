import { useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacePicker } from "@/components/flexagon/FacePicker";
import { FlexagonPreview } from "@/components/flexagon/FlexagonPreview";
import { TriangleArrayPanel } from "@/components/flexagon/TriangleArrayPanel";
import { buildFlexagonPdf } from "@/lib/flexagon/pdf";
import type { PrintLayout } from "@/lib/flexagon/render";
import { toast } from "sonner";
// import volleyballBall from "@/assets/volleyball-ball.png";
// import volleyballBump from "@/assets/volleyball-bump.png";
// import volleyballSpike from "@/assets/volleyball-spike.png";
import sunflower_5 from "@/assets/sunflower_5.png";
import sunflower_7 from "@/assets/sunflower_7.png";
import sunflower_8 from "@/assets/sunflower_8.png";
import { TRIANGLE_DEBUG } from "@/lib/flexagon/debug";
import { HashLink } from "@/components/HashLink";

export function Home() {
  const [face1, setFace1] = useState<string | null>(sunflower_5);
  const [face2, setFace2] = useState<string | null>(sunflower_7);
  const [face3, setFace3] = useState<string | null>(sunflower_8);
  const [layout, setLayout] = useState<PrintLayout>("single-sided");
  // const [layout, setLayout] = useState<PrintLayout>("double-sided");
  const [busy, setBusy] = useState(false);

  const faces = useMemo(() => ({ face1, face2, face3 }), [face1, face2, face3]);

  async function exportPdf(action: "download" | "open") {
    if (busy) return;
    const opened = action === "open" ? window.open("", "_blank") : null;
    if (action === "open" && !opened) {
      toast.error("The browser blocked the new tab. Try Download PDF instead.");
      return;
    }

    setBusy(true);
    try {
      const built = await buildFlexagonPdf(faces, { layout });
      if (action === "open" && opened) {
        opened.location.replace(built.url);
      } else {
        const link = document.createElement("a");
        link.href = built.url;
        link.download = built.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(built.url), 30_000);
    } catch (err) {
      opened?.close();
      console.error("[flexagon] PDF generation failed:", err);
      toast.error("Sorry — the PDF could not be generated. Check the console for details.");
    } finally {
      setBusy(false);
    }
  }

  function openAnimation() {
    try {
      sessionStorage.setItem("flexagon-animation-faces", JSON.stringify(faces));
    } catch (err) {
      console.warn("[flexagon] Could not copy custom faces to the animation tab:", err);
    }
    window.open(`${window.location.pathname}#/animation`, "_blank");
  }

  return (
    <main className="min-h-screen">
      <Header />

      <section className="mx-auto max-w-6xl px-6 pt-10 md:pt-16">
        <p className="label-eyebrow">A small paper-toy maker · est. today</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
          Design your own hexaflexagon.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-ink-soft)]">
          Upload three images, arrange them, and print a paper toy that folds through its center. At
          first it appears to have two sides, but watch how a third side can be revealed.
        </p>
      </section>

      <section className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 px-6 md:grid-cols-3">
        <FacePicker numeral="I" value={face1} onChange={setFace1} />
        <FacePicker numeral="II" value={face2} onChange={setFace2} />
        <FacePicker numeral="III" value={face3} onChange={setFace3} />
      </section>

      {TRIANGLE_DEBUG.trianglePanel && <TriangleArrayPanel faces={faces} />}

      <section
        className={`mx-auto mt-16 grid grid-cols-1 items-start gap-8 px-6 pb-24 ${
          TRIANGLE_DEBUG.stripPreview ? "max-w-6xl md:grid-cols-2" : "max-w-3xl"
        }`}
      >
        {TRIANGLE_DEBUG.stripPreview && <FlexagonPreview faces={faces} />}

        <div className="sheet flex flex-col gap-6 p-8">
          <div>
            <span className="label-eyebrow">Time to put it on paper</span>
            <h2 className="mt-2 font-display text-3xl">Print your flexagon</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Choose a print layout, then download your finished flexagon for printing.
            </p>
          </div>

          <LayoutToggle value={layout} onChange={setLayout} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              onClick={openAnimation}
              className="h-12 rounded-sm bg-[var(--color-oxblood)] text-[var(--color-paper)] hover:bg-[var(--color-oxblood)]/90"
            >
              <Play />
              Watch yours fold!
            </Button>
            <Button
              onClick={() => exportPdf("download")}
              disabled={busy}
              variant="outline"
              className="h-12 rounded-sm"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              {busy ? "Preparing PDF…" : "Download PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={() => exportPdf("open")}
              disabled={busy}
              className="h-12 rounded-sm"
            >
              {busy ? <Loader2 className="animate-spin" /> : <ExternalLink />}
              {busy ? "Preparing PDF…" : "Preview in new tab"}
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function LayoutToggle({
  value,
  onChange,
}: {
  value: PrintLayout;
  onChange: (v: PrintLayout) => void;
}) {
  const options: Array<{ id: PrintLayout; title: string; sub: string }> = [
    {
      id: "double-sided",
      title: "Double-sided",
      sub: "Two PDF pages. Print one page in duplex (align long edge). Recommend medium or heavy paper. Makes three flexagons.",
    },
    {
      id: "single-sided",
      title: "Single-sided",
      sub: "One PDF page. Print normally. Recommend light or medium paper. Makes two flexagons.",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-[var(--color-hairline)] pt-5 sm:grid-cols-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-sm border p-3 text-left text-xs leading-relaxed transition-colors ${
              active
                ? "border-[var(--color-oxblood)] bg-[var(--color-paper-deep)]"
                : // ? "border-[var(--color-ink)] bg-[var(--color-paper-deep)]"
                  "border-[var(--color-hairline)] hover:border-[var(--color-ink-soft)]"
            }`}
          >
            <div className={`font-display text-sm ${active ? "text-[var(--color-oxblood)]" : ""}`}>
              {opt.title}
            </div>
            <div className="mt-1 text-[var(--color-ink-soft)]">{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--color-hairline)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HashLink to="/" className="flex items-baseline gap-3">
          <span className="font-display text-xl">Hexaflexagon</span>
          <span className="label-eyebrow">Maker</span>
        </HashLink>
        <nav className="flex items-center gap-6 text-sm text-[var(--color-ink-soft)]">
          <HashLink to="/about" className="hover:text-[var(--color-ink)]">
            About
          </HashLink>
          <HashLink to="/support" className="hover:text-[var(--color-ink)]">
            Support
          </HashLink>
          <HashLink to="/contact" className="hover:text-[var(--color-ink)]">
            Contact
          </HashLink>
          <a
            href="#/how-to-fold"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-ink)]"
          >
            How to fold ↗
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-hairline)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-8 text-xs text-[var(--color-ink-soft)] md:flex-row md:items-center">
        <span>Hand-set in Fraunces &amp; Inter Tight · printed on imagined paper.</span>
        <span className="font-display italic">— a small bindery for paper toys</span>
      </div>
    </footer>
  );
}
