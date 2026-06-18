import GUI from "lil-gui";
import { AppParams } from "./types";
import { applyPreset, defaultParams, presets } from "./presets";
import { randomSeed, SeededRandom } from "./random";

type UiActions = {
  regenerate: () => void;
  reset: () => void;
  randomize: () => void;
  randomizeSeed: () => void;
  randomizeParameters: () => void;
  cameraFront: () => void;
  cameraPerspective: () => void;
  cameraTop: () => void;
  cameraAxonometric: () => void;
  exportOBJ: () => void;
  exportSTL: () => void;
  exportGLTF: () => void;
  exportPNG: () => void;
  exportJSON: () => void;
  importJSON: () => void;
};

export function createGui(params: AppParams, actions: UiActions): GUI {
  const gui = new GUI({ title: "Fractal Controls" });
  gui.domElement.id = "controls";

  const schedule = debounce(actions.regenerate, 100);
  const refresh = () => {
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  };
  const changed = () => schedule();

  const general = gui.addFolder("General");
  general.add(params, "recursionDepth", 1, 5, 1).onChange(changed);
  general.add(params, "baseSize", 3, 16, 0.1).onChange(changed);
  general.add(params, "pyramidHeight", 4, 24, 0.1).onChange(changed);
  general.add(params, "seed", 1, 0xffffffff, 1).onFinishChange(changed);
  general.add(params, "symmetryMode").onChange(changed);
  general.add(params, "capBase").onChange(changed);
  general.add({
    randomize: () => {
      actions.randomize();
      refresh();
    }
  }, "randomize");
  general.add({ regenerate: actions.regenerate }, "regenerate");
  general.add({
    reset: () => {
      Object.assign(params, structuredClone(defaultParams));
      refresh();
      actions.reset();
    }
  }, "reset");

  const koch = gui.addFolder("Old Process Edge Construction");
  koch.add(params, "splitRatio", 0.25, 0.65, 0.001).onChange(changed);
  koch.add(params, "normalExtrusion", 0, 1, 0.01).onChange(changed);
  koch.add(params, "shellClosure", 0, 1, 0.01).onChange(changed);
  koch.add(params, "levelDecay", 0.25, 0.95, 0.01).onChange(changed);
  koch.add(params, "ridgeSharpness", 0, 1, 0.01).onChange(changed);

  const random = gui.addFolder("Randomness");
  random.add(params, "randomness", 0, 1, 0.01).onChange(changed);
  random.add(params, "asymmetry", 0, 1, 0.01).onChange(changed);
  random.add({
    randomizeSeed: () => {
      actions.randomizeSeed();
      refresh();
    }
  }, "randomizeSeed");
  random.add({
    randomizeParameters: () => {
      actions.randomizeParameters();
      refresh();
    }
  }, "randomizeParameters");

  const shaping = gui.addFolder("Tower Shaping");
  shaping.add(params, "verticalBias", 0, 3, 0.01).onChange(changed);
  shaping.add(params, "centralLift", 0, 1.5, 0.01).onChange(changed);
  shaping.add(params, "centralSpireBias", 0, 4, 0.01).onChange(changed);
  shaping.add(params, "buttressBias", 0, 1, 0.01).onChange(changed);
  shaping.add(params, "gothicVerticality", 0, 3, 0.01).onChange(changed);
  shaping.add(params, "spireTaper", 0, 1, 0.01).onChange(changed);
  shaping.add(params, "radialClusterStrength", 0, 1, 0.01).onChange(changed);
  shaping.add(params, "terraceQuantization", 0, 1, 0.01).onChange(changed);
  shaping.add(params, "verticalCoherence", 0, 1, 0.01).onChange(changed);
  shaping.add(params, "branchAngleLimit", 8, 55, 1).onChange(changed);

  const mesh = gui.addFolder("Mesh");
  mesh.add(params, "smoothNormals").onChange(changed);
  mesh.add(params, "doubleSidedMaterial").onChange(changed);
  mesh.add(params, "wireframe").onChange(changed);
  mesh.add(params, "showEdges").onChange(changed);
  mesh.add(params, "showAxes").onChange(changed);
  mesh.add(params, "maxTriangles", 1000, 250000, 1000).onChange(changed);

  const display = gui.addFolder("Material And Display");
  display.add(params, "materialMode", ["matte white", "gray clay", "black silhouette", "translucent glass"]).onChange(changed);
  display.add(params, "background", ["light gray", "dark gray", "black", "white"]).onChange(changed);
  display.add(params, "ambientLightIntensity", 0, 3, 0.05).onChange(changed);
  display.add(params, "directionalLightIntensity", 0, 5, 0.05).onChange(changed);
  display.add(params, "autoRotate").onChange(changed);
  display.add(params, "cameraMode", ["perspective", "orthographic"]).onChange(changed);

  const cameras = gui.addFolder("Camera");
  cameras.add({ front: actions.cameraFront }, "front");
  cameras.add({ perspective: actions.cameraPerspective }, "perspective");
  cameras.add({ top: actions.cameraTop }, "top");
  cameras.add({ axonometric: actions.cameraAxonometric }, "axonometric");

  const presetFolder = gui.addFolder("Presets");
  Object.keys(presets).forEach((name) => {
    presetFolder.add({
      [name]: () => {
        applyPreset(params, name);
        refresh();
        actions.regenerate();
      }
    }, name);
  });

  const exports = gui.addFolder("Export");
  exports.add({ exportOBJ: actions.exportOBJ }, "exportOBJ");
  exports.add({ exportSTL: actions.exportSTL }, "exportSTL");
  exports.add({ exportGLTF: actions.exportGLTF }, "exportGLTF");
  exports.add({ exportPNG: actions.exportPNG }, "exportPNG");
  exports.add({ exportJSON: actions.exportJSON }, "exportJSON");
  exports.add({ importJSON: actions.importJSON }, "importJSON");

  return gui;
}

