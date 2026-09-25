# TACIT 0.4 release review

Reviewed locally on 25 September 2026. Kernel `tacit-0.4.0`; geometry `nominal-assembly-02`; policy `readiness-policy-2`. The branch is `refinement/execution-readiness`. This review describes the local release, not an update to the existing public site. The original 0.3 review is preserved in `docs/release-review-0.3.md`.

## Result and evidence

Run, Investigate and Design form a complete evidence workflow: compute a physical episode, inspect original decision inputs and checks, rerun a controlled pair, inspect either arm, and export/import its evidence. The new 96-pair exploratory study contains all 192 assigned arm outcomes. All episodes stop, none reach the target, and none record a modeled violation. Readiness removes 262.17 µL more than fixed + preflight on average (paired 95% interval 211.46–315.76 µL), taking 15.76 s longer. View access improves bulk progress by 57.07 µL; history withholding reduces progress by 64.63 µL. These are synthetic exploratory findings, not physical safety or biological results.

The first study is archived as superseded after a deeper review found an incomplete holder-seating uncertainty allowance. The final revision subtracts the bounded relative seating uncertainty from hardware clearance. A complete new study was run after freezing source hashes. A partial source-review restart is recorded; all final assignments were rerun. Current results use only the final revision. Scene seeds repeat the preliminary study; this is disclosed as exploratory regression evaluation rather than an untouched confirmatory test set. The final canonical report SHA-256 is `9665b48f3b25ab6ec76c1bd52f6c09e4e5fdd29952975bc833c39b1c2f31cb41`.

## Actual browser review

Chrome 154.0.8037.57 and native Safari 27.0 were operated against the production build at localhost. Chrome exercised all three scenarios, fixed and privileged comparators, preflight/readiness policy pairs, view/history interventions, first-blocker navigation, expanded receipts, frame stepping, timeline actions, legacy import, corrupt import, JSON/CSV/case export, paired import, geometry export, search cancellation, a completed 32-candidate nominal search, candidate application and rerun. Native Safari completed run, continuous replay, pause, receipt inspection, paired history comparison, arm inspection, evidence download and native-file-chooser re-import. Native page zoom was increased and restored.

Responsive inspection covered all modes at 390 × 844, 768 × 1024 and 1440 × 1000, with no horizontal body overflow. CSS 200% zoom and native Safari zoom were inspected; the layout stacks at the available content width. A zoom-induced canvas sizing problem was corrected using layout pixels. The mobile truth label remains visible. These checks do not establish formal WCAG conformance.

The About dialog traps keyboard focus, Escape closes it and focus returns to the originating button. Reduced-motion preferences leave computed replay paused at zero. Global shortcuts do not fire inside form controls or the modal. An instrumented cancel/restart check recorded one active worker and a peak of one; worker identity and job IDs prevent stale completion. A deliberately WebGL-disabled isolated browser still computed a run and exposed the receipt and export controls.

A malformed case was rejected without changing the visible decision, replay time or the entire exported packet. Paired export/import preserved both scientific arms, including every event, pixel, source reference and manifest. Re-export marks transport provenance as recorded and therefore produces a new outer hash; it is not claimed to be byte-identical to the live packet. A legacy fixture with a recorded violation followed by a stop still displays the violation as the outcome. Legacy traces never acquire invented receipts or substitute current geometry as an exact replay.

Repairs discovered through computer use included stale background playback, zero-sized hidden WebGL render targets, paired imports losing their second arm, hidden mobile truth labels, a timeline range input intercepting action-button clicks, zoomed canvas sizing, and ambiguous labels on unchecked/privileged comparators. The actual interface was retested after each repair.

## Animation and performance

A continuous recording covers complete known, changed and missing-context episodes at 2× playback. Ninety-nine screenshots cover immediately before, at and after all 33 timed action starts; all three contact sheets were visually inspected. The continuous recording was inspected at distributed frames as well. This is a boundary-focused visual review, not a claim that every rendered frame was manually watched. Independent playback checks sampled all 6,697 frames at 60 Hz across those three episodes and conserved tube-plus-tip volume. Existing regressions also check speed limits, settling, capture-time visibility and action-boundary continuity.

On the test Mac at 1440 × 1000, scenario computation took 3.39, 3.37 and 2.86 s. Instrumented playback recorded 3,300 rendered-frame measurements across the three episodes; median interval was 16.7 ms and per-episode p95 was 17.6–17.9 ms. Rendering used 117–119 draw calls and 61–67 geometries across visited variants. No browser console warnings or errors were recorded in that continuous pass. These are local measurements under concurrent evaluation load, not universal device guarantees.

## Numerical, inference and artifact checks

- 35 automated tests pass, covering physical accounting, geometry, uncertainty and timing invariants, receipts, import schemas, deterministic pairing, old benchmark accounting and playback.
- Nominal assembly tests cover 32 supported tilt/index/tolerance combinations, explicit support contact, whole outer tube intersection at sampled insertion positions, cap/hinge surface samples, and CAD/analytic/optical alignment. These are sampled computational checks, not continuous insertion proofs or measured fit.
- Independently parsed 0° and 5° downloads have 1,104 and 1,176 triangles. Every edge is shared by exactly two triangles; STL and 3MF coordinates match exactly in mm. The 10° export is disabled and execution stops outside the assembly contract.
- Independent SciPy quadrature/root finding on 96 cases found maximum height disagreement 0.000521 mm and volume disagreement 0.02991 µL.
- Internal synthetic volume interval coverage is 36/36; pump and calibration sensitivity cover nine development cases. This does not establish real-camera calibration.
- The new independent 16-image Cycles grid detects every side liquid boundary but covers only 6/12 nominal feature intervals, with maximum level error 1.6393 mm, and misses all four overhead pellet features. Original five-image failures and the nonconvergent 10° surface case remain preserved.

The static build stays within the existing 12 MB raw / 2.5 MB conservative compressed whole-site budgets. Final exact byte counts and archive hashes are in the delivery report. Assets, fonts and computation are local; no telemetry, external model service or account is needed.

## Delivery boundary

Source, frozen study, independent images, methods, acceptance map, application-response draft and demonstration script are included. Public hosting and the existing remote repository were not updated. The holder is research geometry and is explicitly not for fabrication. No physical experiment, biological validation or application submission was performed.
