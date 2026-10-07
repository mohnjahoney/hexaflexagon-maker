// The finished toy: a flat hexagon of six stacks ("sectors") around a centre,
// and the pinch flex that turns it inside out to show the next face.
//
// One flex has two halves. First the hexagon closes like a tent: the centre
// rises towards the viewer and every other corner swings away until three
// corners meet behind it, leaving three fins, each two sectors pressed
// together. Then the fins are split differently and the tent opens again from
// its old centre, like a flower, around the point where the corners met.
//
// Sectors are numbered anticlockwise seen from the viewer. Sector k lies
// between hexagon corners k and k + 1, and crease k is the radial fold from
// the centre to corner k.

import { Matrix4, Vector3 } from "three";
import { STRIP_CONFIG } from "../strip-config";
import type { FaceId } from "../geometry";
import type { RestState } from "./layering";
import {
  HINGE_COUNT,
  LEAF_COUNT,
  centroid,
  frontNormal,
  materialCorners,
  smoothstep,
  worldCorners,
  type PaperPose,
} from "./sheet";

export interface HexState {
  center: Vector3;
  /** Towards corner 0, and towards the viewer. */
  ex: Vector3;
  ez: Vector3;
  /** Leaves in each sector, from the far side to the viewer's side. */
  sectors: number[][];
  /** For each leaf, which material corner sits at [centre, corner k, corner k + 1]. */
  roles: [number, number, number][];
  /** Pairs of leaves glued face to face; they always travel as one ply. */
  glued: [number, number][];
}

type FlatPose = Pick<PaperPose, "leaves" | "offsets">;

const mod6 = (value: number) => ((value % 6) + 6) % 6;

function isGlued(state: HexState, first: number, second: number) {
  return state.glued.some(
    ([a, b]) => (a === first && b === second) || (a === second && b === first),
  );
}

/** Read the hexagon out of a flat, finished pose. */
export function hexStateFromRest(
  rest: RestState,
  ez: Vector3,
  glued: [number, number][],
): HexState {
  const corners = rest.leaves.map((matrix, leaf) => worldCorners(matrix, leaf));
  const center = corners[0].find((candidate) =>
    corners.every((others) => others.some((corner) => corner.distanceTo(candidate) < 1e-6)),
  );
  if (!center) throw new Error("The folded sheet does not close up around a single centre.");
  const rim = corners[0].find((corner) => corner.distanceTo(center) > 1e-6)!;
  const ex = rim.clone().sub(center).normalize();
  const ey = ez.clone().cross(ex);

  const cornerIndex = (point: Vector3) => {
    const arm = point.clone().sub(center);
    return mod6(Math.round(Math.atan2(arm.dot(ey), arm.dot(ex)) / (Math.PI / 3)));
  };

  const sectorOf = new Array<number>(LEAF_COUNT);
  const roles = corners.map((leafCorners, leaf) => {
    const atCenter = leafCorners.findIndex((corner) => corner.distanceTo(center) < 1e-6);
    const others = [0, 1, 2].filter((index) => index !== atCenter);
    const [first, second] = others.map((index) => cornerIndex(leafCorners[index]));
    const firstIsLow = mod6(second - first) === 1;
    sectorOf[leaf] = firstIsLow ? first : second;
    return (firstIsLow ? [atCenter, others[0], others[1]] : [atCenter, others[1], others[0]]) as [
      number,
      number,
      number,
    ];
  });

  const sectors: number[][] = Array.from({ length: 6 }, () => []);
  for (const stack of rest.layering.stacks) {
    const ordered = stack.direction.dot(ez) > 0 ? stack.leaves : [...stack.leaves].reverse();
    sectors[sectorOf[ordered[0]]] = [...ordered];
  }
  return { center: center.clone(), ex, ez: ez.clone(), sectors, roles, glued };
}

