// Draws a PaperPose. Every leaf is two thin slabs of paper, one carrying the
// front print and one the back, so stacked leaves hide each other through
// ordinary depth testing: no render order, polygon offsets or faded surfaces.

import * as THREE from "three";
import { triangleVertices } from "../geometry";
import { themeColor } from "../../theme-colors";
import type { StripAssets } from "../custom-folding-instructions/render";
import type { Frame } from "./fold-sequence";
import {
  LEAF_COUNT,
  STRIP_HEIGHT,
  backPrintUnfold,
  materialCorners,
  type PaperPose,
} from "./sheet";

/** Paper thickness as a fraction of a triangle's edge. */
export const PAPER_THICKNESS = 0.012;
/** Each print's slab stops just short of half the thickness, leaving a hairline between leaves. */
const SLAB_FILL = 0.45;
const DEFAULT_PITCH = -Math.atan(0.28);

export interface PaperRendererOptions {
  thickness?: number;
  /** Draw on a clear background and ignore the pointer, for use as a decoration. */
  decorative?: boolean;
}

export interface PaperRenderer {
  render: (pose: PaperPose, frame: Frame) => void;
  /** Swap in newly printed faces without rebuilding anything else. */
  setAssets: (assets: StripAssets) => void;
  resize: () => void;
  dispose: () => void;
}

type Side = "front" | "back";

function buildSlabGeometry(leaf: number, side: Side, thickness: number) {
  const printZ = (side === "front" ? 1 : -1) * SLAB_FILL * thickness;
  const [a, b, c] = materialCorners(leaf);
  const anticlockwise = b.clone().sub(a).cross(c.clone().sub(a)).z > 0;
  const corners = (anticlockwise ? [0, 1, 2] : [0, 2, 1]).map((index) => {
    const source = triangleVertices(leaf, 1, 0, 0, side === "back")[index];
    return {
      point: materialCorners(leaf)[index],
      uv: [source.x / 5.5, 1 - source.y / STRIP_HEIGHT],
    };
  });

  const positions: number[] = [];
  const uvs: number[] = [];
  const push = (corner: (typeof corners)[number], z: number, printed: boolean) => {
    positions.push(corner.point.x, corner.point.y, z);
    uvs.push(...(printed ? corner.uv : [0, 0]));
  };
  const facingUp = (z: number, printed: boolean) => corners.forEach((k) => push(k, z, printed));
  const facingDown = (z: number, printed: boolean) =>
    [...corners].reverse().forEach((k) => push(k, z, printed));

  // The printed face, then the bare inner face, then the three cut edges.
  if (side === "front") {
    facingUp(printZ, true);
    facingDown(0, false);
  } else {
    facingDown(printZ, true);
    facingUp(0, false);
  }
  const [low, high] = [Math.min(0, printZ), Math.max(0, printZ)];
  corners.forEach((from, index) => {
    const to = corners[(index + 1) % 3];
    [
      [from, low],
      [to, low],
      [to, high],
      [from, low],
      [to, high],
      [from, high],
    ].forEach(([corner, z]) => push(corner as (typeof corners)[number], z as number, false));
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  geometry.addGroup(6, positions.length / 3 - 6, 2);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTexture(canvas: HTMLCanvasElement, anisotropy: number) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

export function createPaperRenderer(
  canvas: HTMLCanvasElement,
  assets: StripAssets,
  { thickness = PAPER_THICKNESS, decorative = false }: PaperRendererOptions = {},
): PaperRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: decorative });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(themeColor("paper-deep")), decorative ? 0 : 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(themeColor("white"), 2.1));
  // A headlight just off the camera's shoulder: tilted paper darkens a little.
  const light = new THREE.DirectionalLight(themeColor("white"), 1.2);
  scene.add(light);

  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const paper = new THREE.MeshLambertMaterial({ color: themeColor("paper") });
  // Cut edges sit in a little shadow, which keeps the seams between stacks quiet.
  const cutEdge = new THREE.MeshLambertMaterial({
    color: new THREE.Color(themeColor("paper")).multiplyScalar(0.7),
  });
  const prints: Record<Side, THREE.MeshLambertMaterial> = {
    front: new THREE.MeshLambertMaterial({ map: makeTexture(assets.front, anisotropy) }),
    back: new THREE.MeshLambertMaterial({ map: makeTexture(assets.back, anisotropy) }),
  };
  const slabs = Array.from({ length: LEAF_COUNT }, (_, leaf) => {
    const make = (side: Side) => {
      const mesh = new THREE.Mesh(buildSlabGeometry(leaf, side, thickness), [
        prints[side],
        paper,
        cutEdge,
      ]);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      return mesh;
    };
    return { front: make("front"), back: make("back") };
  });

  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  // How far the viewer has dragged away from the frame's own viewpoint.
  let yaw = 0;
  let pitchOffset = 0;
  let basePitch: number | null = null;
  let dragging: { x: number; y: number } | null = null;

  const onPointerDown = (event: PointerEvent) => {
    dragging = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    yaw -= (event.clientX - dragging.x) * 0.008;
    pitchOffset += (event.clientY - dragging.y) * 0.008;
    dragging = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => {
    dragging = null;
  };
  const onDoubleClick = () => {
    yaw = 0;
    pitchOffset = 0;
  };
  if (!decorative) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDoubleClick);
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
  }

  function render(pose: PaperPose, frame: Frame) {
    const backPrint = backPrintUnfold(pose.prepAngle);
    slabs.forEach((slab, leaf) => {
      slab.front.matrix
        .copy(pose.leaves[leaf])
        .multiply(new THREE.Matrix4().makeTranslation(0, 0, pose.offsets[leaf] * thickness));
      slab.back.matrix.copy(slab.front.matrix).multiply(backPrint);
      slab.front.matrixWorldNeedsUpdate = true;
      slab.back.matrixWorldNeedsUpdate = true;
    });

    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const fit = (view: { halfWidth: number; halfHeight: number }) =>
      1.14 * Math.max(view.halfHeight / halfFov, view.halfWidth / (halfFov * camera.aspect));
    let distance = fit(frame);
    if (frame.wide) {
      const wide = fit(frame.wide);
      distance = wide / (1 + (wide / distance - 1) / 2);
    }
    // Ease between viewpoints so switching from folding to flexing does not jump.
    const framePitch = frame.pitch ?? DEFAULT_PITCH;
    basePitch = basePitch === null ? framePitch : basePitch + (framePitch - basePitch) * 0.06;
    pitchOffset = Math.max(-1.45 - basePitch, Math.min(1.45 - basePitch, pitchOffset));
    const pitch = basePitch + pitchOffset;
    const direction = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    camera.position.copy(frame.center).addScaledVector(direction, distance);
    camera.near = distance / 20;
    camera.far = distance * 20;
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    light.position.copy(new THREE.Vector3(-0.35, 0.5, 1).applyQuaternion(camera.quaternion));
    renderer.render(scene, camera);
  }

  resize();
  return {
    render,
    setAssets(next) {
      (["front", "back"] as const).forEach((side) => {
        prints[side].map?.dispose();
        prints[side].map = makeTexture(next[side], anisotropy);
      });
    },
    resize,
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
      slabs.forEach((slab) => {
        slab.front.geometry.dispose();
        slab.back.geometry.dispose();
      });
      prints.front.map?.dispose();
      prints.back.map?.dispose();
      prints.front.dispose();
      prints.back.dispose();
      paper.dispose();
      cutEdge.dispose();
      renderer.dispose();
    },
  };
}
