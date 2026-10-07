// The folding instructions, from printout to finished flexagon, written as
// plain data: each step names the hinge angles it ends at. Poses in between,
// stacking order and paper-thickness offsets all follow from that.

import { Matrix4, Vector3 } from "three";
import { settleLayering, type RestState } from "./layering";
import {
  HINGE_COUNT,
  LEAF_COUNT,
  STRIP_HEIGHT,
  backPrintUnfold,
  easeInOut,
  foldSheet,
  hingeBetween,
  smoothstep,
  worldCorners,
  type PaperPose,
} from "./sheet";

export interface FoldStep {
  label: string;
  /** Extra guidance that the animation alone cannot show. */
  note?: string;
  /** Milliseconds to wait before moving, moving, and resting afterwards. */
  lead?: number;
  duration: number;
  hold: number;
  /** Hinge angles this step ends at, keyed by hinge index. Others stay put. */
  fold?: Record<number, number>;
  /** Turn the whole sheet about the vertical axis by this angle. */
  turn?: number;
  /** Fold the single-sided printout's back print to this angle (0 = closed). */
  prepAngle?: number;
}

/** What the camera should keep in view. */
export interface Frame {
  center: Vector3;
  halfWidth: number;
  halfHeight: number;
  /** Camera elevation in radians when the viewer has not dragged; negative looks from below. */
  pitch?: number;
  /**
   * The widest view in the same sequence. When given, the camera only closes
   * half of the way in from that view instead of filling the canvas.
   */
  wide?: { halfWidth: number; halfHeight: number };
}

/** The flat single-sided printout: the widest thing the folding sequence shows. */
export const PRINTOUT_VIEW = { halfWidth: 2.75, halfHeight: STRIP_HEIGHT };

export interface TimelineSample {
  pose: PaperPose;
  frame: Frame;
  step: number;
}

export interface FoldTimeline {
  duration: number;
  steps: { label: string; note?: string; start: number; end: number }[];
  sample: (milliseconds: number) => TimelineSample;
  /** The finished, glued flexagon lying flat. */
  final: RestState;
}

const SINGLE_SIDED_NOTE =
  "For single-sided prints only: fold the wide strip in half along its long centre line and glue the halves together, leaving the end triangles unglued. Double-sided prints are already prepared.";

export const FOLD_STEPS: FoldStep[] = [
  {
    label: "Prepare the strip",
    note: SINGLE_SIDED_NOTE,
    lead: 1200,
    duration: 4200,
    hold: 900,
    prepAngle: 0,
  },
  {
    label: "Fold from the left",
    note: "With the blank side up, fold the left three triangles forward so the third lands on the fourth.",
    duration: 2200,
    hold: 700,
    fold: { [hingeBetween(3, 4)]: -Math.PI },
  },
  {
    label: "Fold from the right",
    note: "Fold the last four triangles behind. You should have a hexagon with one triangle sticking out.",
    duration: 2600,
    hold: 700,
    fold: { [hingeBetween(6, 7)]: Math.PI },
  },
  {
    label: "Lift the front tab",
    note: "The first triangle is lying on top of the rear arm. Lift it out of the way.",
    duration: 1600,
    hold: 300,
    fold: { [hingeBetween(1, 2)]: (2 * Math.PI) / 3 },
  },
  {
    label: "Swing the rear arm up",
    note: "Bring the rear arm up and past vertical so the tab can get underneath it.",
    duration: 1600,
    hold: 300,
    fold: { [hingeBetween(8, 9)]: (2 * Math.PI) / 3 },
  },
  {
    label: "Tuck the tab underneath",
    note: "Lay the first triangle back down flat.",
    duration: 1600,
    hold: 300,
    fold: { [hingeBetween(1, 2)]: 0 },
  },
  {
    label: "Lay the arm on top",
    note: "The rear arm and the front tab have now switched places.",
    duration: 1600,
    hold: 700,
    fold: { [hingeBetween(8, 9)]: 0 },
  },
  {
    label: "Flip it over",
    note: "Turn the whole thing over. Both blank triangles now face you.",
    duration: 2600,
    hold: 700,
    turn: Math.PI,
  },
  {
    label: "Glue the tab",
    note: "Put a little glue on the blank triangle and fold the last triangle onto it. Hold for a minute, then let it dry.",
    duration: 2400,
    hold: 1600,
    fold: { [hingeBetween(9, 10)]: -Math.PI },
  },
];

interface SheetState {
  angles: number[];
  root: Matrix4;
  prepAngle: number;
}

