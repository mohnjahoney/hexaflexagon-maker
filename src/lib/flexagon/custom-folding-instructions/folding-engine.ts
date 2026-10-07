// LEGACY: the original hand-choreographed folding animation. It is no longer
// part of the main flow (see ../paper-model and routes/flex.tsx) and is kept
// only for reference at #/animation-legacy. Do not build new features on it.

import { triangleVertices, type Point } from "../geometry";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type PhysicalTriangleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SurfaceId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;

export interface FoldOperation {
  kind: "fold";
  between: readonly [PhysicalTriangleId, PhysicalTriangleId];
  moving: readonly PhysicalTriangleId[];
  angle: number;
  placement: "front" | "behind";
  hingeOffset?: number;
  hingeSide?: -1 | 1;
}

export interface ReorderOperation {
  kind: "reorder";
  below: SurfaceId;
  above: SurfaceId;
}

export interface FlipOperation {
  kind: "flip";
}

export type FoldingOperation = FoldOperation | ReorderOperation | FlipOperation;

export interface FoldedTriangle {
  id: PhysicalTriangleId;
  vertices: [Point3, Point3, Point3];
}

export interface FoldingState {
  triangles: FoldedTriangle[];
  surfaceOrder: SurfaceId[];
}

export const FIRST_FOLD: FoldOperation = {
  kind: "fold",
  between: [3, 4],
  moving: [1, 2, 3],
  angle: Math.PI,
  placement: "front",
};

export const SECOND_FOLD: FoldOperation = {
  kind: "fold",
  between: [6, 7],
  moving: [7, 8, 9, 10],
  angle: -Math.PI,
  placement: "behind",
};

export const BRING_ARM_FORWARD: ReorderOperation = {
  kind: "reorder",
  below: 2,
  above: 12,
};

export function createInitialFoldingState(edgeLength = 1): FoldingState {
  return {
    triangles: Array.from({ length: 10 }, (_, index) => ({
      id: (index + 1) as PhysicalTriangleId,
      vertices: triangleVertices(index, edgeLength, 0, 0).map(toPoint3) as [Point3, Point3, Point3],
    })),
    surfaceOrder: Array.from({ length: 20 }, (_, index) => (index + 1) as SurfaceId),
  };
}

export function applyOperation(state: FoldingState, operation: FoldingOperation): FoldingState {
  if (operation.kind === "fold") return applyFold(state, operation);
  if (operation.kind === "reorder") return applyReorder(state, operation);
  return applyFlip(state);
}

export function applyOperations(
  state: FoldingState,
  operations: readonly FoldingOperation[],
): FoldingState {
  return operations.reduce(applyOperation, state);
}

export function rotateFoldingStateAroundVerticalAxis(
  state: FoldingState,
  angle: number,
): FoldingState {
  const points = state.triangles.flatMap((triangle) => triangle.vertices);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const axisStart = { x: centerX, y: Math.min(...ys) - 1, z: centerZ };
  const axisEnd = { x: centerX, y: Math.max(...ys) + 1, z: centerZ };

  return {
    triangles: state.triangles.map((triangle) => ({
      ...triangle,
      vertices: triangle.vertices.map((point) =>
        rotateAroundAxis(point, axisStart, axisEnd, angle),
      ) as [Point3, Point3, Point3],
    })),
    surfaceOrder: [...state.surfaceOrder],
  };
}

export function rotateFoldingStateAroundLongAxis(state: FoldingState, angle: number): FoldingState {
  const points = state.triangles.flatMap((triangle) => triangle.vertices);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const axisStart = { x: Math.min(...xs) - 1, y: centerY, z: centerZ };
  const axisEnd = { x: Math.max(...xs) + 1, y: centerY, z: centerZ };

  return {
    triangles: state.triangles.map((triangle) => ({
      ...triangle,
      vertices: triangle.vertices.map((point) =>
        rotateAroundAxis(point, axisStart, axisEnd, angle),
      ) as [Point3, Point3, Point3],
    })),
    surfaceOrder: Math.cos(angle) < 0 ? [...state.surfaceOrder].reverse() : [...state.surfaceOrder],
  };
}