export function randomizeAestheticParams(params: AppParams, seed = randomSeed()): void {
  const rng = new SeededRandom(seed);
  params.seed = seed;
  params.recursionDepth = rng.int(3, 5);
  params.baseSize = rng.range(6.8, 9.8);
  params.pyramidHeight = rng.range(11.5, 17.5);
  params.splitRatio = rng.range(0.38, 0.56);
  params.kochAngle = 38;
  params.normalExtrusion = rng.range(0.18, 0.5);
  params.verticalBias = rng.range(0.9, 1.8);
  params.buttressBias = rng.range(0.04, 0.42);
  params.centralLift = rng.range(0.32, 0.72);
  params.centralSpireBias = rng.range(1.25, 3);
  params.centralButtressBias = 0.25;
  params.levelDecay = rng.range(0.45, 0.68);
  params.randomness = rng.range(0.12, 0.38);
  params.angleJitter = 0;
  params.heightJitter = 0;
  params.splitJitter = 0;
  params.asymmetry = rng.range(0, 0.22);
  params.gothicVerticality = rng.range(1.5, 2.9);
  params.spireTaper = rng.range(0.25, 0.78);
  params.ridgeSharpness = rng.range(0.58, 1);
  params.buttressSpread = 0.5;
  params.axisAttractorStrength = 0.7;
  params.radialClusterStrength = rng.range(0.03, 0.28);
  params.terraceQuantization = rng.next() > 0.82 ? rng.range(0.04, 0.2) : 0;
  params.verticalCoherence = rng.range(0.72, 0.96);
  params.shellClosure = rng.range(0.68, 0.94);
  params.branchAngleLimit = rng.range(12, 28);
  params.triangulationMode = "spireFan";
  params.symmetryMode = rng.next() > 0.18;
  params.capBase = true;
  params.materialMode = rng.next() > 0.75 ? "translucent glass" : "matte white";
  params.background = rng.next() > 0.6 ? "black" : "dark gray";
}

function debounce(callback: () => void, delay: number): () => void {
  let handle = 0;
  return () => {
    window.clearTimeout(handle);
    handle = window.setTimeout(callback, delay);
  };
}
