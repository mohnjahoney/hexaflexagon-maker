// The paper itself: ten rigid triangular leaves joined edge to edge by nine
// hinges. Everything here is ideal, zero-thickness origami. Thickness is added
// afterwards as a per-leaf offset along the leaf's own normal (see layering.ts).
//
// Leaves and hinges are indexed from zero: leaf 0 is the printed triangle 1,
// and hinge h joins leaf h to leaf h + 1.
//
// A leaf's "material" frame is the flat printed strip with the front side
// facing +z, x running along the strip and y pointing up the page.

import { Matrix4, Vector3 } from "three";
import { triangleVertices } from "../geometry";

export const LEAF_COUNT = 10;
export const HINGE_COUNT = LEAF_COUNT - 1;
export const STRIP_HEIGHT = Math.sqrt(3) / 2;
/** The leaf that stays put while hinges fold; both arms hang off it. */
export const ROOT_LEAF = 4;

export type Corners = [Vector3, Vector3, Vector3];

/** One snapshot of the whole sheet. */
export interface PaperPose {
  /** Ideal (zero-thickness) material-to-world transform for each leaf. */
  leaves: Matrix4[];
  /** Each leaf's shift along its own front normal, in paper thicknesses. */
  offsets: number[];
  /**
   * How far the back print is still unfolded from behind the front print:
   * PI is the flat single-sided printout, 0 is the finished two-sided strip.
   */
  prepAngle: number;
}

const MATERIAL_CORNERS: Corners[] = Array.from(
  { length: LEAF_COUNT },
  (_, leaf) =>
    triangleVertices(leaf, 1, 0, 0).map((point) => new Vector3(point.x, -point.y, 0)) as Corners,
);

export function materialCorners(leaf: number): Corners {
  return MATERIAL_CORNERS[leaf];
}

export function worldCorners(matrix: Matrix4, leaf: number): Corners {
  return MATERIAL_CORNERS[leaf].map((corner) => corner.clone().applyMatrix4(matrix)) as Corners;
}

export function centroid(corners: Corners): Vector3 {
  return corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3);
}

export function frontNormal(matrix: Matrix4): Vector3 {
  return new Vector3(0, 0, 1).transformDirection(matrix);
}

/** Hinge index for the fold between two neighbouring printed triangle numbers. */
export function hingeBetween(first: number, second: number): number {
  if (Math.abs(first - second) !== 1) {
    throw new Error(`Triangles ${first} and ${second} are not neighbours on the strip.`);
  }
  return Math.min(first, second) - 1;
}

export function rotationAboutLine(point: Vector3, direction: Vector3, angle: number): Matrix4 {
  return new Matrix4()
    .makeTranslation(point.x, point.y, point.z)
    .multiply(new Matrix4().makeRotationAxis(direction, angle))
    .multiply(new Matrix4().makeTranslation(-point.x, -point.y, -point.z));
}

/**
 * Rotation, in material coordinates, that swings `child` about hinge `hinge`.
 * Positive angles are valley folds seen from the front: the two front sides
 * close towards each other.
 */
function hingeRotation(hinge: number, child: number, angle: number): Matrix4 {
  const parent = child === hinge ? hinge + 1 : hinge;
  const shared = MATERIAL_CORNERS[child].filter((corner) =>
    MATERIAL_CORNERS[parent].some((other) => other.distanceTo(corner) < 1e-9),
  );
  const direction = shared[1].clone().sub(shared[0]).normalize();
  const reach = centroid(MATERIAL_CORNERS[child]).sub(shared[0]);
  const lifts = direction.clone().cross(reach).z > 0 ? 1 : -1;
  return rotationAboutLine(shared[0], direction, angle * lifts);
}

/** Forward kinematics: place every leaf given the nine hinge angles. */
export function foldSheet(angles: readonly number[], root: Matrix4): Matrix4[] {
  const leaves: Matrix4[] = new Array(LEAF_COUNT);
  leaves[ROOT_LEAF] = root.clone();
  for (let leaf = ROOT_LEAF + 1; leaf < LEAF_COUNT; leaf += 1) {
    leaves[leaf] = leaves[leaf - 1]
      .clone()
      .multiply(hingeRotation(leaf - 1, leaf, angles[leaf - 1]));
  }
  for (let leaf = ROOT_LEAF - 1; leaf >= 0; leaf -= 1) {
    leaves[leaf] = leaves[leaf + 1].clone().multiply(hingeRotation(leaf, leaf, angles[leaf]));
  }
  return leaves;
}

/**
 * Where the back print sits relative to its leaf while the single-sided
 * printout is still being folded in half along the strip's long edge.
 */
export function backPrintUnfold(prepAngle: number): Matrix4 {
  return rotationAboutLine(new Vector3(0, -STRIP_HEIGHT, 0), new Vector3(1, 0, 0), -prepAngle);
}

export function easeInOut(progress: number) {
  return (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress)))) / 2;
}

export function smoothstep(from: number, to: number, value: number) {
  const x = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return x * x * (3 - 2 * x);
}
