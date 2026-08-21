import { renderSheets, type FaceImages } from "../render";

const DPI = 144;
const SQRT3 = Math.sqrt(3);

export interface StripAssets {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  double: HTMLCanvasElement;
}

/**
 * Prepare the printable strip views used by the interactive animation.
 * Printed instruction-page generation intentionally does not live here.
 */
export async function renderStripAssets(faces: FaceImages): Promise<StripAssets> {
  const [doubleSided, singleSided] = await Promise.all([
    renderSheets(faces, { layout: "double-sided", dpi: DPI }),
    renderSheets(faces, { layout: "single-sided", dpi: DPI }),
  ]);

  const pageW = 11 * DPI;
  const pageH = 8.5 * DPI;
  const margin = 0.5 * DPI;
  const s = (pageW - 2 * margin) / 5.5;
  const stripW = 5.5 * s;
  const stripH = (s * SQRT3) / 2;
  const x = (pageW - stripW) / 2;
  const y = (pageH - stripH) / 2;
  const doubleY = (pageH - 2 * stripH) / 2;

  return {
    front: cropCanvas(doubleSided.pages[0], x, y, stripW, stripH),
    back: cropCanvas(doubleSided.pages[1], x, y, stripW, stripH),
    double: cropCanvas(singleSided.pages[0], x, doubleY, stripW, stripH * 2),
  };
}

function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  canvas
    .getContext("2d")!
    .drawImage(
      source,
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
      0,
      0,
      canvas.width,
      canvas.height,
    );
  return canvas;
}
