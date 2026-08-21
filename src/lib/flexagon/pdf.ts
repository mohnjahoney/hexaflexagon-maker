import { jsPDF } from "jspdf";
import { renderSheets, type FaceImages, type PrintLayout } from "./render";

export type PdfBuildStage = "rendering-strip" | "assembling-pages" | "encoding-file";

export interface BuiltPdf {
  blob: Blob;
  url: string; // object URL — caller must revoke when done
  dataUrl: string; // portable fallback for sandboxed preview/new-window handoff
  filename: string;
  sizeBytes: number;
  layout: PrintLayout;
  previews: string[]; // one data URL per page (downscaled)
}

export interface BuildOptions {
  layout?: PrintLayout;
  dpi?: number;
  filename?: string;
}

/**
 * Build the trihexaflexagon PDF.
 *
 * The Lovable preview iframe sometimes blocks `pdf.save()` (synthetic
 * anchor-click inside a sandboxed frame). We return both a Blob and an
 * object URL so the caller can attach the URL to a real <a download>
 * element — which the browser treats as a user-initiated download and lets
 * through reliably.
 */
export async function buildFlexagonPdf(
  faces: FaceImages,
  opts: BuildOptions = {},
  onStage?: (stage: PdfBuildStage) => void,
): Promise<BuiltPdf> {
  const layout: PrintLayout = opts.layout ?? "single-sided";
  // const layout: PrintLayout = opts.layout ?? "double-sided";
  const dpi = opts.dpi ?? 600;
  const filename = opts.filename ?? `hexaflexagon-${layout}.pdf`;

  onStage?.("rendering-strip");
  const { pages, previews } = await renderSheets(faces, { layout, dpi });

  onStage?.("assembling-pages");
  const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: "letter" });
  const W = 11,
    H = 8.5;

  pages.forEach((canvas, i) => {
    if (i > 0) pdf.addPage("letter", "landscape");
    // High-quality JPEG keeps the file size sane while preserving photo detail.
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, W, H, undefined, "FAST");
  });

  onStage?.("encoding-file");
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const dataUrl = pdf.output("datauristring");

  return {
    blob,
    url,
    dataUrl,
    filename,
    sizeBytes: blob.size,
    layout,
    previews: previews.map((c) => c.toDataURL("image/jpeg", 0.82)),
  };
}
