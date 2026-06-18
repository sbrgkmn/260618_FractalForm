import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type PointNode = {
  position: THREE.Vector3;
  polarity: THREE.Vector3;
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

type Params = {
  topology: "single" | "double" | "quad";
  massH: number;
  massD: number;
  massW: number;
  recursion: number;
  recursion2: number;
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
  topPos: number;
  topAmp: number;
  topRot: number;
  showContract: boolean;
  expansiveABVertical: boolean;
  showPointNormals: boolean;
  contractToExpansionCenters: boolean;
};

type View = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls?: OrbitControls;
};

const params: Params = {
  topology: "quad",
  massH: 51,
  massD: 40,
  massW: 40,
  recursion: 4,
  recursion2: 2,
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
  topPos: 0.49,
  topAmp: -0.72,
  topRot: 0.48,
  showContract: false,
  expansiveABVertical: true,
  showPointNormals: false,
  contractToExpansionCenters: true
};

const targetCount = document.querySelector<HTMLElement>("#targetCount");
const triangleCount = document.querySelector<HTMLElement>("#triangleCount");
const warning = document.querySelector<HTMLElement>("#warning");
const controlsForm = document.querySelector<HTMLFormElement>("#controls");

const targetView = makeView("targetCanvas", true);
const edgeView = makeView("edgeCanvas", false);
const subdivisionView = makeView("subdivisionCanvas", false);
const recursiveView = makeView("recursiveCanvas", true);

const targetGroup = new THREE.Group();
const edgeGroup = new THREE.Group();
const subdivisionGroup = new THREE.Group();
const recursiveGroup = new THREE.Group();
targetView.scene.add(targetGroup);
edgeView.scene.add(edgeGroup);
subdivisionView.scene.add(subdivisionGroup);
recursiveView.scene.add(recursiveGroup);

addLights(targetView.scene);
addLights(edgeView.scene);
addLights(subdivisionView.scene);
addLights(recursiveView.scene);

