import Module from "manifold-3d";
import fs from "node:fs";
import { fixtureSolid } from "../src/cad/solid";
import { defaultFixture } from "../src/model/geometry";
const module = await Module();
module.setup();
fs.mkdirSync("work/fixture-meshes", { recursive: true });
for (const tilt of [0, 5, 10] as const)
  for (const indexed of [false, true]) {
    const spec = { ...defaultFixture, tilt, indexed },
      solid = fixtureSolid(module, spec),
      mesh = solid.getMesh();
    if (solid.status() !== "NoError" || solid.decompose().length !== 1)
      throw Error(
        `Fixture ${tilt}/${indexed} must be a single watertight body: ${solid.status()} / ${solid.decompose().length}`,
      );
    fs.writeFileSync(
      `work/fixture-meshes/holder-${tilt}-${indexed}.json`,
      JSON.stringify({
        spec,
        vertices: Array.from(mesh.vertProperties),
        triangles: Array.from(mesh.triVerts),
        stride: mesh.numProp,
        volume: solid.volume(),
      }),
    );
    solid.delete();
  }
