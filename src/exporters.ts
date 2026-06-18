import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { AppParams } from "./types";

export function exportOBJ(mesh: THREE.Mesh): void {
  const exporter = new OBJExporter();
  downloadText(exporter.parse(mesh), "fractal-form.obj", "text/plain");
}

export function exportSTL(mesh: THREE.Mesh): void {
  const exporter = new STLExporter();
  downloadText(exporter.parse(mesh), "fractal-form.stl", "model/stl");
}

export function exportGLTF(mesh: THREE.Mesh): void {
  const exporter = new GLTFExporter();
  exporter.parse(
    mesh,
    (result) => {
      if (result instanceof ArrayBuffer) {
        downloadBlob(new Blob([result], { type: "model/gltf-binary" }), "fractal-form.glb");
      } else {
        downloadText(JSON.stringify(result, null, 2), "fractal-form.gltf", "model/gltf+json");
      }
    },
    (error) => console.error(error),
    { binary: false }
  );
}

export function exportPNG(renderer: THREE.WebGLRenderer): void {
  renderer.domElement.toBlob((blob) => {
    if (blob) downloadBlob(blob, "fractal-form.png");
  }, "image/png");
}

export function exportPreset(params: AppParams): void {
  downloadText(JSON.stringify(params, null, 2), "fractal-form-preset.json", "application/json");
}

export function importPreset(params: AppParams, onLoaded: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text()) as Partial<AppParams>;
    Object.assign(params, parsed);
    onLoaded();
  });
  input.click();
}

function downloadText(text: string, filename: string, type: string): void {
  downloadBlob(new Blob([text], { type }), filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