function placeLeaves(state: SheetState): Matrix4[] {
  const leaves = foldSheet(state.angles, state.root);
  if (state.prepAngle === 0) return leaves;
  // While the printout is being folded in half the back print stays where it
  // is and the front print swings round behind it.
  const frontSwing = backPrintUnfold(state.prepAngle).invert();
  return leaves.map((leaf) => leaf.multiply(frontSwing));
}

export function poseFrame(pose: Pick<PaperPose, "leaves" | "prepAngle">): Frame {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const backPrint = backPrintUnfold(pose.prepAngle);
  for (let leaf = 0; leaf < LEAF_COUNT; leaf += 1) {
    const sheets = [pose.leaves[leaf], pose.leaves[leaf].clone().multiply(backPrint)];
    sheets.forEach((sheet) =>
      worldCorners(sheet, leaf).forEach((corner) => {
        min.min(corner);
        max.max(corner);
      }),
    );
  }
  return {
    center: min.clone().add(max).multiplyScalar(0.5),
    halfWidth: (max.x - min.x) / 2,
    halfHeight: (max.y - min.y) / 2,
  };
}

function mixFrames(from: Frame, to: Frame, amount: number): Frame {
  return {
    center: from.center.clone().lerp(to.center, amount),
    halfWidth: from.halfWidth + (to.halfWidth - from.halfWidth) * amount,
    halfHeight: from.halfHeight + (to.halfHeight - from.halfHeight) * amount,
  };
}

export function buildFoldTimeline(steps: readonly FoldStep[] = FOLD_STEPS): FoldTimeline {
  // Start as the flat single-sided printout, printed side up, positioned so
  // that closing it leaves the strip blank side up.
  let state: SheetState = {
    angles: new Array<number>(HINGE_COUNT).fill(0),
    root: new Matrix4().makeRotationX(Math.PI),
    prepAngle: Math.PI,
  };
  let rest: RestState = {
    leaves: placeLeaves(state),
    layering: settleLayering(placeLeaves(state)),
  };
  let clock = 0;

  const segments = steps.map((step) => {
    const from = state;
    const fromRest = rest;
    const fromFrame = poseFrame({ leaves: fromRest.leaves, prepAngle: from.prepAngle });
    const pivot = fromFrame.center;
    const to: SheetState = {
      angles: from.angles.map((angle, hinge) => step.fold?.[hinge] ?? angle),
      root: new Matrix4(),
      prepAngle: step.prepAngle ?? from.prepAngle,
    };

    const stateAt = (amount: number): SheetState => {
      const turn = new Matrix4()
        .makeTranslation(pivot.x, pivot.y, pivot.z)
        .multiply(new Matrix4().makeRotationY((step.turn ?? 0) * amount))
        .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
      return {
        angles: from.angles.map((angle, hinge) => angle + (to.angles[hinge] - angle) * amount),
        root: turn.multiply(from.root),
        prepAngle: from.prepAngle + (to.prepAngle - from.prepAngle) * amount,
      };
    };

    to.root = stateAt(1).root;
    const leaves = placeLeaves(to);
    const toRest: RestState = {
      leaves,
      layering: settleLayering(leaves, fromRest, placeLeaves(stateAt(0.98))),
    };
    const toFrame = poseFrame({ leaves, prepAngle: to.prepAngle });

    const start = clock;
    const moveStart = start + (step.lead ?? 0);
    const end = moveStart + step.duration + step.hold;
    clock = end;
    state = to;
    rest = toRest;

    const sample = (milliseconds: number): Omit<TimelineSample, "step"> => {
      const amount = easeInOut((milliseconds - moveStart) / step.duration);
      const current = stateAt(amount);
      // Paper shuffles into its new layers mid-move: after it has lifted
      // clear of where it was and before it lands where it is going.
      const settle = smoothstep(0.15, 0.6, amount);
      return {
        pose: {
          leaves: placeLeaves(current),
          offsets: fromRest.layering.offsets.map(
            (offset, leaf) => offset + (toRest.layering.offsets[leaf] - offset) * settle,
          ),
          prepAngle: current.prepAngle,
        },
        frame: { ...mixFrames(fromFrame, toFrame, amount), wide: PRINTOUT_VIEW },
      };
    };
    return { label: step.label, note: step.note, start, end, sample };
  });

  return {
    duration: clock,
    steps: segments.map(({ label, note, start, end }) => ({ label, note, start, end })),
    sample(milliseconds) {
      const time = Math.min(Math.max(milliseconds, 0), clock);
      const found = segments.findIndex((segment) => time < segment.end);
      const step = found < 0 ? segments.length - 1 : found;
      return { ...segments[step].sample(time), step };
    },
    final: rest,
  };
}
