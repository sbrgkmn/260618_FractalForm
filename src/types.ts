import * as THREE from "three";

export type Triangle = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  level: number;
};

export type TriangulationMode = "spireFan" | "flatPatch";

export type MaterialMode =
  | "matte white"
  | "gray clay"
  | "black silhouette"
  | "translucent glass";

export type BackgroundMode = "light gray" | "dark gray" | "black" | "white";

export type FractalParams = {
  recursionDepth: number;
  baseSize: number;
  pyramidHeight: number;
  seed: number;
  splitRatio: number;
  kochAngle: number;
  normalExtrusion: number;
  verticalBias: number;
  buttressBias: number;
  centralLift: number;
  centralSpireBias: number;
  centralButtressBias: number;
  levelDecay: number;
  randomness: number;
  angleJitter: number;
  heightJitter: number;
  splitJitter: number;
  asymmetry: number;
  gothicVerticality: number;
  spireTaper: number;
  ridgeSharpness: number;
  buttressSpread: number;
  axisAttractorStrength: number;
  radialClusterStrength: number;
  terraceQuantization: number;
  verticalCoherence: number;
  shellClosure: number;
  branchAngleLimit: number;
  triangulationMode: TriangulationMode;
  symmetryMode: boolean;
  capBase: boolean;
  maxTriangles: number;
};

export type DisplayParams = {
  smoothNormals: boolean;
  doubleSidedMaterial: boolean;
  wireframe: boolean;
  showEdges: boolean;
  showAxes: boolean;
  materialMode: MaterialMode;
  background: BackgroundMode;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
  autoRotate: boolean;
  cameraMode: "perspective" | "orthographic";
};

export type AppParams = FractalParams & DisplayParams;

export type MeshResult = {
  geometry: THREE.BufferGeometry;
  triangles: Triangle[];
  triangleCount: number;
  generationTimeMs: number;
  clamped: boolean;
};

export type AxisSegment = {
  start: THREE.Vector3;
  end: THREE.Vector3;
};
