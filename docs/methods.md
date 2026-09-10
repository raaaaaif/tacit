# TACIT: model and evidence dossier

TACIT makes the unspoken judgments in a laboratory handling step inspectable: locate the tube and liquid, preserve uncertainty about a pellet, check a complete instrument path, remove a bounded amount, and stop when the evidence no longer supports an action. It is an independent project by Raaif Bokhari, inspired by RNA isolation at the bench and by the practical constraints of designing objects for 3D fabrication.

The relevant connection to Transfyr is **scientific execution data**: a procedural instruction becomes timed actions, observations, uncertainty and outcomes. A trace can be replayed or inspected independently of its presentation. This is a small research workbench, not a trained robot model or a deployed laboratory controller.

## Units, geometry and motion

All model coordinates are millimetres with Z up. One mm³ is one µL. Presentation glTF coordinates deliberately use the same numerical units; they are converted to Three.js Y-up. The single nominal dimension source is `src/model/dimensions.json`. It is research geometry, not a certified replica of a particular manufacturer part. Liquid properties are sourced; labware dimensions, wetting, calibration noise, seating distributions, optical material properties and control margins are assumptions.

The interior is a truncated cone (base radius 0.55 mm, top radius 4.3 mm, height 11 mm) followed by a cylinder to 32 mm. Its closed-form upright volume is π(a²z + akz² + k²z³/3), plus the cylindrical contribution above the cone. Inclined states integrate circular segments in slices normal to the tube axis. Inverse volume uses bisection. Tip immersion displaces the external tapered volume, which is subtracted from available liquid volume. The fill-height calculation includes this displacement; the instrument is kept vertical.

The maximum stage speed is 18 mm/s and acceleration is 70 mm/s². Move duration and playback use the same triangular or trapezoidal velocity profile. The entire tip/shaft envelope is sampled axially every 0.4 mm with a 0.21 mm allowance, followed by conservative advancement along the translation. Tube wall, mouth, open cap and constructive fixture geometry are checked. A separate swept instrument-to-pellet check protects the declared 1.8 mm exclusion margin. The margin is a research constraint; it is not a model of pellet adhesion or disruption.

The fixture base stays on the bench at every inclination. Fixture placement and tube seating are separate. Seating offsets are bounded to 80% of nominal radial clearance so the nominal tube starts inside the bore. A known orientation record is retained only when orientation indexing is enabled. Adding an index after history is lost cannot recover that history.

## Quasistatic liquid and equilibrium reference

The interactive volume calculation uses a planar free surface with a conservative immersion allowance. It is a screening model; the rendered wash tint is explanatory. It does not resolve near-tip velocity, recirculation, viscous stresses, contact-angle hysteresis, evaporation or RNA chemistry.

At 298 K and ethanol mole fraction 0.419, the adopted measured mixture properties are density 878.8 kg/m³, surface tension 0.02735 N/m and dynamic viscosity 0.0022249 Pa·s. **Mole fraction is not volume fraction.** The resulting capillary length √(γ/ρg) is approximately 1.78 mm. That scale is large enough that a flat surface alone cannot support near-pellet aspiration claims.

Surface Evolver minimizes free-surface and wetted-wall energy plus gravity at fixed volume. Free-surface tension is normalized to one, wall tension is −cos(contact angle), and normalized gravity is ρg/γ × 10⁻⁶ in mm coordinates. Mesh coordinates are constrained to prevent tangential drift of contact-line vertices; interior surface vertices move vertically. Two independently generated mesh densities (48 and 96 angular sectors, 4 and 8 radial rings) estimate discretization sensitivity.

The grid contains five volumes (100, 200, 400, 850 and 950 µL), three inclinations (0°, 5°, 10°), and three assumed contact angles (40°, 70°, 100°). The current run converged in 44 of 45 cases. The 10° / 200 µL / 40° case did not converge near the cone-cylinder transition. It remains in the artifact, and the 10° configuration is excluded from supported optimization. The maximum mesh difference among converged cases was approximately 0.042 mm. This is an empirical refinement check, not a rigorous error bound between grid points.

The current supported screening domain is **0° or 5°, 100–950 µL**, with the assumed contact-angle range above. The controller also uses a 1.85 mm immersion allowance. Unsupported configurations cannot receive a favorable optimization score. The reference omits an immersed tip; the interactive kernel accounts for tip displacement but does not validate tip-induced meniscus deformation. Physical calibration is still required.

## Observation and belief

The presentation scene never supplies measurements to the observed controller. A separate CPU image renderer generates 112 × 144 pixel snapshots with orthographic calibration and capture timestamps. Rays traverse air, the nominal polypropylene wall and liquid using Snell refraction. Total internal reflection and overlong optical paths are masked. Noise, weak pellet contrast and glare are represented. This is an idealized optical model, not a calibrated camera implementation. Physical camera housings and their support geometry are outside the collision model.

