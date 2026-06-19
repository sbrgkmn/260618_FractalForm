import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SeededRandom, clamp, randomSeed } from "./random";

type PointNode = {
  position: THREE.Vector3;
  polarity: THREE.Vector3;
  origin?: THREE.Vector3;
};

type AlgoTriangle = {
  a: PointNode;
  b: PointNode;
  c: PointNode;
  state: boolean;
  dirA: boolean;
  dirB: boolean;
  dirC: boolean;
};

type EdgeCache = Map<string, PointNode>;
type MeshFace = [number, number, number];
type RenderTriangle = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 };
type IndexedMesh = {
  vertices: THREE.Vector3[];
  faces: MeshFace[];
  fixed: Set<number>;
};
type SymmetryTransform =
  | "identity"
  | "mirror"
  | "rotate"
  | "rotateMirror"
  | "mirrorX"
  | "mirrorZ"
  | "mirrorXZ";
type DivisionMode = "abc" | "a" | "b" | "c" | "ab" | "bc" | "ca";

type Params = {
  topology: "single" | "double" | "quad";
  axisSymmetry: boolean;
  divisionMode: DivisionMode;
  refineMode: "off" | "smooth" | "fixedCorners";
  refineSteps: number;
  refineAmount: number;
  refineRelax: number;
  refineEdgeInflate: number;
  refineFaceInflate: number;
  massH: number;
  massD: number;
  massW: number;
  recursion: number;
  divThreshold: number;
  posA: number;
  ampA: number;
  rotA: number;
  posB: number;
  ampB: number;
  rotB: number;
  posC: number;
  ampC: number;
  rotC: number;
  conPosA: number;
  conAmpA: number;
  conRotA: number;
  conPosB: number;
  conAmpB: number;
  conRotB: number;
  conPosC: number;
  conAmpC: number;
  conRotC: number;
  edgeWeight: number;
  showContract: boolean;
  expansiveABVertical: boolean;
  showPointNormals: boolean;
  contractToExpansionCenters: boolean;
  randomSeed: number;
};

type View = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls?: OrbitControls;
};

type DivisionPreview = {
  mode: DivisionMode;
  view: View;
  group: THREE.Group;
};

const params: Params = {
  topology: "quad",
  axisSymmetry: true,
  divisionMode: "abc",
  refineMode: "fixedCorners",
  refineSteps: 1,
  refineAmount: 0.12,
  refineRelax: 0.18,
  refineEdgeInflate: 0.35,
  refineFaceInflate: 0.1,
  massH: 51,
  massD: 40,
  massW: 40,
  recursion: 4,
  divThreshold: 2.2,
  posA: 0.5,
  ampA: 0.74,
  rotA: 0.5,
  posB: 0.5,
  ampB: 0.12,
  rotB: 0.5,
  posC: 0.56,
  ampC: 0.43,
  rotC: 0.57,
  conPosA: 0.5,
  conAmpA: 0.1,
  conRotA: 0.5,
  conPosB: 0.5,
  conAmpB: -0.1,
  conRotB: 0.5,
  conPosC: 0.5,
  conAmpC: -0.1,
  conRotC: 0.5,
  edgeWeight: 2,
  showContract: false,
  expansiveABVertical: true,
  showPointNormals: false,
  contractToExpansionCenters: true,
  randomSeed: 1841919
};

const triangleCount = document.querySelector<HTMLElement>("#triangleCount");
const warning = document.querySelector<HTMLElement>("#warning");
const controlsForm = document.querySelector<HTMLFormElement>("#controls");

const edgeView = makeView("edgeCanvas", false);
const edgeGroup = new THREE.Group();
edgeView.scene.add(edgeGroup);
addLights(edgeView.scene);

const divisionPreviews: DivisionPreview[] = [
  makeDivisionPreview("abc", "divisionAbcCanvas"),
  makeDivisionPreview("a", "divisionACanvas"),
  makeDivisionPreview("b", "divisionBCanvas"),
  makeDivisionPreview("c", "divisionCCanvas"),
  makeDivisionPreview("ab", "divisionAbCanvas"),
  makeDivisionPreview("bc", "divisionBcCanvas"),
  makeDivisionPreview("ca", "divisionCaCanvas")
];

buildControls();
rebuildLab();
window.addEventListener("resize", resizeAll);
animate();

function makeDivisionPreview(mode: DivisionMode, canvasId: string): DivisionPreview {
  const view = makeView(canvasId, true);
  const group = new THREE.Group();
  view.scene.add(group);
  addLights(view.scene);
  return { mode, view, group };
}

function makeView(canvasId: string, orbit: boolean): View {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${canvasId}`);
  if (!canvas) throw new Error(`Missing #${canvasId}`);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x687074);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x687074);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  const controls = orbit ? new OrbitControls(camera, canvas) : undefined;
  if (controls) {
    controls.enableDamping = true;
    controls.autoRotate = false;
  }

  return { renderer, scene, camera, controls };
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  key.position.set(8, 16, 10);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.65);
  fill.position.set(-9, 7, -8);
  scene.add(fill);
}

