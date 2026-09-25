# TACIT 0.4: execution readiness and evidence

TACIT asks a narrow question: what available evidence supports the next move or withdrawal during bulk wash removal in one nominal tube? It connects a timed physical scene, synthetic camera observations, uncertain state estimates, runtime decision records, and controlled reruns. The primary outcome is inspectable execution evidence. It does not establish physical safety, biological success, or a fabrication-ready holder.

## Current release and scope

This dossier describes `tacit-0.4.0`, geometry `nominal-assembly-02`, and readiness policy revision 2. Run, Investigate and Design now form a single workflow: compute an episode, inspect a recorded decision, change one information or policy condition, then export both arms. Original 0.3 evidence remains separately labelled and is never relabelled as a current-model benchmark. The original methods are preserved in `docs/methods-0.3.md`.

The supported screening domain remains 0° or 5° inclination and 100–950 µL. The 150 µL residual objective includes a 12 µL estimate tolerance. The 10° Surface Evolver non-convergence is retained and excludes that configuration. All dimensions and stochastic distributions are research assumptions unless specifically sourced below.

## Nominal assembly contract

The previous visual index intersected the nominal tube and the seated bottom had a 0.45 mm gap. The fence now has the same bore subtraction as the holder. A connected, tilted support pad meets the exterior tube bottom at its declared datum. Seating offsets lie in the transverse plane, preserving that support plane; the fixture never moves with tube uncertainty. The index is a visual history marker, not a mechanical orientation key.

CAD, analytic collision geometry, optical masks and regenerated display assets use the shared dimension source. Regressions check tube body, lip, hinge and open cap over supported inclinations and tolerance offsets; an independent Manifold intersection checks the full outer tube along sampled insertion positions. The sampled insertion test is not a continuous swept proof. Export is restricted to the computationally checked inclinations. STL and 3MF contain identical coordinates in mm. Fit, retention, loading, manufacturability and chemical compatibility remain unmeasured. Every export says NOT FOR FABRICATION.

## Decisions are recorded before actions

A policy receives an explicit copied input: belief particles, existing evidence references, commanded amount, instrument position, fixture and procedure assumptions, and available views. It does not receive the environment world state. The oracle comparator has an explicit privileged capability and is labelled separately. Environment truth is used to generate observations and evaluate outcomes only.

Each action is selected from those inputs and a receipt is committed at the same simulation timestamp before the environment executes it. The receipt preserves its manifest, belief snapshot, candidate targets, actual check values and thresholds, evidence availability and correlation groups, view predictions, bounded-search termination, and reason code. Later observations cannot appear in an earlier receipt. Camera references are checked against the saved capture timestamp and exact image packet. The display does not synthesize explanations for old traces.

Checked move and aspiration actions require nominal assembly, supported domain, swept hardware and pellet clearance, stage limits, tip capacity, useful volume, and immersion at the end of the complete commanded stroke. The checked uncertainty envelope uses marginal 95% volume/pose intervals, retained particle orientations (a full ring when unresolved), a three-sigma pump allowance and 1.85 mm surface allowance. These are assumed envelopes, not a joint 95% guarantee. Gaussian tails and model discrepancy remain outside that envelope.

Holder position is stationary within each physical hypothesis. Because the particle state estimates tube position without independently resolving the seating offset, checked hardware clearance subtracts an additional 0.8 × radial-clearance bound for unknown seating, plus the tilt-dependent vertical allowance. Hypothetical optical predictions use a centered seat and remain planning approximations.

The fixed and point-estimate comparators retain unchecked actions and expose that fact in their receipts. The preflight baseline checks one fixed procedure target before committing. The readiness controller checks at most four physical candidates, chooses feasible progress, and evaluates side/overhead observation options from three deterministic hypothetical posterior-predictive states. A 2 µL-equivalent observation cost and six-observation budget bound this search. It never uses the realized future observation to decide whether to acquire it. “No tested action passed” means this bounded candidate set failed; it does not prove no feasible action exists.