/**
 * Which creases swing back to the axis when the hexagon closes towards the
 * viewer: 0 if the even-numbered ones do, 1 if the odd ones do.
 *
 * Each fin folds its two sectors far-side to far-side, so the strip has to
 * cross a fin's crease between the two leaves that end up touching. Those
 * creases alternate with the ones that go to the axis.
 */
function axisParity(state: HexState): 0 | 1 {
  const sectorOf = new Map<number, number>();
  state.sectors.forEach((leaves, sector) => leaves.forEach((leaf) => sectorOf.set(leaf, sector)));
  const reachesFarSide = (leaf: number) => {
    const below = state.sectors[sectorOf.get(leaf)!];
    return below.slice(0, below.indexOf(leaf)).every((other) => isGlued(state, other, leaf));
  };

  const finCreases: number[] = [];
  for (let hinge = 0; hinge < HINGE_COUNT; hinge += 1) {
    const [a, b] = [sectorOf.get(hinge)!, sectorOf.get(hinge + 1)!];
    if (a === b) continue;
    const crease = mod6(b - a) === 1 ? b : a;
    if (reachesFarSide(hinge) && reachesFarSide(hinge + 1)) finCreases.push(crease);
  }
  const parity = finCreases[0] % 2;
  if (finCreases.length !== 3 || finCreases.some((crease) => crease % 2 !== parity)) {
    throw new Error("This hexagon is not folded in a way that can flex.");
  }
  return parity === 0 ? 1 : 0;
}

/**
 * Pose the six sectors as a cone around the centre. Creases of the given
 * parity make `axisAngle` with the cone's axis and the others follow so that
 * every sector stays a rigid equilateral triangle. A right angle is the flat
 * hexagon; zero is fully closed into three fins.
 *
 * `towards` is -1 for a tent (closing away from the viewer) and +1 for a bowl.
 * `finned` blends the paper-thickness offsets from six separate stacks to
 * three fin-wide stacks.
 */
function conePose(
  state: HexState,
  parity: 0 | 1,
  towards: -1 | 1,
  axisAngle: number,
  finned: number,
): FlatPose {
  const radius = Math.hypot(Math.cos(axisAngle), Math.sin(axisAngle) / 2);
  const otherAngle =
    Math.atan2(Math.sin(axisAngle) / 2, Math.cos(axisAngle)) +
    Math.acos(Math.min(1, 1 / (2 * radius)));
  const ey = state.ez.clone().cross(state.ex);
  const creases = Array.from({ length: 6 }, (_, k) => {
    const polar = k % 2 === parity ? axisAngle : otherAngle;
    const azimuth = (k * Math.PI) / 3;
    return new Vector3()
      .addScaledVector(state.ex, Math.sin(polar) * Math.cos(azimuth))
      .addScaledVector(ey, Math.sin(polar) * Math.sin(azimuth))
      .addScaledVector(state.ez, Math.cos(polar) * towards);
  });

  const leaves: Matrix4[] = new Array(LEAF_COUNT);
  const offsets = new Array<number>(LEAF_COUNT).fill(0);
  state.sectors.forEach((stack, sector) => {
    const low = creases[sector];
    const high = creases[mod6(sector + 1)];
    const up = low.clone().cross(high).normalize();
    const world = new Matrix4().makeBasis(low, high, up).setPosition(state.center);

    // Height of each leaf above the sector's ideal plane, flat and in a fin.
    const isLeftOfFin = mod6(sector + 1) % 2 !== parity;
    const partner = state.sectors[mod6(sector + (isLeftOfFin ? 1 : -1))];
    const [left, right] = isLeftOfFin ? [stack, partner] : [partner, stack];
    const fin =
      towards < 0 ? [...[...left].reverse(), ...right] : [...left, ...[...right].reverse()];
    const upAlongFin = (isLeftOfFin ? 1 : -1) * towards;

    stack.forEach((leaf, index) => {
      const [atCenter, atLow, atHigh] = state.roles[leaf].map(
        (corner) => materialCorners(leaf)[corner],
      );
      const edgeLow = atLow.clone().sub(atCenter);
      const edgeHigh = atHigh.clone().sub(atCenter);
      const material = new Matrix4()
        .makeBasis(edgeLow, edgeHigh, edgeLow.clone().cross(edgeHigh).normalize())
        .setPosition(atCenter);
      leaves[leaf] = world.clone().multiply(material.invert());

      const flatHeight = index - (stack.length - 1) / 2;
      const finHeight = (fin.indexOf(leaf) - (fin.length - 1) / 2) * upAlongFin;
      const height = flatHeight + (finHeight - flatHeight) * finned;
      offsets[leaf] = height * Math.sign(frontNormal(leaves[leaf]).dot(up));
    });
  });
  return { leaves, offsets };
}