function buildControls(): void {
  if (!controlsForm) return;
  controlsForm.innerHTML = "";

  addFieldset("Mass", [
    select("topology", "Topology", [
      ["single", "single face"],
      ["double", "double half pyramid"],
      ["quad", "quad full pyramid"]
    ]),
    checkbox("axisSymmetry", "Primary axis symmetry"),
    slider("massH", "Mass H", 10, 80, 1),
    slider("massD", "Mass D", 5, 50, 1),
    ...(params.axisSymmetry ? [] : [slider("massW", "Mass W", 5, 50, 1)]),
    select("divisionMode", "Division", [
      ["abc", "all A/B/C"],
      ["a", "single A"],
      ["b", "single B"],
      ["c", "single C"],
      ["ab", "pair A+B"],
      ["bc", "pair B+C"],
      ["ca", "pair C+A"]
    ]),
    slider("recursion", "Recursion", 0, 6, 1),
    slider("divThreshold", "Min edge", 0, 12, 0.1)
  ]);

  addFieldset("Surface Refinement", [
    select("refineMode", "Mode", [
      ["off", "off"],
      ["smooth", "smooth all"],
      ["fixedCorners", "fixed corners"]
    ]),
    slider("refineSteps", "Steps", 0, 3, 1),
    slider("refineAmount", "Inflate", -2, 2, 0.01),
    slider("refineRelax", "Relax", 0, 1, 0.01),
    slider("refineEdgeInflate", "Edge inflate", 0, 1, 0.01),
    slider("refineFaceInflate", "Face inflate", 0, 1, 0.01)
  ]);

  addFieldset("Rule Toggles", [
    checkbox("expansiveABVertical", "A/B vertical displacement"),
    checkbox("showPointNormals", "Show point normals"),
    checkbox("contractToExpansionCenters", "Contract to expand centers"),
    slider("edgeWeight", "Edge weight", 1, 6, 1)
  ]);

  addFieldset("Target Randomizer", [
    readout("Seed", String(params.randomSeed)),
    button("Random target-like", () => {
      randomizeTargetLike();
      buildControls();
      rebuildLab();
    }),
    button("Reset", () => {
      resetParams();
      buildControls();
      rebuildLab();
    })
  ]);

  addFieldset("Expand EC", [
    slider("posA", "Pos A", 0, 1, 0.01),
    slider("ampA", "Amp A", -0.8, 0.8, 0.01),
    slider("rotA", "Rot A", 0, 1, 0.01),
    slider("posB", "Pos B", 0, 1, 0.01),
    slider("ampB", "Amp B", -0.8, 0.8, 0.01),
    slider("rotB", "Rot B", 0, 1, 0.01),
    slider("posC", "Pos C", 0, 1, 0.01),
    slider("ampC", "Amp C", -0.8, 0.8, 0.01),
    slider("rotC", "Rot C", 0, 1, 0.01)
  ]);

  addFieldset("Contract EC", [
    checkbox("showContract", "Show contract"),
    slider("conPosA", "Con Pos A", 0, 1, 0.01),
    slider("conAmpA", "Con Amp A", -0.8, 0.8, 0.01),
    slider("conRotA", "Con Rot A", 0, 1, 0.01),
    slider("conPosB", "Con Pos B", 0, 1, 0.01),
    slider("conAmpB", "Con Amp B", -0.8, 0.8, 0.01),
    slider("conRotB", "Con Rot B", 0, 1, 0.01),
    slider("conPosC", "Con Pos C", 0, 1, 0.01),
    slider("conAmpC", "Con Amp C", -0.8, 0.8, 0.01),
    slider("conRotC", "Con Rot C", 0, 1, 0.01)
  ]);

}

function addFieldset(title: string, children: HTMLElement[]): void {
  if (!controlsForm) return;
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = title;
  fieldset.appendChild(legend);
  children.forEach((child) => fieldset.appendChild(child));
  controlsForm.appendChild(fieldset);
}

function slider(key: keyof Params, labelText: string, min: number, max: number, step: number): HTMLElement {
  const label = document.createElement("label");
  const name = document.createElement("span");
  const input = document.createElement("input");
  const output = document.createElement("output");
  name.textContent = labelText;
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(params[key]);
  output.textContent = formatValue(Number(params[key]));
  input.addEventListener("input", () => {
    (params[key] as number) = Number(input.value);
    if (key === "massD" && params.axisSymmetry) params.massW = params.massD;
    output.textContent = formatValue(Number(input.value));
    rebuildLab();
  });
  label.append(name, input, output);
  return label;
}

function checkbox(key: keyof Params, labelText: string): HTMLElement {
  const label = document.createElement("label");
  label.className = "checkbox";
  const name = document.createElement("span");
  const input = document.createElement("input");
  name.textContent = labelText;
  input.type = "checkbox";
  input.checked = Boolean(params[key]);
  input.addEventListener("change", () => {
    (params[key] as boolean) = input.checked;
    if (key === "axisSymmetry" && input.checked) params.massW = params.massD;
    if (key === "axisSymmetry") buildControls();
    rebuildLab();
  });
  label.append(name, input);
  return label;
}

