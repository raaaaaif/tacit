# TACIT release review

Model: `tacit-0.3.0`. Outcome assessment: `target-attainment-1`. Reviewed on 9–10 September 2026 on an Apple M1 Mac.

## Interaction and visual inspection

The review used the actual Chrome and native Safari interfaces, including production Cloudflare Pages. Decorative numbering beside Run, Investigate and Design was removed. Desktop scene height remains stable across modes, and long inspectors scroll beside it. Mobile layouts were inspected at 390 × 844; desktop inspection included 1440 × 1000 and 1920 × 1080.

Fifty-seven captured frames were visually inspected: one frame before, at, and after each of 19 timed action transitions. This is a boundary-focused visual review, not a claim that every rendered frame was manually watched. Separate numerical checks sample the full trajectory at 60 Hz for volume conservation, motion limits and continuity. Camera acquisition and pump-settling boundaries have explicit checks. The custom tube, tip, holder and connected stage were inspected in detail and whole-workcell views.

Verified flows include run/pause/replay, frame stepping, all three scenario selections, 0°/5°/10° holder selection, missing-context and unsupported-reference stops, search cancellation, a complete 32-candidate interactive search, candidate application, trace JSON/CSV export, recorded trace import, and STL/3MF ZIP export. Native Safari completed run → investigate → export → import → scrub → design → CAD export.

JSON export originally exceeded the import size limit. Compact serialization corrected that defect while preserving all events and camera pixels. The importer now has a bounded 25 MB limit and validates dimensions, coordinates, types and camera-buffer lengths.

Reduced-motion preferences pause a newly computed replay at time zero. Keyboard focus remains inside the About dialog, Escape closes it and restores focus, and Space cannot trigger the background run while it is open. An isolated browser with WebGL deliberately disabled showed the fallback message and still computed a run. These checks do not establish formal WCAG conformance.

## Numerical and artifact checks

- 24 automated tests passed, including complete-episode outcome partitioning against published CSV records and false completion handling.
- Independent Python quadrature/root finding over 96 cases found a maximum height difference of 0.000521 mm and volume difference of 0.02991 µL.
- Surface Evolver converged in 44 of 45 sampled cases. The failed 10° case remains visible and excludes that inclination from supported optimization.
- The five-image independent Blender audit retained up to 1.39 mm level bias and both missed pellet detections. It limits the claims that can be made from the primary synthetic renderer.
- Downloaded Safari CAD exports contain 764 triangles, closed two-manifold edges and identical STL/3MF coordinates. No physical fit or fabrication claim is made.
- Trace re-import preserved the exact event sequence and five camera packets. Tube liquid plus aspirated liquid conserved the initial volume.
- Hosted evaluation completed 512 baseline and 512 selected-policy episodes per controller, three optimization seeds per controller, and 4,096 separate geometric stress paths.

An instrumented browser check cancelled two searches, changed the holder and scenario, then ran again; active and peak worker counts both remained one. The browser-side solver uses one worker. Expensive primary evaluations ran in bounded GitHub Actions jobs. Runtime assets, fonts and code are local to the static site; no tracking or external AI API is present. See the methods dossier for the model's physical limits and the benchmark's retained negative results.

## Measured performance and delivery size

A complete 1920 × 1080 Chrome replay on the M1 recorded 1,440 sampled render frames, a 16.7 ms median interval and a 17.7 ms 95th-percentile interval at pixel ratio 1 (61 geometries, 119 draw calls). This is approximately 60 fps in the tested run, not a universal frame-rate guarantee. The final whole-site budget check counted approximately 7.1 MB raw and 1.5 MB compressed, including optional CAD code, all holder variants, reference images and saved evidence. Both the 12 MB full-site limit and the stricter 2.5 MB compressed budget passed.
