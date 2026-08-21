import * as THREE from "three";
import { triangleVertices, type Point } from "../geometry";
import {
  surfacePhysicalTriangle,
  surfaceSide,
  type FoldingState,
  type Point3,
  type SurfaceId,
} from "./folding-engine";
import { themeColor } from "../../theme-colors";

export interface ThreeInstructionAssets {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  double: HTMLCanvasElement;
}

export interface ThreeInstructionRenderOptions {
  width: number;
  height: number;
  background?: string;
  emphasize?: number[];
  camera?: "top" | "folding";
}

export interface FoldingAnimationRenderer {
  render: (state: FoldingState, options?: FoldingAnimationFrameOptions) => void;
  resize: () => void;
  paperThickness: () => number;
  dispose: () => void;
}

export interface FoldingAnimationFrameOptions {
  surfaceOpacity?: Partial<Record<SurfaceId, number>>;
  preparationFoldProgress?: number;
  smoothVerticalCenter?: boolean;
  snapVerticalCenter?: boolean;
}

type SurfaceOpacity = Record<"front" | "back", number>;

/** A persistent Three.js renderer for interactive folding experiments. */
export function createFoldingAnimationRenderer(
  canvas: HTMLCanvasElement,
  assets: ThreeInstructionAssets,
): FoldingAnimationRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(themeColor("paper-deep")), 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(themeColor("white"), 1.2));
  const light = new THREE.DirectionalLight(themeColor("white"), 1.8);
  light.position.set(2.5, 4, 6);
  scene.add(light);

  const group = new THREE.Group();
  scene.add(group);
  const textures = { front: makeTexture(assets.front), back: makeTexture(assets.back) };
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  const target = new THREE.Vector3(2.75, -Math.sqrt(3) / 4, 0);
  let pairedSurfaceGap = 0.01;
  let currentVerticalOffset = 0;
  let hasCenteredVertically = false;
  let previousCenterTime = performance.now();
  let previousRenderMode: "preparation" | "folded" | null = null;

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distanceForHeight = 1.4 / (2 * Math.tan(verticalFov / 2));
    const distanceForWidth = 6.2 / (2 * Math.tan(verticalFov / 2) * camera.aspect);
    const distance = Math.max(distanceForHeight, distanceForWidth);
    const visibleWidthAtStrip = 2 * distance * Math.tan(verticalFov / 2) * camera.aspect;
    pairedSurfaceGap = (2 * visibleWidthAtStrip) / width;
    const direction = new THREE.Vector3(0, -0.28, 1).normalize();
    camera.position.copy(target).add(direction.multiplyScalar(distance));
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function render(state: FoldingState, options: FoldingAnimationFrameOptions = {}) {
    clearGroup(group, false);
    group.position.y = 0;
    const renderMode = options.preparationFoldProgress !== undefined ? "preparation" : "folded";
    const renderModeChanged = previousRenderMode !== null && previousRenderMode !== renderMode;
    previousRenderMode = renderMode;

    if (options.preparationFoldProgress !== undefined) {
      addPreparationMeshes(group, assets, textures, options.preparationFoldProgress);
    } else {
      addSurfaceMeshes(
        group,
        state,
        assets,
        [],
        textures,
        { front: 1, back: 1 },
        pairedSurfaceGap,
        options.surfaceOpacity,
      );
    }
    const now = performance.now();
    const deltaSeconds = Math.min((now - previousCenterTime) / 1000, 0.1);
    previousCenterTime = now;
    const desiredVerticalOffset = verticalCenterOffset(group, target.y);
    if (!hasCenteredVertically || options.snapVerticalCenter || renderModeChanged) {
      currentVerticalOffset = desiredVerticalOffset;
      hasCenteredVertically = true;
    } else if (options.smoothVerticalCenter) {
      const distance = desiredVerticalOffset - currentVerticalOffset;
      if (Math.abs(distance) > 0.002) {
        // const smoothing = 1 - Math.exp(-10 * deltaSeconds);
        const smoothing = 0.05;
        currentVerticalOffset += distance * smoothing;
        // currentVerticalOffset += distance;
      }
    }
    group.position.y = currentVerticalOffset;
    renderer.render(scene, camera);
  }

  resize();
  return {
    render,
    resize,
    paperThickness: () => pairedSurfaceGap,
    dispose() {
      clearGroup(group, false);
      textures.front.dispose();
      textures.back.dispose();
      renderer.dispose();
    },
  };
}