function select(key: keyof Params, labelText: string, options: [string, string][]): HTMLElement {
  const label = document.createElement("label");
  const name = document.createElement("span");
  const selectEl = document.createElement("select");
  const output = document.createElement("output");
  name.textContent = labelText;
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    option.selected = params[key] === value;
    selectEl.appendChild(option);
  }
  output.textContent = String(params[key]);
  selectEl.addEventListener("change", () => {
    (params[key] as string) = selectEl.value;
    output.textContent = selectEl.value;
    rebuildLab();
  });
  label.append(name, selectEl, output);
  return label;
}

function button(labelText: string, handler: () => void): HTMLElement {
  const buttonEl = document.createElement("button");
  buttonEl.type = "button";
  buttonEl.textContent = labelText;
  buttonEl.addEventListener("click", handler);
  return buttonEl;
}

function readout(labelText: string, value: string): HTMLElement {
  const label = document.createElement("label");
  const name = document.createElement("span");
  const output = document.createElement("output");
  name.textContent = labelText;
  output.textContent = value;
  label.append(name, output);
  return label;
}

function resetParams(): void {
  Object.assign(params, {
    topology: "quad",
    axisSymmetry: true,
    divisionMode: "abc",
    refineMode: "fixedCorners",
    refineSteps: 1,
    refineAmount: 0.12,
    refineRelax: 0.18,
    refineEdgeInflate: 0.35,
    refineFaceInflate: 0.1,
    massH: 51,
    massD: 40,
    massW: 40,
    recursion: 4,
    divThreshold: 2.2,
    posA: 0.5,
    ampA: 0.74,
    rotA: 0.5,
    posB: 0.5,
    ampB: 0.12,
    rotB: 0.5,
    posC: 0.56,
    ampC: 0.43,
    rotC: 0.57,
    conPosA: 0.5,
    conAmpA: 0.1,
    conRotA: 0.5,
    conPosB: 0.5,
    conAmpB: -0.1,
    conRotB: 0.5,
    conPosC: 0.5,
    conAmpC: -0.1,
    conRotC: 0.5,
    edgeWeight: 2,
    expansiveABVertical: true,
    showPointNormals: false,
    contractToExpansionCenters: true,
    showContract: false,
    randomSeed: 1841919
  });
}

function randomizeTargetLike(seed = randomSeed()): void {
  const rng = new SeededRandom(seed);
  const base = roundTo(rng.range(36, 44), 1);
  Object.assign(params, {
    topology: "quad",
    axisSymmetry: true,
    divisionMode: "abc",
    massH: Math.round(rng.range(48, 66)),
    massD: base,
    massW: base,
    recursion: rng.int(4, 5),
    divThreshold: roundTo(rng.range(1.8, 3.2), 0.1),
    refineMode: rng.next() > 0.35 ? "fixedCorners" : "smooth",
    refineSteps: rng.int(1, 2),
    refineAmount: randomNear(rng, 0.12, 0.16, -0.12, 0.32),
    refineRelax: randomNear(rng, 0.2, 0.1),
    refineEdgeInflate: randomNear(rng, 0.35, 0.15),
    refineFaceInflate: randomNear(rng, 0.1, 0.08),
    posA: randomNear(rng, 0.5, 0.05),
    ampA: randomNear(rng, 0.66, 0.1),
    rotA: randomNear(rng, 0.5, 0.06),
    posB: randomNear(rng, 0.5, 0.05),
    ampB: randomNear(rng, 0.13, 0.08),
    rotB: randomNear(rng, 0.5, 0.06),
    posC: randomNear(rng, 0.54, 0.06),
    ampC: randomNear(rng, 0.42, 0.12),
    rotC: randomNear(rng, 0.55, 0.07),
    conPosA: randomNear(rng, 0.5, 0.04),
    conAmpA: randomNear(rng, 0.1, 0.06, -0.02, 0.18),
    conRotA: randomNear(rng, 0.5, 0.05),
    conPosB: randomNear(rng, 0.5, 0.04),
    conAmpB: randomNear(rng, -0.1, 0.07, -0.2, 0.02),
    conRotB: randomNear(rng, 0.5, 0.05),
    conPosC: randomNear(rng, 0.5, 0.04),
    conAmpC: randomNear(rng, -0.1, 0.07, -0.2, 0.02),
    conRotC: randomNear(rng, 0.5, 0.05),
    edgeWeight: params.edgeWeight,
    showContract: false,
    expansiveABVertical: true,
    contractToExpansionCenters: true,
    randomSeed: seed
  });
}

