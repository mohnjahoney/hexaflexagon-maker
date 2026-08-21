/**
 * Normalized pointy-top hexagon used by the captured 1024×1024 image mask.
 * The hexagon is inscribed in the square: its height is 100% and its width is
 * sqrt(3) / 2 of the square, matching the crop pipeline in HexCropper.
 */
export const HEXAGON_OUTPUT_POINTS = "50,0 93.3013,25 93.3013,75 50,100 6.6987,75 6.6987,25";

export const HEXAGON_OUTPUT_PATH = "M50,0 L93.3013,25 L93.3013,75 L50,100 L6.6987,75 L6.6987,25 Z";

export const HEXAGON_CLIP_PATH =
  "polygon(50% 0%, 93.3013% 25%, 93.3013% 75%, 50% 100%, 6.6987% 75%, 6.6987% 25%)";