function addPreparationMeshes(
  group: THREE.Group,
  assets: ThreeInstructionAssets,
  textures: { front: THREE.Texture; back: THREE.Texture },
  progress: number,
) {
  const edgeLength = 1;
  const stripHeight = Math.sqrt(3) / 2;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const foldAngle = -Math.PI * clampedProgress;
  const paperInside = new THREE.MeshBasicMaterial({
    color: themeColor("paper"),
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -0.01,
    polygonOffsetUnits: -0.01,
  });

  for (let index = 0; index < 10; index += 1) {
    const upper = triangleVertices(index, edgeLength, 0, 0);
    const lower = upper.map((point) => ({ x: point.x, y: 2 * stripHeight - point.y }));
    const upperSource = triangleVertices(index, assets.front.width / 5.5, 0, 0);
    const lowerSource = triangleVertices(index, assets.back.width / 5.5, 0, 0, true);
    const frontIndex = index % 2 === 0 ? [0, 2, 1] : [0, 1, 2];
    const upperGeometry = makePreparationGeometry(upper, upperSource, assets.front, frontIndex);
    const lowerIndex = [...frontIndex].reverse();
    const lowerGeometry = makePreparationGeometry(lower, lowerSource, assets.back, lowerIndex);
    upperGeometry.rotateX(foldAngle);
    upperGeometry.translate(
      0,
      -stripHeight * (1 - Math.cos(foldAngle)),
      stripHeight * Math.sin(foldAngle),
    );

    const upperInsideGeometry = upperGeometry.clone();
    upperInsideGeometry.setIndex([...frontIndex].reverse());
    const lowerInsideGeometry = lowerGeometry.clone();
    lowerInsideGeometry.setIndex([...lowerIndex].reverse());

    const upperMesh = new THREE.Mesh(
      upperGeometry,
      new THREE.MeshBasicMaterial({
        map: textures.front,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    upperMesh.renderOrder = index + 20;
    group.add(upperMesh);

    const upperInsideMesh = new THREE.Mesh(upperInsideGeometry, paperInside.clone());
    upperInsideMesh.renderOrder = index + 10;
    group.add(upperInsideMesh);

    const lowerMesh = new THREE.Mesh(
      lowerGeometry,
      new THREE.MeshBasicMaterial({
        map: textures.back,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    lowerMesh.renderOrder = index + 30;
    group.add(lowerMesh);

    const lowerInsideMesh = new THREE.Mesh(lowerInsideGeometry, paperInside.clone());
    lowerInsideMesh.renderOrder = index;
    group.add(lowerInsideMesh);
  }

  paperInside.dispose();
}

function makePreparationGeometry(
  vertices: Point[],
  source: Point[],
  sourceCanvas: HTMLCanvasElement,
  indices: number[],
) {
  const positions = vertices.flatMap((point) => [point.x, -point.y, 0]);
  const uvs = source.flatMap((point) => [
    point.x / sourceCanvas.width,
    1 - point.y / sourceCanvas.height,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function renderFoldingStateWithThree(
  state: FoldingState,
  assets: ThreeInstructionAssets,
  options: ThreeInstructionRenderOptions,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(options.width));
  canvas.height = Math.max(1, Math.round(options.height));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setClearColor(new THREE.Color(options.background ?? themeColor("paper-deep")), 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(themeColor("white"), 1.2));
  const light = new THREE.DirectionalLight(themeColor("white"), 1.8);
  light.position.set(2.5, 4, 6);
  scene.add(light);

  const group = new THREE.Group();
  scene.add(group);
  addSurfaceMeshes(group, state, assets, options.emphasize ?? []);
  centerGroup(group);

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSpan = Math.max(size.x, size.y, size.z, 1);
  const camera = new THREE.PerspectiveCamera(34, canvas.width / canvas.height, 0.01, 100);
  if (options.camera === "top") {
    camera.position.set(center.x, center.y, maxSpan * 2.8);
    camera.up.set(0, 1, 0);
  } else {
    camera.position.set(center.x + maxSpan * 0.35, center.y - maxSpan * 0.72, maxSpan * 2.1);
    camera.up.set(0, 1, 0);
  }
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  fitCamera(camera, box, canvas.width / canvas.height);

  renderer.render(scene, camera);
  disposeScene(scene);
  renderer.dispose();
  return canvas;
}

function addSurfaceMeshes(
  group: THREE.Group,
  state: FoldingState,
  assets: ThreeInstructionAssets,
  emphasize: number[],
  textures?: { front: THREE.Texture; back: THREE.Texture },
  opacity: SurfaceOpacity = { front: 1, back: 1 },
  pairedSurfaceGap = 0,
  opacityBySurface: Partial<Record<SurfaceId, number>> = {},
) {
  const frontTexture = textures?.front ?? makeTexture(assets.front);
  const backTexture = textures?.back ?? makeTexture(assets.back);
  const orderBySurface = new Map<SurfaceId, number>();
  state.surfaceOrder.forEach((surface, index) => orderBySurface.set(surface, index));

  state.surfaceOrder.forEach((surface, orderIndex) => {
    const physicalTriangle = surfacePhysicalTriangle(surface);
    const triangle = state.triangles.find((candidate) => candidate.id === physicalTriangle);
    if (!triangle) return;

    const side = surfaceSide(surface);
    const sourceCanvas = side === "front" ? assets.front : assets.back;
    const sourceTriangle = triangleVertices(
      physicalTriangle - 1,
      sourceCanvas.width / 5.5,
      0,
      0,
      side === "back",
    );
    const geometry = makeTriangleGeometry(
      triangle.vertices,
      sourceTriangle,
      sourceCanvas,
      orderIndex,
      side,
      physicalTriangle,
      pairedSurfaceGap,
    );
    const surfaceOpacity = opacityBySurface[surface] ?? opacity[side];
    const material = new THREE.MeshBasicMaterial({
      map: side === "front" ? frontTexture : backTexture,
      side: THREE.FrontSide,
      opacity: surfaceOpacity,
      transparent: surfaceOpacity < 1,
      depthTest: true,
      depthWrite: surfaceOpacity === 1,
      polygonOffset: true,
      polygonOffsetFactor: -orderIndex * 0.015,
      polygonOffsetUnits: -orderIndex * 0.015,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = orderBySurface.get(surface) ?? orderIndex;
    group.add(mesh);

    if (emphasize.includes(surfacePhysicalTriangle(surface))) {
      const overlay = new THREE.Mesh(
        geometry.clone(),
        new THREE.MeshBasicMaterial({
          color: themeColor("oxblood"),
          opacity: 0.22,
          transparent: true,
          side: THREE.DoubleSide,
          depthTest: false,
        }),
      );
      overlay.renderOrder = mesh.renderOrder + 0.1;
      group.add(overlay);
    }
  });
}

function makeTriangleGeometry(
  vertices: [Point3, Point3, Point3],
  source: [Point, Point, Point],
  sourceCanvas: HTMLCanvasElement,
  orderIndex: number,
  side: "front" | "back",
  physicalTriangle: number,
  pairedSurfaceGap: number,
) {
  const normal = normalFor(vertices);
  const sideSign = side === "front" ? 1 : -1;
  const windingCorrection = physicalTriangle % 2 === 1 ? -1 : 1;
  const positions = vertices.flatMap((point) => {
    if (pairedSurfaceGap > 0) {
      // Adjacent strip triangles have opposite vertex winding. Correcting for
      // that keeps every front surface on the same physical side of the paper.
      const offset = windingCorrection * sideSign * (pairedSurfaceGap / 2);
      return [
        point.x + normal.x * offset,
        -point.y + normal.y * offset,
        point.z + normal.z * offset,
      ];
    }

    const orderOffset = (orderIndex + 1) * 0.00035;
    const offset = windingCorrection * sideSign * orderOffset;
    return [point.x + normal.x * offset, -point.y + normal.y * offset, point.z + normal.z * offset];
  });
  const uvs = source.flatMap((point) => [
    point.x / sourceCanvas.width,
    1 - point.y / sourceCanvas.height,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  const frontIndex = physicalTriangle % 2 === 1 ? [0, 2, 1] : [0, 1, 2];
  geometry.setIndex(side === "front" ? frontIndex : [...frontIndex].reverse());
  geometry.computeVertexNormals();
  return geometry;
}

function makeTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function normalFor(vertices: [Point3, Point3, Point3]) {
  const a = new THREE.Vector3(
    vertices[1].x - vertices[0].x,
    -(vertices[1].y - vertices[0].y),
    vertices[1].z - vertices[0].z,
  );
  const b = new THREE.Vector3(
    vertices[2].x - vertices[0].x,
    -(vertices[2].y - vertices[0].y),
    vertices[2].z - vertices[0].z,
  );
  const normal = a.cross(b).normalize();
  return { x: normal.x, y: normal.y, z: normal.z };
}

function centerGroup(group: THREE.Group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
}

function verticalCenterOffset(group: THREE.Group, targetY: number) {
  const box = new THREE.Box3().setFromObject(group);
  const lowestVertex = box.min.y;
  const highestVertex = box.max.y;
  return targetY - (lowestVertex + highestVertex) / 2;
}

function fitCamera(camera: THREE.PerspectiveCamera, box: THREE.Box3, aspect: number) {
  const size = box.getSize(new THREE.Vector3());
  const maxHeight = Math.max(size.y, size.z, size.x / aspect, 0.5);
  const distance = maxHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const direction = camera.position.clone().normalize();
  camera.position.copy(direction.multiplyScalar(distance * 1.55));
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose();
      material.dispose();
    });
  });
}

function clearGroup(group: THREE.Group, disposeTextures = true) {
  for (const child of [...group.children]) {
    group.remove(child);
    if (!(child instanceof THREE.Mesh)) continue;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (disposeTextures && material instanceof THREE.MeshBasicMaterial && material.map) {
        material.map.dispose();
      }
      material.dispose();
    });
  }
}