Image features estimate a side-view liquid boundary, tube position and, when separable, a pellet direction. A particle filter tracks liquid volume, pose and pellet orientation. It carries a persistent liquid-level calibration nuisance variable so repeated observations do not treat a fixed bias as independent noise. Repeated capture groups cannot update the belief twice; the group identifier derives from the known action epoch, not a hidden liquid volume. Repeated side images do not repeatedly sharpen the same pose measurement.

The side camera cannot resolve the perpendicular seating coordinate. When that uncertainty affects access, an overhead observation constrains it. If pellet contrast and orientation history are both insufficient, the policy stops. The visible pellet highlight belongs to the explanatory view and is never a measurement.

## Controllers and evaluation

Four controllers share the environment and scoring: a fixed nominal procedure, a single image-derived point estimate, a belief-aware controller, and a hidden-state reference. The reference receives truth explicitly; it is a comparison for sensing limitations, not a learned policy or a guarantee of optimality.

Differential evolution searches withdrawal size, clearance margin, immersion depth, observation interval and supported stationary inclination. The ranking is feasibility first, then residual volume plus 0.3 seconds-equivalent per unit duration. The interface plots the separate residual/time/violation quantities and identifies its interactive search as training only. The optimization does not fit biological success or survival probabilities.

The hosted evaluation gives every controller three optimization seeds and the same candidate/episode budget. Candidate parameters are trained on disjoint scene seeds, selected using tuning scenes, and evaluated on 512 held-out paired scenes per primary comparison. Named random streams separate fixture placement, seating, orientation, starting volume, sensing and actuation. A separate 4,096-case geometric stress sample does not count as rendered episodes.

Whole-episode violations use Wilson 95% intervals. Mean residual and duration use 1,000 bootstrap replicates. Stops remain separate from completed tasks and remain in all averages. Zero observed violations would not imply zero risk. Results generated for an earlier model revision are not displayed as current evidence.

## Assets, replay and exports

The original labware and stage assets are authored by the Blender script in `scripts/assets.py`. The holder's presentation mesh and CAD exports share the constructive solid in `src/cad/solid.ts`; presentation bevels, fasteners and the colored index mark are cosmetic details. The printable solid is a nominal untested bench holder. It is not a centrifuge rotor component. Its cylindrical seating/retention concept, material choice, fit and chemical compatibility require physical testing before use.

Trace JSON includes camera pixel buffers, capture timestamps, policy parameters, scene configuration, model version, random seed, actions and outcomes. Import preserves those recorded observations rather than rerendering them with a newer model. CSV is a tabular event export. The CAD ZIP contains STL, 3MF and dimension notes. Both mesh exports contain identical geometry in millimetres.

Playback is checked at 60 samples per simulated second for continuity, speed limits and volume conservation. Aspiration animates during the pump stroke; the liquid remains stationary during settling. Camera evidence appears only after acquisition completes. These checks establish implementation consistency, not experimental physical accuracy.

## What requires a bench experiment

A useful next experiment would measure tube and tip dimensions, camera calibration and refraction, a seating-error distribution, liquid contact angles, pump-volume error and repeatable settling time. Only then would it be appropriate to study pellet disturbance, residual wash, yield or RNA integrity. A blinded set of real images and independently recorded motion would be needed before making real-camera or real-robot accuracy claims.

## Sources

- Transfyr, [AI and robotics](https://www.transfyr.ai/news/ai-robotics): execution data, process specification and robotics.
- Transfyr, [The lossless lab](https://www.transfyr.ai/news/the-lossless-lab): preserving experimental execution context.
- Khattab et al., [Density, viscosity and surface tension of water–ethanol mixtures](https://pcprakt.userpage.fu-berlin.de/SKRIPT/T13/DensityH2O_EtOH.pdf): adopted mixture properties.
- Ken Brakke, [Surface Evolver energies](https://kenbrakke.com/evolver/html/energies.htm), [constraints](https://kenbrakke.com/evolver/html/constrnt.htm) and [stability tutorial](https://kenbrakke.com/evolver/html/eigentut.htm): energy minimization and convergence checks.
- Pharr, Jakob and Humphreys, [Specular reflection and transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission): geometric optics and refraction.
- [Current equilibrium-reference run](https://github.com/raaaaaif/tacit/actions/runs/34421128895), including the retained nonconvergent case.

## Independent renderer consistency audit

Five additional images were rendered in Blender Cycles on CPU at 32 samples. Three side views cover 350, 400 and 850 µL, including a 5° case; two overhead images vary pellet contrast. The same pixel feature extractor was applied without retraining. Side-view level errors ranged from approximately 0.32 to 1.39 mm. The conservative pellet detector did not return a direction in either overhead reference image, including the visibly higher-contrast case. Both misses are retained.

This demonstrates a material limit: the primary renderer's feature error distribution does not establish accuracy in another renderer, much less a physical camera. The workbench's held-out results apply to its declared synthetic observation model. The reference images and raw feature output are available under `public/reference/`; they should be part of a discussion of calibration, domain shift and abstention.