buildControls();
loadTarget();
rebuildLab();
window.addEventListener("resize", resizeAll);
animate();

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
    slider("massH", "Mass H", 10, 80, 1),
    slider("massD", "Mass D", 5, 50, 1),
    slider("massW", "Mass W", 5, 50, 1),
    slider("recursion", "Recursion", 0, 6, 1),
    slider("recursion2", "Top refine", 0, 4, 1),
    slider("divThreshold", "Min edge", 0, 12, 0.1)
  ]);

  addFieldset("Rule Toggles", [
    checkbox("expansiveABVertical", "Expand A/B vertical"),
    checkbox("showPointNormals", "Show point normals"),
    checkbox("contractToExpansionCenters", "Contract to expand centers")
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

  addFieldset("Crown Stage", [
    slider("topPos", "Top Pos", 0, 1, 0.01),
    slider("topAmp", "Top Amp", -0.8, 0.8, 0.01),
    slider("topRot", "Top Rot", 0, 1, 0.01),
    button("Reset", () => {
      Object.assign(params, {
        posA: 0.5,
        ampA: 0.74,
        rotA: 0.5,
        posB: 0.5,
        ampB: 0.12,
        rotB: 0.5,
        posC: 0.56,
        ampC: 0.43,
        rotC: 0.57,
        conAmpA: 0.1,
        conAmpB: -0.1,
        conAmpC: -0.1,
        topPos: 0.49,
        topAmp: -0.72,
        topRot: 0.48,
        expansiveABVertical: true,
        showPointNormals: false,
        contractToExpansionCenters: true,
        showContract: false
      });
      buildControls();
      rebuildLab();
    })
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

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function loadTarget(): void {
  const loader = new STLLoader();
  loader.load(
    "/Target_4.stl",
    (geometry) => {
      geometry.rotateX(-Math.PI / 2);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -box.min.y, -center.z);
      }
      geometry.computeBoundingSphere();
      clearGroup(targetGroup);
      const mesh = new THREE.Mesh(geometry, material(0xf2f0e8, true));
      targetGroup.add(mesh);
      targetGroup.add(edgesFor(geometry, 0x171717, 0.38));
      frame(targetView, targetGroup, new THREE.Vector3(0.82, 0.36, 1));
      const position = geometry.getAttribute("position");
      if (targetCount) targetCount.textContent = Math.round(position.count / 3).toLocaleString();
    },
    undefined,
    () => {
      if (warning) warning.textContent = "Could not load public/Target_4.stl";
    }
  );
}

function rebuildLab(): void {
  const base = baseTriangle();
  const seeds = initialTopology();
  const oneStepCache: EdgeCache = new Map();
  const oneStep = seeds.flatMap((triangle) => subdivideOnce(triangle, !params.showContract, oneStepCache, 0));
  const recursiveTriangles: AlgoTriangle[] = [];
  const recursiveCache: EdgeCache = new Map();
  for (const seed of seeds) subdivideRecursive(seed, 0, true, recursiveTriangles, recursiveCache);

  drawEdgeOperation(base);
  drawSubdivision(seeds, oneStep);
  drawRecursive(recursiveTriangles);
  if (triangleCount) triangleCount.textContent = recursiveTriangles.length.toLocaleString();
}

function baseTriangle(): AlgoTriangle {
  return initialTopology()[0];
}

function initialTopology(): AlgoTriangle[] {
  const apex = point(new THREE.Vector3(0, params.massH, 0), new THREE.Vector3(0, 1, 0));
  const corners = [
    point(new THREE.Vector3(-params.massD, 0, -params.massW), new THREE.Vector3(-1, 0, -1)),
    point(new THREE.Vector3(params.massD, 0, -params.massW), new THREE.Vector3(1, 0, -1)),
    point(new THREE.Vector3(params.massD, 0, params.massW), new THREE.Vector3(1, 0, 1)),
    point(new THREE.Vector3(-params.massD, 0, params.massW), new THREE.Vector3(-1, 0, 1))
  ];

  // Alternate face orientation so every shared pyramid rib uses the same local edge rule on both sides.
  const faces = [
    makeSeed(corners[3], apex, corners[2]),
    makeSeed(corners[1], apex, corners[2]),
    makeSeed(corners[1], apex, corners[0]),
    makeSeed(corners[3], apex, corners[0])
  ];

  if (params.topology === "single") return [faces[0]];
  if (params.topology === "double") return [faces[0], faces[1]];
  return faces;
}

function makeSeed(a: PointNode, b: PointNode, c: PointNode): AlgoTriangle {
  return { a, b, c, state: true, dirA: false, dirB: false, dirC: false };
}

function point(position: THREE.Vector3, polarity: THREE.Vector3): PointNode {
  return {
    position,
    polarity: polarity.clone().normalize()
  };
}

function subdivideOnce(
  triangle: AlgoTriangle,
  polarity: boolean,
  cache?: EdgeCache,
  level = 0
): AlgoTriangle[] {
  const ab = edgeConstructCached(triangle.a, triangle.b, "A", polarity, triangle.dirA, false, cache, level);
  const bc = edgeConstructCached(triangle.b, triangle.c, "B", polarity, triangle.dirB, false, cache, level);
  const ca = edgeConstructCached(triangle.c, triangle.a, "C", polarity, triangle.dirC, false, cache, level);

  return [
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
}

function subdivideRecursive(
  triangle: AlgoTriangle,
  level: number,
  polarity: boolean,
  output: AlgoTriangle[],
  cache: EdgeCache
): void {
  const maxLevel = params.recursion + params.recursion2;
  if (level >= maxLevel || longestEdge(triangle) < params.divThreshold) {
    output.push(triangle);
    return;
  }

  const crownStage = level >= params.recursion;
  const children = crownStage ? subdivideTop(triangle, polarity, cache, level) : subdivideOnce(triangle, polarity, cache, level);
  for (const child of children) subdivideRecursive(child, level + 1, !polarity, output, cache);
}

function subdivideTop(
  triangle: AlgoTriangle,
  polarity: boolean,
  cache?: EdgeCache,
  level = 0
): AlgoTriangle[] {
  const ab = edgeConstructCached(triangle.a, triangle.b, "A", polarity, triangle.dirA, true, cache, level);
  const bc = edgeConstructCached(triangle.b, triangle.c, "B", polarity, triangle.dirB, true, cache, level);
  const ca = edgeConstructCached(triangle.c, triangle.a, "C", polarity, triangle.dirC, true, cache, level);
  return [
    { a: bc, b: ca, c: ab, state: true, dirA: false, dirB: false, dirC: false },
    { a: triangle.a, b: ab, c: ca, state: true, dirA: false, dirB: false, dirC: false },
    { a: ab, b: triangle.b, c: bc, state: true, dirA: false, dirB: false, dirC: false },
    { a: ca, b: bc, c: triangle.c, state: true, dirA: false, dirB: false, dirC: false }
  ];
}

function edgeConstruct(
  a: PointNode,
  b: PointNode,
  edge: "A" | "B" | "C",
  polarity: boolean,
  dir: boolean,
  crown: boolean
): PointNode {
  const settings = crown
    ? topSettings(dir)
    : polarity
      ? expandSettings(edge, dir)
      : contractSettings(edge, dir);
  const origin = a.position.clone().lerp(b.position, settings.pos);
  const pol =
    polarity && !crown && params.expansiveABVertical && (edge === "A" || edge === "B")
      ? new THREE.Vector3(0, 1, 0)
      : a.polarity.clone().lerp(b.polarity, settings.rot).normalize();

  if (!polarity && !crown && params.contractToExpansionCenters) {
    const target = expansionCenterForEdge(a, b, edge, dir);
    const toTarget = target.position.clone().sub(origin);
    if (toTarget.lengthSq() > 0.000001) {
      const directionToTarget = toTarget.normalize();
      const sign = settings.amp <= 0 ? 1 : -1;
      const displacement = directionToTarget.multiplyScalar(a.position.distanceTo(b.position) * Math.abs(settings.amp) * sign);
      return point(origin.add(displacement), directionToTarget.multiplyScalar(sign));
    }
  }

  const displacement = pol.clone().multiplyScalar(a.position.distanceTo(b.position) * settings.amp);
  return point(origin.add(displacement), pol);
}

function edgeConstructCached(
  a: PointNode,
  b: PointNode,
  edge: "A" | "B" | "C",
  polarity: boolean,
  dir: boolean,
  crown: boolean,
  cache: EdgeCache | undefined,
  level: number
): PointNode {
  if (!cache) return edgeConstruct(a, b, edge, polarity, dir, crown);

  const key = sharedEdgeKey(a.position, b.position, level, polarity, crown);
  const existing = cache.get(key);
  if (existing) return existing;

  const created = edgeConstruct(a, b, edge, polarity, dir, crown);
  cache.set(key, created);
  return created;
}

function sharedEdgeKey(
  a: THREE.Vector3,
  b: THREE.Vector3,
  level: number,
  polarity: boolean,
  crown: boolean
): string {
  const ak = pointKey(a);
  const bk = pointKey(b);
  const edge = ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
  return `${level}:${polarity ? "expand" : "contract"}:${crown ? "crown" : "body"}:${edge}`;
}

function expansionCenterForEdge(a: PointNode, b: PointNode, edge: "A" | "B" | "C", dir: boolean): PointNode {
  const settings = expandSettings(edge, dir);
  const origin = a.position.clone().lerp(b.position, settings.pos);
  const pol =
    params.expansiveABVertical && (edge === "A" || edge === "B")
      ? new THREE.Vector3(0, 1, 0)
      : a.polarity.clone().lerp(b.polarity, settings.rot).normalize();
  const displacement = pol.clone().multiplyScalar(a.position.distanceTo(b.position) * settings.amp);
  return point(origin.add(displacement), pol);
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

function topSettings(dir: boolean): { pos: number; amp: number; rot: number } {
  return { pos: dir ? params.topPos : 1 - params.topPos, amp: params.topAmp, rot: params.topRot };
}

function drawEdgeOperation(base: AlgoTriangle): void {
  clearGroup(edgeGroup);
  const polarity = !params.showContract;
  const ab = edgeConstruct(base.a, base.b, "A", polarity, base.dirA, false);
  const bc = edgeConstruct(base.b, base.c, "B", polarity, base.dirB, false);
  const ca = edgeConstruct(base.c, base.a, "C", polarity, base.dirC, false);
  edgeGroup.add(triangleMesh([base], 0xf2f0e8, 0.28));
  edgeGroup.add(polyline([base.a.position, base.b.position, base.c.position, base.a.position], 0x111111, 1));
  addEdgeMarker(edgeGroup, base.a, base.b, ab, 0xff4f4f);
  addEdgeMarker(edgeGroup, base.b, base.c, bc, 0x44d17a);
  addEdgeMarker(edgeGroup, base.c, base.a, ca, 0x4aa3ff);
  addPointDebug(edgeGroup, [base.a, base.b, base.c, ab, bc, ca]);
  frame(edgeView, edgeGroup, new THREE.Vector3(0.8, 0.45, 1));
}

function addEdgeMarker(group: THREE.Group, a: PointNode, b: PointNode, p: PointNode, color: number): void {
  const origin = a.position.clone().lerp(b.position, 0.5);
  group.add(polyline([origin, p.position], color, 2));
  group.add(sphere(p.position, Math.max(params.massH, params.massD) * 0.018, color));
}

function drawSubdivision(base: AlgoTriangle[], children: AlgoTriangle[]): void {
  clearGroup(subdivisionGroup);
  subdivisionGroup.add(triangleMesh(base, 0x202526, 0.08));
  subdivisionGroup.add(triangleMesh(children, 0xf2f0e8, 0.78));
  subdivisionGroup.add(edgesFor(triangleGeometry(children), 0x111111, 0.55));
  addTrianglePointDebug(subdivisionGroup, children);
  frame(subdivisionView, subdivisionGroup, new THREE.Vector3(0.8, 0.45, 1));
}

function drawRecursive(triangles: AlgoTriangle[]): void {
  clearGroup(recursiveGroup);
  const geometry = triangleGeometry(triangles);
  recursiveGroup.add(new THREE.Mesh(geometry, material(0xf2f0e8, true)));
  recursiveGroup.add(edgesFor(geometry, 0x111111, 0.35));
  addTrianglePointDebug(recursiveGroup, triangles);
  frame(recursiveView, recursiveGroup, new THREE.Vector3(0.85, 0.5, 1));
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

function edgesFor(geometry: THREE.BufferGeometry, color: number, opacity: number): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 16),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
}

function longestEdge(triangle: AlgoTriangle): number {
  return Math.max(
    triangle.a.position.distanceTo(triangle.b.position),
    triangle.b.position.distanceTo(triangle.c.position),
    triangle.c.position.distanceTo(triangle.a.position)
  );
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
  [targetView, edgeView, subdivisionView, recursiveView].forEach(resizeView);
}

function animate(): void {
  requestAnimationFrame(animate);
  resizeAll();
  [targetView, edgeView, subdivisionView, recursiveView].forEach((view) => {
    view.controls?.update();
    view.renderer.render(view.scene, view.camera);
  });
}
