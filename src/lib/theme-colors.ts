import "culori/css";
import { converter, formatHex, parse } from "culori/fn";

export type ThemeColorName =
  | "paper"
  | "paper-deep"
  | "paper-muted"
  | "ink"
  | "ink-soft"
  | "ink-strong"
  | "oxblood"
  | "graphite"
  | "hairline"
  | "face-fill-1"
  | "face-fill-2"
  | "face-fill-3"
  | "studio-ink"
  | "white";

type Rgb = [number, number, number];
const toRgb = converter("rgb");

function themeToken(name: ThemeColorName) {
  if (typeof document === "undefined") {
    throw new Error(`Theme color "${name}" can only be resolved in a browser document.`);
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!value) throw new Error(`Theme color "--${name}" is not defined.`);
  return value;
}

function rgbToHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function channelToByte(channel: number | undefined) {
  return Math.round(Math.min(1, Math.max(0, channel ?? 0)) * 255);
}

function parseThemeColor(name: ThemeColorName) {
  const parsed = parse(themeToken(name));
  if (!parsed) throw new Error(`Theme color "--${name}" could not be parsed.`);

  const rgb = toRgb(parsed);
  if (!rgb) throw new Error(`Theme color "--${name}" could not be converted to RGB.`);
  return rgb;
}

export function themeRgb(name: ThemeColorName): Rgb {
  const rgb = parseThemeColor(name);
  return [channelToByte(rgb.r), channelToByte(rgb.g), channelToByte(rgb.b)];
}

export function themeColor(name: ThemeColorName) {
  return formatHex(parseThemeColor(name)) ?? rgbToHex(themeRgb(name));
}

export function themeRgba(name: ThemeColorName, alpha: number) {
  const [r, g, b] = themeRgb(name);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
