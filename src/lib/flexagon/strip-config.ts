import type { FaceId } from "./geometry";

export type TriangleNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type TriangleRotation = 0 | 120 | 240;

export interface ImageStripSlot {
  kind: "image";
  face: FaceId;
  triangle: TriangleNumber;
  rotation: TriangleRotation;
}

export interface BlankStripSlot {
  kind: "blank";
  text?: string;
}

export type StripSlot = ImageStripSlot | BlankStripSlot;

export type TenStripSlots = readonly [
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
  StripSlot,
];

export interface StripConfiguration {
  front: TenStripSlots;
  back: TenStripSlots;
}

const image = (
  face: FaceId,
  triangle: TriangleNumber,
  rotation: TriangleRotation = 0,
): ImageStripSlot => ({ kind: "image", face, triangle, rotation });

const blank = (text = "GLUE"): BlankStripSlot => ({ kind: "blank", text });

/**
 * One logical two-sided strip. Slot indexes run from left to right before the
 * renderer applies back-side mirroring or a single-sided page arrangement.
 *
 * This is an initial complete mapping for visual refinement, not yet a
 * physically verified flexagon permutation.
 */
export const STRIP_CONFIG = {
  front: [
    image(3, 4, 0),
    image(1, 3, 120),
    image(1, 4, 0),
    image(2, 1, 120),
    image(2, 2, 0),
    image(3, 1, 120),
    image(3, 2, 0),
    image(1, 1, 120),
    image(1, 2, 0),
    image(2, 5, 120),
  ],
  back: [
    blank(),
    image(2, 6, 0),
    image(3, 5, 120),
    image(3, 6, 0),
    image(1, 5, 120),
    image(1, 6, 0),
    image(2, 3, 120),
    image(2, 4, 0),
    image(3, 3, 120),
    blank(),
  ],
} satisfies StripConfiguration;

export function validateStripConfiguration(config: StripConfiguration): string[] {
  const errors: string[] = [];
  const allSlots: StripSlot[] = [...config.front, ...config.back];
  const blanks = allSlots.filter((slot) => slot.kind === "blank");
  const counts = new Map<string, number>();

  if (config.front.length !== 10)
    errors.push(`Front has ${config.front.length} slots; expected 10.`);
  if (config.back.length !== 10) errors.push(`Back has ${config.back.length} slots; expected 10.`);
  if (blanks.length !== 2)
    errors.push(`Configuration has ${blanks.length} blank slots; expected 2.`);

  for (const slot of allSlots) {
    if (slot.kind !== "image") continue;
    if (![1, 2, 3].includes(slot.face)) errors.push(`Invalid face ${slot.face}.`);
    if (![1, 2, 3, 4, 5, 6].includes(slot.triangle)) {
      errors.push(`Invalid triangle ${slot.triangle} on face ${slot.face}.`);
    }
    if (![0, 120, 240].includes(slot.rotation)) {
      errors.push(`Invalid rotation ${slot.rotation} on ${slot.face}-${slot.triangle}.`);
    }
    const key = `${slot.face}-${slot.triangle}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const face of [1, 2, 3] as const) {
    for (const triangle of [1, 2, 3, 4, 5, 6] as const) {
      const key = `${face}-${triangle}`;
      const count = counts.get(key) ?? 0;
      if (count === 0) errors.push(`Missing image triangle ${key}.`);
      if (count > 1) errors.push(`Image triangle ${key} appears ${count} times.`);
    }
  }

  return errors;
}

const configurationErrors = validateStripConfiguration(STRIP_CONFIG);
if (configurationErrors.length > 0) {
  throw new Error(`Invalid strip configuration:\n${configurationErrors.join("\n")}`);
}
