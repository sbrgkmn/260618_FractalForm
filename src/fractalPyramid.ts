import * as THREE from "three";
import { FractalParams, MeshResult, Triangle } from "./types";
import { SeededRandom, clamp, lerp } from "./random";

type PolarPoint = {
  position: THREE.Vector3;
  polarity: THREE.Vector3;
};

type PolarTriangle = {
  a: PolarPoint;
  b: PolarPoint;
  c: PolarPoint;
  state: boolean;
  dirA: boolean;
  dirB: boolean;
  dirC: boolean;
};

type BuildState = {
  triangles: Triangle[];
  edgePoints: Map<string, PolarPoint>;
  clamped: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);
const MIN_AREA = 0.000001;

export function generateFractalMesh(params: FractalParams): MeshResult {
  const started = performance.now();
  const state: BuildState = {
    triangles: [],
    edgePoints: new Map(),
    clamped: false
  };

  const seeds = createPolarSeed(params);
  for (const triangle of seeds) {
    subdividePolarTriangle(triangle, 0, true, params, state);
    if (state.clamped) break;
  }

  const geometry = buildIndexedGeometry(state.triangles);
  return {
    geometry,
    triangles: state.triangles,
    triangleCount: state.triangles.length,
    generationTimeMs: performance.now() - started,
    clamped: state.clamped
  };
}

function createPolarSeed(params: FractalParams): PolarTriangle[] {
  const rng = new SeededRandom(params.seed);
  const sides = params.symmetryMode ? 8 : 10;
  const baseRadius = params.baseSize * 0.52;
  const height = params.pyramidHeight;
  const symmetryPeriod = params.symmetryMode ? Math.max(1, sides / 4) : sides;
  const moduleNoise = Array.from({ length: symmetryPeriod }, () => ({
    radius: rng.range(-0.08, 0.08) * params.randomness,
    shoulder: rng.range(-0.12, 0.14) * params.randomness,
    crown: rng.range(-0.1, 0.18) * params.randomness,
    spire: rng.range(-0.22, 0.3) * params.randomness
  }));

  const base: PolarPoint[] = [];
  const shoulder: PolarPoint[] = [];
  const crown: PolarPoint[] = [];
  const tips: PolarPoint[] = [];
  const center = point(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0));

  for (let i = 0; i < sides; i++) {
    const theta = (i / sides) * Math.PI * 2 + Math.PI / 4;
    const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const noise = moduleNoise[i % symmetryPeriod];
    const alternatingRib = i % 2 === 0 ? 1 : 0.72;
    const baseR = baseRadius * (1 + noise.radius);
    const shoulderR = baseRadius * (0.74 + noise.shoulder + params.buttressBias * 0.12);
    const crownR = baseRadius * (0.28 + noise.crown + params.radialClusterStrength * 0.16) * alternatingRib;
    const shoulderY = height * clamp(0.52 + params.centralLift * 0.08, 0.42, 0.66);
    const crownY = height * clamp(0.76 + params.verticalBias * 0.045, 0.72, 0.9);
    const tipY = height * (0.93 + params.centralSpireBias * 0.06 + noise.spire);
    const tipR = baseRadius * (0.06 + (i % 2 === 0 ? 0.08 : 0.18) * (1 - params.shellClosure * 0.35));

    base.push(point(radial.clone().multiplyScalar(baseR), radial.clone().lerp(UP, 0.08)));
    shoulder.push(
      point(
        radial.clone().multiplyScalar(shoulderR).setY(shoulderY),
        radial.clone().lerp(UP, 0.22 + params.verticalCoherence * 0.2)
      )
    );
    crown.push(
      point(
        radial.clone().multiplyScalar(crownR).setY(crownY),
        radial.clone().lerp(UP, 0.46 + params.verticalCoherence * 0.24)
      )
    );
    tips.push(point(radial.clone().multiplyScalar(tipR).setY(tipY), UP));
  }

  const seeds: PolarTriangle[] = [];
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    seeds.push(
      tri(base[i], base[next], shoulder[next], true),
      tri(base[i], shoulder[next], shoulder[i], true),
      tri(shoulder[i], shoulder[next], crown[next], true),
      tri(shoulder[i], crown[next], crown[i], true),
      tri(crown[i], crown[next], tips[i], true)
    );

    if (params.capBase) {
      seeds.push(tri(center, base[next], base[i], true));
    }
  }

  return seeds;
}

