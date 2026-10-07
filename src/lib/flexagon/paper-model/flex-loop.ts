// Playing with the finished toy: three flexes in a row bring the first face
// back, so they make a loop.

import { Matrix4, Vector3 } from "three";
import type { FaceId } from "../geometry";
import { PRINTOUT_VIEW, buildFoldTimeline, type Frame, type TimelineSample } from "./fold-sequence";
import {
  faceShowing,
  flatPose,
  flex,
  hexStateFromRest,
  poseCentroid,
  type HexState,
} from "./hexagon";
import { ROOT_LEAF, easeInOut } from "./sheet";

export interface FlexLoop {
  duration: number;
  steps: { label: string; note?: string; start: number; end: number }[];
  sample: (milliseconds: number) => TimelineSample;
}

export interface FlexLoopOptions {
  /** Milliseconds one flex takes, and how long each face rests before the next. */
  flexMs?: number;
  holdMs?: number;
  /** Fill the canvas with the toy instead of matching the folding sequence's scale. */
  closeUp?: boolean;
}

/** The glued, finished toy as the folding sequence leaves it. */
export function finishedHexagon(): HexState {
  // The first and last printed triangles are the two glued together.
  return hexStateFromRest(buildFoldTimeline().final, new Vector3(0, 0, 1), [[0, 9]]);
}

export function buildFlexLoop(
  start: HexState,
  { flexMs = 3400, holdMs = 1500, closeUp = false }: FlexLoopOptions = {},
): FlexLoop {
  // Seen square on, the half-flexed toy is three fins edge on. Look from lower down.
  const frame: Frame = {
    center: new Vector3(),
    halfWidth: closeUp ? 0.92 : 1.15,
    halfHeight: closeUp ? 0.92 : 1.1,
    pitch: -0.7,
    wide: closeUp ? undefined : PRINTOUT_VIEW,
  };
  const flexes = [flex(start)];
  flexes.push(flex(flexes[0].next));
  flexes.push(flex(flexes[1].next));
  const faces = [start, flexes[0].next, flexes[1].next].map(faceShowing) as (FaceId | null)[];

  // After a full cycle the same face is back but the toy has turned about its
  // axis. Spreading the opposite turn over the cycle makes the loop seamless.
  const home = flatPose(start).leaves[ROOT_LEAF];
  const back = flatPose(flexes[2].next).leaves[ROOT_LEAF];
  const turned = start.ex.clone().transformDirection(back.clone().multiply(home.clone().invert()));
  const cycleTurn = Math.atan2(turned.dot(start.ez.clone().cross(start.ex)), turned.dot(start.ex));

  const segmentMs = holdMs + flexMs;
  const duration = 3 * segmentMs;
  const name = (face: FaceId | null) => (face ? `face ${"I".repeat(face)}` : "the next face");

  return {
    duration,
    steps: flexes.map((_, index) => ({
      label: `Flex from ${name(faces[index])} to ${name(faces[(index + 1) % 3])}`,
      note: "Pinch every other corner back until three of them meet, then open the hexagon from its centre. Drag to look around.",
      start: index * segmentMs,
      end: (index + 1) * segmentMs,
    })),
    sample(milliseconds) {
      const time = ((milliseconds % duration) + duration) % duration;
      const step = Math.min(2, Math.floor(time / segmentMs));
      const progress = Math.max(0, (time - step * segmentMs - holdMs) / flexMs);
      // Ease each half separately so the motion pauses at the three-fin shape.
      const eased =
        progress < 0.5 ? easeInOut(progress * 2) / 2 : 0.5 + easeInOut(progress * 2 - 1) / 2;
      const { leaves, offsets } = flexes[step].poseAt(eased);

      const middle = poseCentroid(leaves);
      const steady = new Matrix4()
        .makeRotationAxis(start.ez, (-cycleTurn * (step + eased)) / 3)
        .multiply(new Matrix4().makeTranslation(-middle.x, -middle.y, -middle.z));
      return {
        pose: {
          leaves: leaves.map((leaf) => steady.clone().multiply(leaf)),
          offsets,
          prepAngle: 0,
        },
        frame,
        step,
      };
    },
  };
}
