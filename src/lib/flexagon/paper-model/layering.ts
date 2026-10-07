// Stacks: which leaves lie on top of one another, and in what order.
//
// Whenever the sheet comes to rest, leaves that share a footprint form a stack.
// A stack is centred on its ideal plane and each leaf in it is shifted along
// its own normal by a whole number of paper thicknesses. The order is never
// written down by hand: leaves that were already stacked and moved together
// keep their order, and a leaf that has just arrived goes on whichever side
// it approached from.

import { Matrix4, Vector3 } from "three";
import { LEAF_COUNT, centroid, frontNormal, worldCorners } from "./sheet";

export interface Stack {
  /** Leaves in ascending order along `direction`. */
  leaves: number[];
  direction: Vector3;
}

export interface Layering {
  stacks: Stack[];
  /** Per-leaf shift along its own front normal, in paper thicknesses. */
  offsets: number[];
}

export interface RestState {
  leaves: Matrix4[];
  layering: Layering;
}

function footprintKey(matrix: Matrix4, leaf: number) {
  return worldCorners(matrix, leaf)
    .map((corner) => corner.toArray().map((value) => Math.round(value * 1e4) + 0))
    .map((values) => values.join(","))
    .sort()
    .join("|");
}

function sameRelativePlacement(before: Matrix4[], after: Matrix4[], first: number, second: number) {
  const relative = (leaves: Matrix4[]) => leaves[first].clone().invert().multiply(leaves[second]);
  const a = relative(before).elements;
  const b = relative(after).elements;
  return a.every((value, index) => Math.abs(value - b[index]) < 1e-6);
}

/**
 * Work out the stacks for a pose the sheet has just come to rest in.
 * `previous` is the last rest state and `approach` is the sheet a moment
 * before it arrived; both are omitted for the very first, unfolded pose.
 */
export function settleLayering(
  leaves: Matrix4[],
  previous?: RestState,
  approach?: Matrix4[],
): Layering {
  const groups = new Map<string, number[]>();
  for (let leaf = 0; leaf < LEAF_COUNT; leaf += 1) {
    const key = footprintKey(leaves[leaf], leaf);
    groups.set(key, [...(groups.get(key) ?? []), leaf]);
  }

  const previousStack = new Map<number, Stack>();
  previous?.layering.stacks.forEach((stack) =>
    stack.leaves.forEach((leaf) => previousStack.set(leaf, stack)),
  );

  const offsets = new Array<number>(LEAF_COUNT).fill(0);
  const stacks: Stack[] = [];
  for (const group of groups.values()) {
    const direction = frontNormal(leaves[group[0]]);

    /** Is `upper` further along `direction` than `lower`? */
    const isAbove = (lower: number, upper: number) => {
      const shared = previousStack.get(lower);
      if (
        previous &&
        shared &&
        shared === previousStack.get(upper) &&
        sameRelativePlacement(previous.leaves, leaves, lower, upper)
      ) {
        // They travelled together, so whichever was on the other's front side still is.
        const wasAbove = shared.leaves.indexOf(upper) > shared.leaves.indexOf(lower);
        const wasOnFrontSide =
          wasAbove === frontNormal(previous.leaves[lower]).dot(shared.direction) > 0;
        return wasOnFrontSide === frontNormal(leaves[lower]).dot(direction) > 0;
      }
      if (!approach) throw new Error("Leaves overlap in a pose with no history to order them.");
      const gap = centroid(worldCorners(approach[upper], upper))
        .sub(centroid(worldCorners(approach[lower], lower)))
        .dot(direction);
      if (Math.abs(gap) < 1e-9) {
        throw new Error(`Cannot tell which side leaf ${upper} met leaf ${lower} from.`);
      }
      return gap > 0;
    };

    const rank = (leaf: number) => group.filter((other) => other !== leaf && isAbove(other, leaf));
    const ordered = [...group].sort((a, b) => rank(a).length - rank(b).length);
    ordered.forEach((leaf, index) => {
      if (rank(leaf).length !== index) throw new Error("Stack order is not consistent.");
      const height = index - (ordered.length - 1) / 2;
      offsets[leaf] = height * Math.sign(frontNormal(leaves[leaf]).dot(direction));
    });
    stacks.push({ leaves: ordered, direction });
  }
  return { stacks, offsets };
}
