import { drawQR, studioPiqueQrColors } from "../qr";
import { themeColor, themeRgba } from "../theme-colors";

/**
 * Dormant PDF element: the QR code, support message, and Studio Pique credit
 * intentionally live together so the unit can be restored without reconstructing
 * the design from scattered comments or an old commit.
 */
export async function drawStudioPiqueSupportCard(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  maxW: number,
  maxH: number,
  dpi: number,
) {
  const cardW = Math.min(maxW, maxH * 5.8);
  const cardH = maxH;
  const x = centerX - cardW / 2;
  const y = topY;
  const pad = Math.max(0.08 * dpi, cardH * 0.08);
  const qrSize = Math.max(0, cardH - 2 * pad);
  const textX = x + pad + qrSize + pad * 0.9;
  const textW = Math.max(0, cardW - (textX - x) - pad);

  ctx.save();
  ctx.fillStyle = themeColor("white");
  ctx.strokeStyle = themeRgba("studio-ink", 0.18);
  ctx.lineWidth = Math.max(1, dpi / 450);
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, Math.min(0.12 * dpi, cardH * 0.18));
  ctx.fill();
  ctx.stroke();

  const qrColors = studioPiqueQrColors();
  await drawQR(ctx, "studiopique", "venmo", {
    x: x + pad,
    y: y + pad,
    size: qrSize,
    sizePx: Math.ceil(qrSize),
    note: "Studio Pique flexagon",
    darkColor: qrColors.ink,
    lightColor: qrColors.paper,
  });

  ctx.fillStyle = themeRgba("studio-ink", 0.78);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.min(0.2 * dpi, cardH * 0.2)}px "Inter Tight", system-ui, sans-serif`;
  ctx.fillText("Please help support creative code,", textX, y + 0.4 * cardH, textW);
  ctx.fillText("and have fun!", textX, y + 0.6 * cardH, textW);

  ctx.textAlign = "right";
  ctx.font = `600 ${Math.min(0.44 * dpi, cardH * 0.44)}px "Fraunces", Georgia, serif`;
  ctx.fillText("Studio Pique", cardW, y + cardH * 0.5, textW);
  ctx.restore();
}
