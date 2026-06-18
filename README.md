# Fractal Form

Interactive browser app for generating closed crystalline tower massing. The active generator is a fresh TypeScript implementation based on the older Processing project files: polar points, interpolated edge polarity, recursive four-triangle subdivision, shared edge construction, and indexed watertight mesh output.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal.

## Algorithm

The generator builds a watertight exterior shell:

1. A symmetric polar seed is built from base, shoulder, crown, and tip points.
2. Each point stores a polarity vector, matching the old `Point.pol` idea.
3. Every edge creates an old-project-style `EC` point: interpolate position, interpolate polarity, then displace by edge length and amplitude.
4. Each triangle recursively subdivides into four triangles while shared edge points are cached.
5. The result is welded into an indexed `BufferGeometry` with a closed base cap.

This removes the loose Expressionist shard behavior and keeps the model exportable as a closed architectural mass.

## Controls

- `recursionDepth`: recursive subdivision depth; 3-5 is the practical design range.
- `baseSize` and `pyramidHeight`: define the initial massing.
- `splitRatio`: controls where each edge-created point lands along the edge.
- `normalExtrusion`: controls outward displacement amplitude in the old edge-construction step.
- `verticalBias`, `centralSpireBias`, and `gothicVerticality`: raise needles and pinnacles.
- `buttressBias`: controls lower-body radial ribs.
- `spireTaper`: pulls upper geometry inward for sharper towers.
- `terraceQuantization`: optionally steps the vertical envelope.
- `verticalCoherence`: keeps recursive edge displacement shooting upward instead of spreading laterally.
- `shellClosure`: pulls outlying points back into a coherent volumetric envelope.
- `branchAngleLimit`: limits lateral branch angle; lower values create needle-like vertical towers.
- `symmetryMode`: repeats seeded variation in a four-sided organization.
- `randomness` and `seed`: drive deterministic target-family variations.
- `maxTriangles`: clamps recursion before the browser gets overloaded.

For meshes close to the provided vertical screenshot target, keep `symmetryMode` enabled, `branchAngleLimit` around 14-24, `verticalCoherence` above 0.8, and `shellClosure` above 0.75.

## Presets

- `Screenshot Target`: default vertical closed shell.
- `Needle Crown`: taller, sharper crown spires.
- `Heavy Shell`: broader lower mass.
- `Thin Blades`: tighter vertical blade structure.

## Export

The Export folder in the GUI can save:

- OBJ mesh
- STL mesh
- GLTF JSON
- PNG screenshot
- JSON parameter preset

JSON presets can be imported back into the app from the same folder.