function subdividePolarTriangle(
  triangle: PolarTriangle,
  level: number,
  polarity: boolean,
  params: FractalParams,
  state: BuildState
): void {
  if (state.triangles.length >= params.maxTriangles) {
    state.clamped = true;
    return;
  }

  if (level >= params.recursionDepth || polarArea(triangle) < MIN_AREA) {
    addFinalTriangle(triangle, level, params, state);
    return;
  }

  const ab = edgePoint(triangle.a, triangle.b, edgeProfile(params, "A", polarity, triangle.dirA), level, params, state);
  const bc = edgePoint(triangle.b, triangle.c, edgeProfile(params, "B", polarity, triangle.dirB), level, params, state);
  const ca = edgePoint(triangle.c, triangle.a, edgeProfile(params, "C", polarity, triangle.dirC), level, params, state);

  const children: PolarTriangle[] = [
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

  for (const child of children) {
    subdividePolarTriangle(child, level + 1, !polarity, params, state);
    if (state.clamped) return;
  }
}

function edgeProfile(
  params: FractalParams,
  edge: "A" | "B" | "C",
  polarity: boolean,
  direction: boolean
): { position: number; amplitude: number; rotation: number } {
  const edgeOffset = edge === "B" ? 0.045 : edge === "C" ? -0.025 : 0;
  const basePosition = clamp(params.splitRatio + edgeOffset, 0.18, 0.82);
  const position = direction ? 1 - basePosition : basePosition;
  const expand = params.normalExtrusion * 0.22 + params.buttressBias * 0.045;
  const contract = -params.shellClosure * 0.055;
  const amplitude = polarity ? expand : contract;
  const rotation = clamp(
    0.5 + (direction ? 1 : -1) * (params.ridgeSharpness - 0.5) * 0.26,
    0.08,
    0.92
  );
  return { position, amplitude, rotation };
}

function edgePoint(
  a: PolarPoint,
  b: PolarPoint,
  profile: { position: number; amplitude: number; rotation: number },
  level: number,
  params: FractalParams,
  state: BuildState
): PolarPoint {
  const key = edgeKey(a.position, b.position, level);
  const cached = state.edgePoints.get(key);
  if (cached) return cached;

  const origin = new THREE.Vector3().lerpVectors(a.position, b.position, profile.position);
  const edgeLength = a.position.distanceTo(b.position);
  const decay = Math.pow(params.levelDecay, level);
  const interpolatedPolarity = a.polarity.clone().lerp(b.polarity, profile.rotation).normalize();
  const displacement = constrainPolarity(interpolatedPolarity, params)
    .multiplyScalar(edgeLength * profile.amplitude * decay);
  const candidate = origin.clone().add(displacement);
  const shaped = shapeToTowerEnvelope(candidate, params);
  const result = point(shaped, interpolatedPolarity);
  state.edgePoints.set(key, result);
  return result;
}

function constrainPolarity(polarity: THREE.Vector3, params: FractalParams): THREE.Vector3 {
  const constrained = polarity.clone();
  const lateralScale = 1 - params.verticalCoherence * 0.72;
  constrained.x *= lateralScale;
  constrained.z *= lateralScale;
  if (constrained.y > 0) {
    constrained.y *= 1 + params.gothicVerticality * 0.28;
  }

  const maxAngle = THREE.MathUtils.degToRad(params.branchAngleLimit);
  const vertical = Math.max(Math.abs(constrained.y), 0.0001);
  const lateral = new THREE.Vector2(constrained.x, constrained.z);
  const maxLateral = Math.tan(maxAngle) * vertical;
  if (lateral.length() > maxLateral) {
    lateral.setLength(maxLateral);
    constrained.x = lateral.x;
    constrained.z = lateral.y;
  }

  if (constrained.lengthSq() < 0.000001) return UP.clone();
  return constrained.normalize();
}

function shapeToTowerEnvelope(position: THREE.Vector3, params: FractalParams): THREE.Vector3 {
  const shaped = position.clone();
  const h = Math.max(params.pyramidHeight, 0.0001);
  const t = clamp(shaped.y / h, 0, 1.6);
  const radius = Math.hypot(shaped.x, shaped.z);
  const baseRadius = params.baseSize * 0.58;
  const envelope = baseRadius * lerp(1.08, 0.18, Math.pow(clamp(t, 0, 1), 1.2)) + params.baseSize * 0.035;
  if (radius > envelope) {
    const blend = params.shellClosure;
    const scale = lerp(1, envelope / radius, blend);
    shaped.x *= scale;
    shaped.z *= scale;
  }

  const taper = 1 - params.spireTaper * clamp(t, 0, 1.2) * 0.06;
  shaped.x *= taper;
  shaped.z *= taper;

  if (params.terraceQuantization > 0) {
    const step = h / lerp(52, 14, params.terraceQuantization);
    shaped.y = lerp(shaped.y, Math.round(shaped.y / step) * step, params.terraceQuantization * 0.45);
  }

  return shaped;
}

function addFinalTriangle(triangle: PolarTriangle, level: number, params: FractalParams, state: BuildState): void {
  if (state.triangles.length >= params.maxTriangles) {
    state.clamped = true;
    return;
  }

  const next = {
    a: triangle.a.position.clone(),
    b: triangle.b.position.clone(),
    c: triangle.c.position.clone(),
    level
  };
  if (isValidTriangle(next)) state.triangles.push(next);
}

function buildIndexedGeometry(triangles: Triangle[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const indexFor = (point: THREE.Vector3): number => {
    const key = vertexKey(point);
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;
    const index = positions.length / 3;
    positions.push(point.x, point.y, point.z);
    vertexMap.set(key, index);
    return index;
  };

  for (const triangle of triangles) {
    indices.push(indexFor(triangle.a), indexFor(triangle.b), indexFor(triangle.c));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function tri(a: PolarPoint, b: PolarPoint, c: PolarPoint, state: boolean): PolarTriangle {
  return { a, b, c, state, dirA: false, dirB: false, dirC: false };
}

function point(position: THREE.Vector3, polarity: THREE.Vector3): PolarPoint {
  const safePolarity = polarity.lengthSq() > 0.000001 ? polarity.clone().normalize() : UP.clone();
  return { position: position.clone(), polarity: safePolarity };
}

function polarArea(triangle: PolarTriangle): number {
  return triangleArea(triangle.a.position, triangle.b.position, triangle.c.position);
}

function triangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
}

function isValidTriangle(triangle: Triangle): boolean {
  return (
    Number.isFinite(triangle.a.x) &&
    Number.isFinite(triangle.b.x) &&
    Number.isFinite(triangle.c.x) &&
    triangleArea(triangle.a, triangle.b, triangle.c) > MIN_AREA
  );
}

function edgeKey(a: THREE.Vector3, b: THREE.Vector3, level: number): string {
  const ak = vertexKey(a);
  const bk = vertexKey(b);
  return ak < bk ? `${level}:${ak}|${bk}` : `${level}:${bk}|${ak}`;
}

function vertexKey(point: THREE.Vector3): string {
  const q = (value: number) => Math.round(value * 100000) / 100000;
  return `${q(point.x)},${q(point.y)},${q(point.z)}`;
}
