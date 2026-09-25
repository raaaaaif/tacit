import type { FixtureSpec } from "../model/types";
import { ASSEMBLY, assemblySupported } from "../model/assembly";
import D from "../model/dimensions.json";
import { MODEL_VERSION } from "../model/geometry";
import Module from "manifold-3d";
import wasmURL from "manifold-3d/manifold.wasm?url";
import { zipSync, strToU8 } from "fflate";
import { fixtureSolid } from "./solid";
let ready: ReturnType<typeof Module> | undefined;
export async function exportFixture(spec: FixtureSpec) {
  if (!assemblySupported(spec))
    throw Error(
      "Research geometry is available only for the computationally checked 0°/5° assemblies.",
    );
  const module = await (ready ??= Module({ locateFile: () => wasmURL }).then(
    (m) => {
      m.setup();
      return m;
    },
  ));
  const result = fixtureSolid(module, spec);
  try {
    if (result.status() !== "NoError")
      throw Error("Fixture solid could not be constructed.");
    const mesh = result.getMesh(),
      n = mesh.triVerts.length / 3;
    const buffer = new ArrayBuffer(84 + n * 50),
      view = new DataView(buffer);
    new Uint8Array(buffer, 0, 80).set(
      new TextEncoder().encode("TACIT / nominal untested bench holder / mm"),
    );
    view.setUint32(80, n, true);
    const xyz = (v: number) =>
      Array.from(
        mesh.vertProperties.slice(v * mesh.numProp, v * mesh.numProp + 3),
      );
    for (let i = 0; i < n; i++) {
      const vertices = [0, 1, 2].map((j) => xyz(mesh.triVerts[i * 3 + j]));
      const u = vertices[1].map((x, k) => x - vertices[0][k]),
        v = vertices[2].map((x, k) => x - vertices[0][k]);
      const normal = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ],
        norm = Math.hypot(...normal) || 1;
      normal.forEach((x, k) =>
        view.setFloat32(84 + i * 50 + k * 4, x / norm, true),
      );
      vertices
        .flat()
        .forEach((x, k) => view.setFloat32(84 + i * 50 + 12 + k * 4, x, true));
    }
    let vertices = "",
      triangles = "";
    for (let i = 0; i < mesh.vertProperties.length / mesh.numProp; i++) {
      const p = xyz(i);
      vertices += `<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`;
    }
    for (let i = 0; i < n; i++)
      triangles += `<triangle v1="${mesh.triVerts[i * 3]}" v2="${mesh.triVerts[i * 3 + 1]}" v3="${mesh.triVerts[i * 3 + 2]}"/>`;
    const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
    const threeMF = zipSync({
      "[Content_Types].xml": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
      ),
      "_rels/.rels": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      ),
      "3D/3dmodel.model": strToU8(model),
    });
    const notes = {
      version: 1,
      assembly: ASSEMBLY,
      modelVersion: MODEL_VERSION,
      fixture: {
        ...spec,
        // Older replay metadata called this opening 9 mm; exported CAD uses
        // the current fixed solid, whose shared dimension source is 13 mm.
        window: D.holder.windowWidth,
        clearance: D.holder.seatClearance,
      },
      units: "mm",
      dimensions: D.holder,
      volumeMm3: result.volume(),
      surfaceAreaMm2: result.surfaceArea(),
      triangleCount: n,
      status: result.status(),
      limitations:
        "Research geometry — NOT FOR FABRICATION. Nominal computational assembly check only. Physical fit, retention, loading, cleanability and chemical compatibility are untested. Never use as a centrifuge component.",
    };
    const stem = `tacit-holder-${spec.tilt}deg`;
    const bundle = zipSync({
      [stem + ".stl"]: new Uint8Array(buffer),
      [stem + ".3mf"]: threeMF,
      "dimensions.json": strToU8(JSON.stringify(notes, null, 2)),
      "README.txt": strToU8(
        "TACIT bench-holder design\n\nUnits: mm. Contains identical STL and 3MF geometry and dimension notes.\n\n" +
          notes.limitations +
          "\n\nParametric source: https://github.com/raaaaaif/tacit/blob/main/src/cad/solid.ts\n",
      ),
    });
    return { bundle, notes };
  } finally {
    result.delete();
  }
}