function randomNear(rng: SeededRandom, center: number, radius: number, min = 0, max = 1): number {
  return roundTo(clamp(center + rng.signed(radius), min, max), 0.01);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function rebuildLab(): void {
  const base = baseTriangle();
  drawEdgeOperation(base);

  const selected = params.divisionMode;
  let selectedCount = 0;
  for (const preview of divisionPreviews) {
    const result = generateDivisionResult(preview.mode);
    drawDivisionPreview(preview, result.refinedTriangles, result.debugTriangles);
    if (preview.mode === selected) selectedCount = result.refinedTriangles.length;
  }
  if (triangleCount) triangleCount.textContent = selectedCount.toLocaleString();
}

function generateDivisionResult(mode: DivisionMode): { refinedTriangles: RenderTriangle[]; debugTriangles: AlgoTriangle[] } {
  const previousMode = params.divisionMode;
  params.divisionMode = mode;
  const base = baseTriangle();
  const transforms = topologyTransforms();
  const seedRecursiveTriangles: AlgoTriangle[] = [];
  subdivideRecursive(base, 0, true, seedRecursiveTriangles, new Map());
  const debugTriangles = transforms.flatMap((transform) =>
    seedRecursiveTriangles.map((triangle) => transformTriangle(triangle, transform))
  );
  const refinedTriangles = refineRecursiveTriangles(debugTriangles);
  params.divisionMode = previousMode;
  return { refinedTriangles, debugTriangles };
}

function baseTriangle(): AlgoTriangle {
  const footprint = baseFootprint();
  return makeSeed(
    point(new THREE.Vector3(0, 0, footprint.z), new THREE.Vector3(0, 0, 1)),
    point(new THREE.Vector3(0, params.massH, 0), new THREE.Vector3(0, 1, 0)),
    point(new THREE.Vector3(footprint.x, 0, 0), new THREE.Vector3(1, 0, 0))
  );
}

function baseFootprint(): { x: number; z: number } {
  return params.axisSymmetry ? { x: params.massD, z: params.massD } : { x: params.massD, z: params.massW };
}

function initialTopology(): AlgoTriangle[] {
  const base = baseTriangle();
  return topologyTransforms().map((transform) => transformTriangle(base, transform));
}

function topologyTransforms(): SymmetryTransform[] {
  if (params.axisSymmetry) {
    if (params.topology === "single") return ["identity"];
    if (params.topology === "double") return ["identity", "mirrorX"];
    return ["identity", "mirrorX", "mirrorZ", "mirrorXZ"];
  }
  if (params.topology === "single") return ["identity"];
  if (params.topology === "double") return ["identity", "mirror"];
  return ["identity", "mirror", "rotate", "rotateMirror"];
}

function transformTriangle(triangle: AlgoTriangle, transform: SymmetryTransform): AlgoTriangle {
  return {
    a: transformPointNode(triangle.a, transform),
    b: transformPointNode(triangle.b, transform),
    c: transformPointNode(triangle.c, transform),
    state: triangle.state,
    dirA: triangle.dirA,
    dirB: triangle.dirB,
    dirC: triangle.dirC
  };
}

function transformPointNode(pointNode: PointNode, transform: SymmetryTransform): PointNode {
  return point(
    transformVector(pointNode.position, transform, false),
    transformVector(pointNode.polarity, transform, true),
    pointNode.origin ? transformVector(pointNode.origin, transform, false) : undefined
  );
}

function transformVector(vector: THREE.Vector3, transform: SymmetryTransform, normalize: boolean): THREE.Vector3 {
  const transformed = vector.clone();
  if (transform === "mirrorX" || transform === "mirrorXZ") transformed.x *= -1;
  if (transform === "mirrorZ" || transform === "mirrorXZ") transformed.z *= -1;
  if (transform === "mirror" || transform === "rotateMirror") mirrorDiagonal(transformed);
  if (transform === "rotate" || transform === "rotateMirror") {
    transformed.x *= -1;
    transformed.z *= -1;
  }
  return normalize && transformed.lengthSq() > 0 ? transformed.normalize() : transformed;
}

function mirrorDiagonal(vector: THREE.Vector3): void {
  const x = vector.x;
  const z = vector.z;
  const footprint = baseFootprint();
  const xScale = footprint.z === 0 ? 1 : footprint.x / footprint.z;
  const zScale = footprint.x === 0 ? 1 : footprint.z / footprint.x;
  vector.x = z * xScale;
  vector.z = x * zScale;
}

function makeSeed(a: PointNode, b: PointNode, c: PointNode): AlgoTriangle {
  return { a, b, c, state: true, dirA: false, dirB: false, dirC: false };
}

function point(position: THREE.Vector3, polarity: THREE.Vector3, origin?: THREE.Vector3): PointNode {
  const safePosition = clampToGround(position);
  return {
    position: safePosition,
    polarity: polarity.clone().normalize(),
    origin: origin ? clampToGround(origin) : undefined
  };
}

function clampToGround(vector: THREE.Vector3): THREE.Vector3 {
  const clamped = vector.clone();
  clamped.y = Math.max(0, clamped.y);
  return clamped;
}

function subdivideOnce(
  triangle: AlgoTriangle,
  polarity: boolean,
  cache?: EdgeCache,
  level = 0
): AlgoTriangle[] {
  const activeEdges = activeDivisionEdges();
  const splitA = activeEdges.has("A");
  const splitB = activeEdges.has("B");
  const splitC = activeEdges.has("C");
  const ab = splitA
    ? edgeConstructCached(triangle.a, triangle.b, "A", polarity, triangle.dirA, cache, level)
    : edgeMidpoint(triangle.a, triangle.b);
  const bc = splitB
    ? edgeConstructCached(triangle.b, triangle.c, "B", polarity, triangle.dirB, cache, level)
    : edgeMidpoint(triangle.b, triangle.c);
  const ca = splitC
    ? edgeConstructCached(triangle.c, triangle.a, "C", polarity, triangle.dirC, cache, level)
    : edgeMidpoint(triangle.c, triangle.a);

  const children: AlgoTriangle[] = [
    {
      a: bc,
      b: ca,
      c: ab,
      state: !triangle.state,
      dirA: triangle.state ? !triangle.dirA : triangle.dirA,
      dirB: triangle.state ? triangle.dirB : !triangle.dirB,
      dirC: triangle.state ? triangle.dirC : !triangle.dirC
    },
    {
      a: triangle.a,
      b: ab,
      c: ca,
      state: triangle.state,
      dirA: triangle.state ? triangle.dirA : !triangle.dirA,
      dirB: triangle.state ? !triangle.dirB : triangle.dirB,
      dirC: triangle.state ? !triangle.dirC : triangle.dirC
    },
    {
      a: ab,
      b: triangle.b,
      c: bc,
      state: triangle.state,
      dirA: triangle.state ? !triangle.dirA : triangle.dirA,
      dirB: triangle.state ? triangle.dirB : !triangle.dirB,
      dirC: triangle.state ? !triangle.dirC : triangle.dirC
    },
    {
      a: ca,
      b: bc,
      c: triangle.c,
      state: triangle.state,
      dirA: triangle.state ? triangle.dirA : !triangle.dirA,
      dirB: triangle.state ? !triangle.dirB : triangle.dirB,
      dirC: triangle.state ? triangle.dirC : !triangle.dirC
    }
  ];

  return children.filter((child) => triangleArea(child) > 0.000001);
}

function activeDivisionEdges(): Set<"A" | "B" | "C"> {
  if (params.divisionMode === "a") return new Set(["A"]);
  if (params.divisionMode === "b") return new Set(["B"]);
  if (params.divisionMode === "c") return new Set(["C"]);
  if (params.divisionMode === "ab") return new Set(["A", "B"]);
  if (params.divisionMode === "bc") return new Set(["B", "C"]);
  if (params.divisionMode === "ca") return new Set(["C", "A"]);
  return new Set(["A", "B", "C"]);
}

function edgeMidpoint(a: PointNode, b: PointNode): PointNode {
  const origin = edgeOrigin(a, b, 0.5);
  const polarity = a.polarity.clone().lerp(b.polarity, 0.5);
  return point(origin, polarity.lengthSq() > 0 ? polarity : new THREE.Vector3(0, 1, 0), origin);
}

function subdivideRecursive(
  triangle: AlgoTriangle,
  level: number,
  polarity: boolean,
  output: AlgoTriangle[],
  cache: EdgeCache
): void {
  if (level >= params.recursion || longestEdge(triangle) < params.divThreshold) {
    output.push(triangle);
    return;
  }

  const children = subdivideOnce(triangle, polarity, cache, level);
  for (const child of children) subdivideRecursive(child, level + 1, !polarity, output, cache);
}

function edgeConstruct(
  a: PointNode,
  b: PointNode,
  edge: "A" | "B" | "C",
  polarity: boolean,
  dir: boolean
): PointNode {
  const settings = polarity ? expandSettings(edge, dir) : contractSettings(edge, dir);
  const origin = edgeOrigin(a, b, settings.pos);
  const verticalAB = params.expansiveABVertical && (edge === "A" || edge === "B");
  const pol =
    verticalAB
      ? new THREE.Vector3(0, 1, 0)
      : a.polarity.clone().lerp(b.polarity, settings.rot).normalize();

  if (!polarity && params.contractToExpansionCenters) {
    const target = expansionCenterForEdge(a, b, edge, dir);
    const toTarget = target.position.clone().sub(origin);
    if (toTarget.lengthSq() > 0.000001) {
      const directionToTarget = verticalAB
        ? new THREE.Vector3(0, Math.sign(toTarget.y) || 1, 0)
        : toTarget.normalize();
      const sign = settings.amp <= 0 ? 1 : -1;
      const signedDirection = directionToTarget.clone().multiplyScalar(sign);
      const displacement = signedDirection.clone().multiplyScalar(a.position.distanceTo(b.position) * Math.abs(settings.amp));
      return point(origin.clone().add(displacement), signedDirection, origin);
    }
  }

  const displacement = pol.clone().multiplyScalar(a.position.distanceTo(b.position) * settings.amp);
  return point(origin.clone().add(displacement), pol, origin);
}

function edgeConstructCached(
  a: PointNode,
  b: PointNode,
  edge: "A" | "B" | "C",
  polarity: boolean,
  dir: boolean,
  cache: EdgeCache | undefined,
  level: number
): PointNode {
  if (!cache) return edgeConstruct(a, b, edge, polarity, dir);

  const key = sharedEdgeKey(a.position, b.position, level, polarity);
  const existing = cache.get(key);
  if (existing) return existing;

  const created = edgeConstruct(a, b, edge, polarity, dir);
  cache.set(key, created);
  return created;
}

function sharedEdgeKey(
  a: THREE.Vector3,
  b: THREE.Vector3,
  level: number,
  polarity: boolean
): string {
  const ak = pointKey(a);
  const bk = pointKey(b);
  const edge = ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
  return `${level}:${polarity ? "expand" : "contract"}:${edge}`;
}

function expansionCenterForEdge(a: PointNode, b: PointNode, edge: "A" | "B" | "C", dir: boolean): PointNode {
  const settings = expandSettings(edge, dir);
  const origin = edgeOrigin(a, b, settings.pos);
  const pol =
    params.expansiveABVertical && (edge === "A" || edge === "B")
      ? new THREE.Vector3(0, 1, 0)
      : a.polarity.clone().lerp(b.polarity, settings.rot).normalize();
  const displacement = pol.clone().multiplyScalar(a.position.distanceTo(b.position) * settings.amp);
  return point(origin.clone().add(displacement), pol, origin);
}

function edgeOrigin(a: PointNode, b: PointNode, pos: number): THREE.Vector3 {
  return a.position.clone().lerp(b.position, pos);
}

function expandSettings(edge: "A" | "B" | "C", dir: boolean): { pos: number; amp: number; rot: number } {
  if (edge === "A") return { pos: dir ? params.posA : 1 - params.posA, amp: params.ampA, rot: dir ? params.rotA : 1 - params.rotA };
  if (edge === "B") return { pos: dir ? 1 - params.posB : params.posB, amp: params.ampB, rot: dir ? 1 - params.rotB : params.rotB };
  return { pos: dir ? params.posC : 1 - params.posC, amp: params.ampC, rot: dir ? params.rotC : 1 - params.rotC };
}

function contractSettings(edge: "A" | "B" | "C", dir: boolean): { pos: number; amp: number; rot: number } {
  if (edge === "A") return { pos: dir ? params.conPosA : 1 - params.conPosA, amp: params.conAmpA, rot: dir ? params.conRotA : 1 - params.conRotA };
  if (edge === "B") return { pos: dir ? 1 - params.conPosB : params.conPosB, amp: params.conAmpB, rot: dir ? 1 - params.conRotB : params.conRotB };
  return { pos: dir ? params.conPosC : 1 - params.conPosC, amp: params.conAmpC, rot: dir ? params.conRotC : 1 - params.conRotC };
}

function drawEdgeOperation(base: AlgoTriangle): void {
  clearGroup(edgeGroup);
  const polarity = !params.showContract;
  const ab = edgeConstruct(base.a, base.b, "A", polarity, base.dirA);
  const bc = edgeConstruct(base.b, base.c, "B", polarity, base.dirB);
  const ca = edgeConstruct(base.c, base.a, "C", polarity, base.dirC);
  edgeGroup.add(triangleMesh([base], 0xf2f0e8, 0.28));
  edgeGroup.add(polyline([base.a.position, base.b.position, base.c.position, base.a.position], 0x111111, params.edgeWeight));
  addEdgeMarker(edgeGroup, base.a, base.b, ab, 0xff4f4f);
  addEdgeMarker(edgeGroup, base.b, base.c, bc, 0x44d17a);
  addEdgeMarker(edgeGroup, base.c, base.a, ca, 0x4aa3ff);
  addPointDebug(edgeGroup, [base.a, base.b, base.c, ab, bc, ca]);
  frame(edgeView, edgeGroup, new THREE.Vector3(0.8, 0.45, 1));
}

function addEdgeMarker(group: THREE.Group, a: PointNode, b: PointNode, p: PointNode, color: number): void {
  const origin = p.origin ?? edgeOrigin(a, b, 0.5);
  group.add(sphere(origin, Math.max(params.massH, params.massD) * 0.01, color));
  group.add(polyline([origin, p.position], color, Math.max(2, params.edgeWeight)));
  group.add(sphere(p.position, Math.max(params.massH, params.massD) * 0.018, color));
}

function refineRecursiveTriangles(triangles: AlgoTriangle[]): RenderTriangle[] {
  let mesh = indexedMeshFromAlgo(triangles);
  if (params.refineMode !== "off") {
    for (let step = 0; step < params.refineSteps; step++) {
      mesh = subdivideMesh(mesh, params.refineMode, params.refineAmount);
      mesh = smoothMesh(mesh, params.refineMode, params.refineAmount);
    }
  }
  return renderTrianglesFromMesh(mesh);
}

function indexedMeshFromAlgo(triangles: AlgoTriangle[]): IndexedMesh {
  const vertices: THREE.Vector3[] = [];
  const faces: MeshFace[] = [];
  const indexByKey = new Map<string, number>();

  const getIndex = (position: THREE.Vector3): number => {
    const key = pointKey(position);
    const existing = indexByKey.get(key);
    if (existing !== undefined) return existing;
    const index = vertices.length;
    vertices.push(position.clone());
    indexByKey.set(key, index);
    return index;
  };

  for (const triangle of triangles) {
    faces.push([getIndex(triangle.a.position), getIndex(triangle.b.position), getIndex(triangle.c.position)]);
  }

  return {
    vertices,
    faces,
    fixed: new Set(vertices.map((_, index) => index))
  };
}

function subdivideMesh(mesh: IndexedMesh, mode: Params["refineMode"], amount: number): IndexedMesh {
  const vertices = mesh.vertices.map((vertex) => vertex.clone());
  const faces: MeshFace[] = [];
  const fixed = new Set(mesh.fixed);
  const midpointByEdge = new Map<string, number>();
  const normals = meshVertexNormals(mesh);

  const midpoint = (ia: number, ib: number): number => {
    const key = ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`;
    const existing = midpointByEdge.get(key);
    if (existing !== undefined) return existing;

    const a = mesh.vertices[ia];
    const b = mesh.vertices[ib];
    const position = a.clone().add(b).multiplyScalar(0.5);
    if (mode === "fixedCorners" && amount !== 0) {
      const normal = normals[ia].clone().add(normals[ib]).normalize();
      position.addScaledVector(normal, a.distanceTo(b) * amount * params.refineEdgeInflate);
    }
    const index = vertices.length;
    vertices.push(clampToGround(position));
    midpointByEdge.set(key, index);
    return index;
  };

  for (const [ia, ib, ic] of mesh.faces) {
    const iab = midpoint(ia, ib);
    const ibc = midpoint(ib, ic);
    const ica = midpoint(ic, ia);
    faces.push([ia, iab, ica], [iab, ib, ibc], [ica, ibc, ic], [iab, ibc, ica]);
  }

  return { vertices, faces, fixed };
}

function smoothMesh(mesh: IndexedMesh, mode: Params["refineMode"], amount: number): IndexedMesh {
  const neighbors = meshNeighbors(mesh);
  const normals = meshVertexNormals(mesh);
  const preserveFixed = mode === "fixedCorners";
  const modeRelax = mode === "smooth" ? 1 : 0.55;
  const smoothStrength = clamp(params.refineRelax * modeRelax, 0, 1);
  const normalStrength = params.refineFaceInflate;
  const vertices = mesh.vertices.map((vertex, index) => {
    if (preserveFixed && mesh.fixed.has(index)) return vertex.clone();
    const linked = neighbors[index];
    if (!linked || linked.size === 0) return vertex.clone();

    const average = new THREE.Vector3();
    let averageEdge = 0;
    for (const neighbor of linked) {
      average.add(mesh.vertices[neighbor]);
      averageEdge += vertex.distanceTo(mesh.vertices[neighbor]);
    }
    average.multiplyScalar(1 / linked.size);
    averageEdge /= linked.size;

    return clampToGround(vertex
      .clone()
      .lerp(average, smoothStrength)
      .addScaledVector(normals[index], averageEdge * amount * normalStrength));
  });

  return {
    vertices,
    faces: mesh.faces.map((face) => [...face] as MeshFace),
    fixed: new Set(mesh.fixed)
  };
}

function meshNeighbors(mesh: IndexedMesh): Set<number>[] {
  const neighbors = mesh.vertices.map(() => new Set<number>());
  for (const [ia, ib, ic] of mesh.faces) {
    neighbors[ia].add(ib).add(ic);
    neighbors[ib].add(ia).add(ic);
    neighbors[ic].add(ia).add(ib);
  }
  return neighbors;
}

function meshVertexNormals(mesh: IndexedMesh): THREE.Vector3[] {
  const center = meshCenter(mesh.vertices);
  const normals = mesh.vertices.map(() => new THREE.Vector3());
  for (const [ia, ib, ic] of mesh.faces) {
    const a = mesh.vertices[ia];
    const b = mesh.vertices[ib];
    const c = mesh.vertices[ic];
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() === 0) continue;
    const faceCenter = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(faceCenter.sub(center)) < 0) normal.negate();
    normals[ia].add(normal);
    normals[ib].add(normal);
    normals[ic].add(normal);
  }
  return normals.map((normal) => (normal.lengthSq() > 0 ? normal.normalize() : new THREE.Vector3(0, 1, 0)));
}

function meshCenter(vertices: THREE.Vector3[]): THREE.Vector3 {
  const center = new THREE.Vector3();
  for (const vertex of vertices) center.add(vertex);
  return vertices.length > 0 ? center.multiplyScalar(1 / vertices.length) : center;
}

function renderTrianglesFromMesh(mesh: IndexedMesh): RenderTriangle[] {
  return mesh.faces.map(([ia, ib, ic]) => ({
    a: mesh.vertices[ia],
    b: mesh.vertices[ib],
    c: mesh.vertices[ic]
  }));
}

function drawDivisionPreview(preview: DivisionPreview, triangles: RenderTriangle[], debugTriangles: AlgoTriangle[]): void {
  clearGroup(preview.group);
  const geometry = renderTriangleGeometry(triangles);
  preview.group.add(new THREE.Mesh(geometry, material(0xf2f0e8, true)));
  preview.group.add(edgesFor(geometry, 0x111111, 0.35));
  addTrianglePointDebug(preview.group, debugTriangles);
  frame(preview.view, preview.group, new THREE.Vector3(0.85, 0.5, 1));
}

function addTrianglePointDebug(group: THREE.Group, triangles: AlgoTriangle[]): void {
  if (!params.showPointNormals) return;
  const points = new Map<string, PointNode>();
  for (const triangle of triangles) {
    [triangle.a, triangle.b, triangle.c].forEach((pointNode) => {
      points.set(pointKey(pointNode.position), pointNode);
    });
  }
  addPointDebug(group, [...points.values()]);
}

function addPointDebug(group: THREE.Group, points: PointNode[]): void {
  if (!params.showPointNormals) return;
  const scale = Math.max(params.massH, params.massD, params.massW) * 0.12;
  const radius = Math.max(params.massH, params.massD, params.massW) * 0.012;
  for (const pointNode of points) {
    const color = polarityColor(pointNode.polarity);
    group.add(sphere(pointNode.position, radius, color));
    group.add(polyline([pointNode.position, pointNode.position.clone().addScaledVector(pointNode.polarity, scale)], color, 1));
  }
}

function polarityColor(polarity: THREE.Vector3): number {
  const r = Math.round((Math.abs(polarity.x) * 0.7 + 0.25) * 255);
  const g = Math.round((Math.max(polarity.y, 0) * 0.75 + 0.2) * 255);
  const b = Math.round((Math.abs(polarity.z) * 0.7 + 0.25) * 255);
  return (r << 16) + (g << 8) + b;
}

function pointKey(pointValue: THREE.Vector3): string {
  const q = (value: number) => Math.round(value * 10000) / 10000;
  return `${q(pointValue.x)},${q(pointValue.y)},${q(pointValue.z)}`;
}

function triangleMesh(triangles: AlgoTriangle[], color: number, opacity: number): THREE.Mesh {
  return new THREE.Mesh(triangleGeometry(triangles), material(color, true, opacity));
}

function triangleGeometry(triangles: AlgoTriangle[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const tri of triangles) {
    positions.push(
      tri.a.position.x,
      tri.a.position.y,
      tri.a.position.z,
      tri.b.position.x,
      tri.b.position.y,
      tri.b.position.z,
      tri.c.position.x,
      tri.c.position.y,
      tri.c.position.z
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function renderTriangleGeometry(triangles: RenderTriangle[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const tri of triangles) {
    positions.push(
      tri.a.x,
      tri.a.y,
      tri.a.z,
      tri.b.x,
      tri.b.y,
      tri.b.z,
      tri.c.x,
      tri.c.y,
      tri.c.z
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function polyline(points: THREE.Vector3[], color: number, width = 1): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, linewidth: width }));
}

function sphere(position: THREE.Vector3, radius: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  mesh.position.copy(position);
  return mesh;
}

function material(color: number, doubleSide: boolean, opacity = 1): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.68,
    metalness: 0.02,
    flatShading: true,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: opacity < 1,
    opacity
  });
}

function edgesFor(geometry: THREE.BufferGeometry, color: number, opacity: number): THREE.Object3D {
  const weight = Math.max(1, Math.round(params.edgeWeight));
  const group = new THREE.Group();
  const offsetScale = Math.max(params.massH, params.massD, params.massW) * 0.0007;
  const offsets = edgeOffsets(weight, offsetScale);
  for (const offset of offsets) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 16),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity + weight * 0.04), linewidth: weight })
    );
    edges.position.copy(offset);
    group.add(edges);
  }
  return group;
}

function edgeOffsets(weight: number, scale: number): THREE.Vector3[] {
  const offsets = [new THREE.Vector3()];
  const pattern = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1)
  ];
  for (let i = 1; i < weight; i++) offsets.push(pattern[(i - 1) % pattern.length].clone().multiplyScalar(scale));
  return offsets;
}

function longestEdge(triangle: AlgoTriangle): number {
  return Math.max(
    triangle.a.position.distanceTo(triangle.b.position),
    triangle.b.position.distanceTo(triangle.c.position),
    triangle.c.position.distanceTo(triangle.a.position)
  );
}

function triangleArea(triangle: AlgoTriangle): number {
  return triangle.b.position
    .clone()
    .sub(triangle.a.position)
    .cross(triangle.c.position.clone().sub(triangle.a.position))
    .length() * 0.5;
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
  }
}

function frame(view: View, object: THREE.Object3D, direction: THREE.Vector3): void {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, 1);
  view.camera.position.copy(sphere.center).addScaledVector(direction.normalize(), radius * 2.6);
  view.camera.near = radius / 200;
  view.camera.far = radius * 30;
  view.camera.lookAt(sphere.center);
  view.camera.updateProjectionMatrix();
  view.controls?.target.copy(sphere.center);
}

function resizeView(view: View): void {
  const canvas = view.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
}

function resizeAll(): void {
  allViews().forEach(resizeView);
}

function animate(): void {
  requestAnimationFrame(animate);
  resizeAll();
  allViews().forEach((view) => {
    view.controls?.update();
    view.renderer.render(view.scene, view.camera);
  });
}

function allViews(): View[] {
  return [edgeView, ...divisionPreviews.map((preview) => preview.view)];
}