Missing history does not automatically prevent distant bulk progress. Unresolved orientation is retained around the full exclusion ring and may block subsequent close approach. Repeated correlated camera evidence cannot manufacture an orientation record.

## Controlled interventions and exploratory study

Every pair is rerun from initialization with exact matching initial physical state. Context changes access to an existing history record; observation changes side-only versus both views being available; policy changes fixed + preflight versus readiness. Extra view availability does not imply that the controller must use it. Scene and sensor streams are keyed; actuation draws are indexed by commanded stroke, so different action schedules do not claim physically identical realizations.

The final evaluation plan, assignment list and 27 scientific source/lockfile hashes were frozen before execution. An earlier study and a partial source-review restart are retained as superseded, not used for current claims. Development examples use seed 1847; evaluation uses 12 separately assigned scenes per family. History has 24 pairs (known and changed); view and policy each have 36 pairs (also missing context). All 96 assigned pairs completed computation, with no administrative failures. This is a small exploratory simulation study, not a preregistered confirmatory or physical validation study. The final rerun reuses the scene seeds from the superseded preliminary study after a code-audit-driven uncertainty repair. It is therefore a regression evaluation, not an untouched test set. Scientific source hashes were verified again after the run. UI and documentation edits continued independently. The local freeze is reproducible, but is not an independently timestamped preregistration.

- Context: withholding history increased mean residual by 64.63 µL; paired 95% bootstrap interval 11.08–112.44 µL.
- Observation: making the overhead view available changed residual by −57.07 µL; interval −108.81 to −11.02 µL. This is conditional on the assumed synthetic scene population.
- Policy: readiness changed residual by −262.17 µL versus fixed + preflight; interval −315.76 to −211.46 µL, with 15.76 s more mean elapsed time.
- Every arm recorded zero target completions and zero modeled violations. All 192 episodes stopped. All stops stay in the means. Readiness made progress in all 36 policy scenes; preflight made progress in 24 of 36.

Paired bootstrap resamples matched scenes within family. Zero-width completion intervals are labelled degenerate, not presented as proof of equal population performance. A zero-event one-sided 95% binomial upper bound is 11.73% for 24 independent trials and 7.98% for 36; model error is additional. Completion, conservative stop, modeled violation and missed declared target partition episodes. Aspiration exposure and stop-before/after-progress are separate facts. The stop-immediately controller is a diagnostic sentinel and never evidence of task success.

## Calibration and retained negative evidence

The new internal report contains 36 side-view checks: the nominal 95% volume intervals covered all 36 synthetic truths, with zero missed liquid-level features. Nine sensitivity episodes vary assumed pump error and camera calibration bias. This checks internal consistency under the same generator, not camera calibration or robust physical coverage. A new 16-image Cycles grid was specified before rendering: six fill volumes, 0°/5° tilt, light scales 0.7/1.3, roughness 0.05/0.2, camera vertical offsets ±0.2 mm, and four overhead contrast/fill cases. No extractor tuning followed. All 12 side levels were detected, but only 6/12 nominal feature-level 95% intervals covered the reference; maximum absolute level error was 1.6393 mm. All four overhead pellet detections failed. Missing detections count as noncoverage. These assumed nuisance ranges are an independent-renderer stress diagnostic, not empirically justified physical coverage. The raw images, frozen plan and results are saved under `public/reference-readiness` and `public/data/readiness-optics.json`.

The separate original independent Blender audit is retained: high-fill level bias reaches 1.39 mm and both overhead pellet detections fail. We did not replace these failures with the new internally generated measurements.

Independent SciPy quadrature/root solving over 96 cases found maximum height error 0.000521 mm and volume error 0.02991 µL. These agreement checks do not validate near-tip fluid dynamics or physical pellet retention. The original hosted 0.3 evaluation and stress sample remain historical and separate from current results.

## Portable evidence and compatibility