export function withFoldAngle(operation: FoldOperation, angle: number): FoldOperation {
  return { ...operation, angle };
}

export function withFoldThickness(
  operation: FoldOperation,
  thickness: number,
  hingeSide: -1 | 1,
): FoldOperation {
  return { ...operation, hingeOffset: thickness / 2, hingeSide };
}

export function resolveFoldHingeSide(
  state: FoldingState,
  operation: FoldOperation,
  angle: number,
): -1 | 1 {
  const moving = new Set(operation.moving);
  const fixedId = operation.between.find((id) => !moving.has(id));
  const movingTriangle = state.triangles.find((triangle) => moving.has(triangle.id));
  if (!fixedId || !movingTriangle) throw new Error("A fold needs fixed and moving triangles.");

  const hinge = operationHinge(state, operation);

  const fixed = triangleById(state, fixedId);
  const normal = orientedTriangleNormal(fixed);
  const center = triangleCenter(movingTriangle);
  const probeAngle = Math.sign(angle || 1) * 0.001;
  const moved = rotateAroundAxis(center, hinge[0], hinge[1], probeAngle);
  const displacement = {
    x: moved.x - center.x,
    y: moved.y - center.y,
    z: moved.z - center.z,
  };
  return dot(displacement, normal) >= 0 ? 1 : -1;
}

export function surfacePhysicalTriangle(surface: SurfaceId): PhysicalTriangleId {
  return (surface > 10 ? surface - 10 : surface) as PhysicalTriangleId;
}

export function surfaceSide(surface: SurfaceId): "front" | "back" {
  return surface > 10 ? "back" : "front";
}

function applyFold(state: FoldingState, operation: FoldOperation): FoldingState {
  const hinge = operationHinge(state, operation);

  const fixedId = operation.between.find((id) => !operation.moving.includes(id));
  const hingeSide = operation.hingeSide ?? 1;
  const hingeOffset = operation.hingeOffset ?? 0;
  const shiftedHinge: [Point3, Point3] =
    fixedId && hingeOffset !== 0
      ? (() => {
          const normal = orientedTriangleNormal(triangleById(state, fixedId));
          const offset = scale(normal, hingeOffset * hingeSide);
          return [add(hinge[0], offset), add(hinge[1], offset)];
        })()
      : hinge;

  const moving = new Set(operation.moving);
  const triangles = state.triangles.map((triangle) =>
    moving.has(triangle.id)
      ? {
          ...triangle,
          vertices: triangle.vertices.map((point) =>
            rotateAroundAxis(point, shiftedHinge[0], shiftedHinge[1], operation.angle),
          ) as [Point3, Point3, Point3],
        }
      : cloneTriangle(triangle),
  );

  const movingSurfaces = state.surfaceOrder.filter((surface) =>
    moving.has(surfacePhysicalTriangle(surface)),
  );
  const fixedSurfaces = state.surfaceOrder.filter(
    (surface) => !moving.has(surfacePhysicalTriangle(surface)),
  );
  const surfaceOrder =
    operation.placement === "front"
      ? [...fixedSurfaces, ...movingSurfaces.reverse()]
      : [...movingSurfaces.reverse(), ...fixedSurfaces];

  return { triangles, surfaceOrder };
}

function applyReorder(state: FoldingState, operation: ReorderOperation): FoldingState {
  const surfaceOrder = state.surfaceOrder.filter((surface) => surface !== operation.below);
  const aboveIndex = surfaceOrder.indexOf(operation.above);
  if (aboveIndex < 0) throw new Error(`Missing surface ${operation.above}.`);
  surfaceOrder.splice(aboveIndex, 0, operation.below);
  return { triangles: state.triangles.map(cloneTriangle), surfaceOrder };
}

function applyFlip(state: FoldingState): FoldingState {
  return rotateFoldingStateAroundLongAxis(state, Math.PI);
}

function triangleById(state: FoldingState, id: PhysicalTriangleId) {
  const triangle = state.triangles.find((candidate) => candidate.id === id);
  if (!triangle) throw new Error(`Missing physical triangle ${id}.`);
  return triangle;
}

