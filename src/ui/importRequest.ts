import { readImportedEvidence } from "./evidenceImport";

type Bundle = Awaited<ReturnType<typeof readImportedEvidence>>;
/** Only the latest file selection can commit state or publish an error. */
export function createImportRequest() {
  let generation = 0;
  return {
    invalidate() {
      generation++;
    },
    async load(
      file: { size: number; text(): Promise<string> },
      commit: (bundle: Bundle) => void,
      reject: (message: string) => void,
    ) {
      const request = ++generation;
      try {
        if (file.size > 25_000_000)
          throw Error("Trace exceeds the 25 MB import limit.");
        const text = await file.text();
        if (request !== generation) return false;
        const bundle = await readImportedEvidence(JSON.parse(text));
        if (request !== generation) return false;
        commit(bundle);
        return true;
      } catch (error) {
        if (request === generation)
          reject(
            error instanceof Error ? error.message : "Could not import trace.",
          );
        return false;
      }
    },
  };
}