A case packet includes a trace, exact camera pixels, original receipts, readable limitations and, when applicable, both rerun arms. Canonical SHA-256 hashes detect modification of the payload. This is local integrity, not an external authenticity signature. Imports use bounded schemas, reject nonfinite values, future evidence, unknown receipt fields, inconsistent manifests and mismatched pair states, and commit to the UI only after complete validation. Rejected files leave the previous case intact.

Legacy 0.2/0.3 files retain their events and pixels without invented receipts. They are displayed as historical evidence without rendering their physical trace against the repaired current holder. Recorded files are not recomputed on import. Re-export changes the transport provenance kind from live to recorded and computes a new payload hash; original events, input sources, manifests, outcomes and camera pixels remain unchanged. Byte-identical re-export of the outer packet is not claimed. Replaying or selecting an arm never grants later evidence to the policy.

## Reproduction and engineering limits

Use Node 24, `npm ci`, `npm test`, `npm run build`, and `npm run check:budget`. `npm run study:readiness` reproduces the exploratory assignments and summary; `npm run check:calibration` produces the internal checks. `npm run assets` requires Blender. Numerical and independent optical audit commands are in README. Detailed browser, animation, export and failure-path review is in `docs/release-review.md`.

The system is deterministic given its manifest, seed and declared interventions. It is a quasistatic screening model without pellet adhesion, local flow, biological yield, measured material tolerances, camera housing collisions or contact mechanics. A recorded pass establishes only that the implemented checks passed under their declared assumptions.

## Inherited physical model and sources

The following physical formulation and sources carry forward from the prior model. Controller behavior and current evaluation are defined above; older controller and benchmark descriptions are archived separately.

## Units, geometry and motion

All model coordinates are millimetres with Z up. One mm³ is one µL. Presentation glTF coordinates deliberately use the same numerical units; they are converted to Three.js Y-up. The single nominal dimension source is `src/model/dimensions.json`. It is research geometry, not a certified replica of a particular manufacturer part. Liquid properties are sourced; labware dimensions, wetting, calibration noise, seating distributions, optical material properties and control margins are assumptions.

The interior is a truncated cone (base radius 0.55 mm, top radius 4.3 mm, height 11 mm) followed by a cylinder to 32 mm. Its closed-form upright volume is π(a²z + akz² + k²z³/3), plus the cylindrical contribution above the cone. Inclined states integrate circular segments in slices normal to the tube axis. Inverse volume uses bisection. Tip immersion displaces the external tapered volume, which is subtracted from available liquid volume. The fill-height calculation includes this displacement; the instrument is kept vertical.

The maximum stage speed is 18 mm/s and acceleration is 70 mm/s². Move duration and playback use the same triangular or trapezoidal velocity profile. The entire tip/shaft envelope is sampled axially every 0.4 mm with a 0.21 mm allowance, followed by conservative advancement along the translation. Tube wall, mouth, open cap, hinge and constructive fixture geometry are checked. A separate swept instrument-to-pellet check protects the declared 1.8 mm exclusion margin. The margin is a research constraint; it is not a model of pellet adhesion or disruption.

The fixture base stays on the bench at every inclination. Fixture placement and tube seating are separate. Seating offsets are bounded to 80% of nominal radial clearance so the nominal tube starts inside the bore. The visual orientation marker supports a supplied history record but does not mechanically key the tube. Adding an index after history is lost cannot recover that history.

## Quasistatic liquid and equilibrium reference

The interactive volume calculation uses a planar free surface with a conservative immersion allowance. It is a screening model; the rendered wash tint is explanatory. It does not resolve near-tip velocity, recirculation, viscous stresses, contact-angle hysteresis, evaporation or RNA chemistry.

At 298 K and ethanol mole fraction 0.419, the adopted measured mixture properties are density 878.8 kg/m³, surface tension 0.02735 N/m and dynamic viscosity 0.0022249 Pa·s. **Mole fraction is not volume fraction.** The resulting capillary length √(γ/ρg) is approximately 1.78 mm. That scale is large enough that a flat surface alone cannot support near-pellet aspiration claims.