function operationHinge(state: FoldingState, operation: FoldOperation): [Point3, Point3] {
  const moving = new Set(operation.moving);
  const fixedId = operation.between.find((id) => !moving.has(id));
  if (!fixedId) throw new Error("A fold needs one fixed hinge triangle.");

  const canonicalFirst = triangleVertices(operation.between[0] - 1, 1, 0, 0).map(toPoint3);
  const canonicalSecond = triangleVertices(operation.between[1] - 1, 1, 0, 0).map(toPoint3);
  const sharedInFirstOrder = canonicalFirst.filter((point) =>
    canonicalSecond.some((candidate) => samePoint(point, candidate)),
  );
  if (sharedInFirstOrder.length !== 2) {
    throw new Error(`Triangles ${operation.between.join(" and ")} are not topological neighbors.`);
  }

  const canonicalFixed = triangleVertices(fixedId - 1, 1, 0, 0).map(toPoint3);
  const fixed = triangleById(state, fixedId);
  const fixedIndexes = sharedInFirstOrder.map((point) =>
    canonicalFixed.findIndex((candidate) => samePoint(point, candidate)),
  );
  if (fixedIndexes.some((index) => index < 0)) {
    throw new Error(`Could not resolve the hinge on triangle ${fixedId}.`);
  }
  return [fixed.vertices[fixedIndexes[0]], fixed.vertices[fixedIndexes[1]]];
}

function rotateAroundAxis(
  point: Point3,
  axisStart: Point3,
  axisEnd: Point3,
  angle: number,
): Point3 {
  const axis = normalize({
    x: axisEnd.x - axisStart.x,
    y: axisEnd.y - axisStart.y,
    z: axisEnd.z - axisStart.z,
  });
  const relative = {
    x: point.x - axisStart.x,
    y: point.y - axisStart.y,
    z: point.z - axisStart.z,
  };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const cross = {
    x: axis.y * relative.z - axis.z * relative.y,
    y: axis.z * relative.x - axis.x * relative.z,
    z: axis.x * relative.y - axis.y * relative.x,
  };
  const dot = axis.x * relative.x + axis.y * relative.y + axis.z * relative.z;
  return {
    x: axisStart.x + relative.x * cosine + cross.x * sine + axis.x * dot * (1 - cosine),
    y: axisStart.y + relative.y * cosine + cross.y * sine + axis.y * dot * (1 - cosine),
    z: axisStart.z + relative.z * cosine + cross.z * sine + axis.z * dot * (1 - cosine),
  };
}

function normalize(vector: Point3): Point3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) throw new Error("Cannot rotate around a zero-length hinge.");
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function orientedTriangleNormal(triangle: FoldedTriangle): Point3 {
  const [a, b, c] = triangle.vertices;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const raw = normalize({
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  });
  return scale(raw, triangle.id % 2 === 1 ? 1 : -1);
}

function triangleCenter(triangle: FoldedTriangle): Point3 {
  return triangle.vertices.reduce(
    (center, point) => ({
      x: center.x + point.x / 3,
      y: center.y + point.y / 3,
      z: center.z + point.z / 3,
    }),
    { x: 0, y: 0, z: 0 },
  );
}

function add(first: Point3, second: Point3): Point3 {
  return { x: first.x + second.x, y: first.y + second.y, z: first.z + second.z };
}

function scale(point: Point3, amount: number): Point3 {
  return { x: point.x * amount, y: point.y * amount, z: point.z * amount };
}

function dot(first: Point3, second: Point3) {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function samePoint(first: Point3, second: Point3) {
  return (
    Math.abs(first.x - second.x) < 1e-8 &&
    Math.abs(first.y - second.y) < 1e-8 &&
    Math.abs(first.z - second.z) < 1e-8
  );
}

function toPoint3(point: Point): Point3 {
  return { ...point, z: 0 };
}

function cloneTriangle(triangle: FoldedTriangle): FoldedTriangle {
  return {
    ...triangle,
    vertices: triangle.vertices.map((point) => ({ ...point })) as [Point3, Point3, Point3],
  };
}