/** The same closed fins, regrouped into the sectors they will open out as. */
function regroupFins(state: HexState, parity: 0 | 1): HexState {
  const sectors: number[][] = Array.from({ length: 6 }, () => []);
  const roles = state.roles.map((role) => [...role]) as HexState["roles"];

  for (let crease = 1 - parity; crease < 6; crease += 2) {
    const leftSector = mod6(crease - 1);
    const left = state.sectors[leftSector];
    const right = state.sectors[crease];
    const fin = [...[...left].reverse(), ...right];
    const gaps = fin
      .map((_, index) => index)
      .filter((index) => index > 0 && !isGlued(state, fin[index - 1], fin[index]));
    const split = gaps.find((gap) => gap !== left.length);
    if (gaps.length !== 2 || split === undefined) {
      throw new Error("A fin can only open if it is three plies thick.");
    }

    sectors[leftSector] = fin.slice(0, split);
    sectors[crease] = fin.slice(split).reverse();
    for (const leaf of fin) {
      const [atOldCenter, low, high] = state.roles[leaf];
      const [atAxis, atFinTip] = left.includes(leaf) ? [low, high] : [high, low];
      roles[leaf] = sectors[leftSector].includes(leaf)
        ? [atAxis, atOldCenter, atFinTip]
        : [atAxis, atFinTip, atOldCenter];
    }
  }
  return {
    ...state,
    center: state.center.clone().sub(state.ez),
    sectors,
    roles,
  };
}

export interface Flex {
  /** Pose at `progress` from 0 (flat, old face up) to 1 (flat, new face up). */
  poseAt: (progress: number) => FlatPose;
  next: HexState;
}

export function flex(state: HexState): Flex {
  const parity = axisParity(state);
  const next = regroupFins(state, parity);
  return {
    next,
    poseAt(progress) {
      if (progress < 0.5) {
        const closing = progress * 2;
        return conePose(
          state,
          parity,
          -1,
          (Math.PI / 2) * (1 - closing),
          smoothstep(0, 0.8, closing),
        );
      }
      const opening = progress * 2 - 1;
      return conePose(next, parity, 1, (Math.PI / 2) * opening, 1 - smoothstep(0.2, 1, opening));
    },
  };
}

export function flatPose(state: HexState): FlatPose {
  return conePose(state, 0, 1, Math.PI / 2, 0);
}

/** The picture facing the viewer, or null if the six sectors disagree. */
export function faceShowing(state: HexState): FaceId | null {
  const { leaves } = flatPose(state);
  const faces = state.sectors.map((stack) => {
    const top = stack[stack.length - 1];
    const side = frontNormal(leaves[top]).dot(state.ez) > 0 ? "front" : "back";
    const slot = STRIP_CONFIG[side][top];
    return slot.kind === "image" ? slot.face : null;
  });
  return faces.every((face) => face === faces[0]) ? faces[0] : null;
}

export function poseCentroid(leaves: Matrix4[]): Vector3 {
  const sum = new Vector3();
  leaves.forEach((matrix, leaf) => sum.add(centroid(worldCorners(matrix, leaf))));
  return sum.divideScalar(LEAF_COUNT);
}