Surface Evolver minimizes free-surface and wetted-wall energy plus gravity at fixed volume. Free-surface tension is normalized to one, wall tension is −cos(contact angle), and normalized gravity is ρg/γ × 10⁻⁶ in mm coordinates. Mesh coordinates are constrained to prevent tangential drift of contact-line vertices; interior surface vertices move vertically. Two independently generated mesh densities (48 and 96 angular sectors, 4 and 8 radial rings) estimate discretization sensitivity.

The grid contains five volumes (100, 200, 400, 850 and 950 µL), three inclinations (0°, 5°, 10°), and three assumed contact angles (40°, 70°, 100°). The current run converged in 44 of 45 cases. The 10° / 200 µL / 40° case did not converge near the cone-cylinder transition. It remains in the artifact, and the 10° configuration is excluded from supported optimization. The maximum mesh difference among converged cases was approximately 0.042 mm. This is an empirical refinement check, not a rigorous error bound between grid points.

The current supported screening domain is **0° or 5°, 100–950 µL**, with the assumed contact-angle range above. The bulk-removal objective is 150 µL remaining, with a 12 µL decision tolerance on the controller’s mean estimate. This leaves a 50 µL reserve above the reference grid’s lower edge; actual outcomes and uncertainty are reported separately. A controller may stop earlier for access, immersion or uncertainty. The controller also uses a 1.85 mm immersion allowance. Unsupported configurations cannot receive a favorable optimization score. The reference omits an immersed tip; the interactive kernel accounts for tip displacement but does not validate tip-induced meniscus deformation. Physical calibration is still required.

## Observation and belief

The presentation scene never supplies measurements to the observed controller. A separate CPU image renderer generates 112 × 144 pixel snapshots with orthographic calibration and capture timestamps. Rays traverse air, the nominal polypropylene wall and liquid using Snell refraction. Total internal reflection and overlong optical paths are masked. Paths through the holder, cap, hinge or tip are also masked because their transmission is outside the optical model. The hardware mask uses the same constructive holder dimensions with a conservative half-step expansion. It does not label the pellet or liquid. Noise, weak pellet contrast and glare are represented. This is an idealized optical model, not a calibrated camera implementation. Physical camera housings and their support geometry are outside the collision model.

Image features estimate a side-view liquid boundary, tube position and, when separable, a pellet direction. A liquid boundary needs horizontal gradient support across the tube interior; an obscured surface cannot be replaced by a small dark pellet feature. A particle filter tracks liquid volume, pose and pellet orientation. It carries a persistent liquid-level calibration nuisance variable so repeated observations do not treat a fixed bias as independent noise. Repeated capture groups cannot update the belief twice; the group identifier derives from the known action epoch, not a hidden liquid volume. Repeated side images do not repeatedly sharpen the same pose measurement.

The side camera cannot resolve the perpendicular seating coordinate. When that uncertainty affects access, an overhead observation constrains it. If pellet contrast and orientation history are both insufficient, orientation remains unresolved and limits feasible actions. The visible pellet highlight belongs to the explanatory view and is never a measurement.


## Sources

- Transfyr, [AI and robotics](https://www.transfyr.ai/news/ai-robotics): execution data, process specification and robotics.
- Transfyr, [The lossless lab](https://www.transfyr.ai/news/the-lossless-lab): preserving experimental execution context.
- Khattab et al., [Density, viscosity and surface tension of water–ethanol mixtures](https://pcprakt.userpage.fu-berlin.de/SKRIPT/T13/DensityH2O_EtOH.pdf): adopted mixture properties.
- Ken Brakke, [Surface Evolver energies](https://kenbrakke.com/evolver/html/energies.htm), [constraints](https://kenbrakke.com/evolver/html/constrnt.htm) and [stability tutorial](https://kenbrakke.com/evolver/html/eigentut.htm): energy minimization and convergence checks.
- Pharr, Jakob and Humphreys, [Specular reflection and transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission): geometric optics and refraction.
- [Current equilibrium-reference run](https://github.com/raaaaaif/tacit/actions/runs/34421128895), including the retained nonconvergent case.
