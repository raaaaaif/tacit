import fs from "node:fs";
import { createHash } from "node:crypto";
const snapshot = JSON.parse(
  fs.readFileSync("public/data/readiness-source-manifest.json", "utf8"),
) as { study: string; files: Record<string, string> };
const changed = Object.entries(snapshot.files)
  .filter(
    ([path, hash]) =>
      !fs.existsSync(path) ||
      createHash("sha256").update(fs.readFileSync(path)).digest("hex") !== hash,
  )
  .map(([path]) => path);
if (changed.length)
  throw Error(
    `The frozen ${snapshot.study} source differs: ${changed.join(", ")}. Create a newly versioned evaluation plan and source snapshot before evaluating modified scientific code.`,
  );
console.log(
  `${snapshot.study}: ${Object.keys(snapshot.files).length} frozen source files match.`,
);
