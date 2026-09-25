# Start here

[Open TACIT](https://tacit-workbench.pages.dev).

TACIT simulates a pipette removing wash liquid while staying clear of a pellet at the bottom of a tube. Run an attempt, inspect why it stopped, then change its information or controller. This is a synthetic research model, not equipment operating a real laboratory.

## Your first attempt

1. Open **Run**. Choose **Known setup** and **Readiness controller**; leave instrument settings at their defaults.
2. Click **Run simulation**. TACIT computes the attempt, then plays its recorded actions. If paused, click **Replay** in the execution timeline.
3. Let playback finish, or drag the time slider to the right. At the default seed, 1847, approximately **836 µL** initially becomes **580 µL removed** and **256 µL remaining**, after **39.75 simulated seconds**. The target is **150 µL remaining**: this is progress followed by a stop, not completion.
4. Click **Inspect this decision**, or open **Investigate**, then **First blocker**. None of four tested withdrawals passed every check. Pellet exclusion blocked all four; hardware clearance blocked one. These rejected proposals were not executed.
5. Use **Inspect a searched alternative** to read one proposal's checks. **Show observations and tested alternatives** opens its evidence sources and timing. The decision arrows move between decisions; the timeline arrows move by individual animation frames.

The first question to answer is: **what prevented the next withdrawal?**

## Compare two attempts

Open **Design → Policy → Run paired comparison**. A and B start with the same physical scene:

- **A · Fixed + preflight** checks one fixed approach.
- **B · Readiness controller** tests bounded alternatives and can consider another observation.

In the default known scene, A removes about **361 µL** and B about **580 µL**. B removes **219 µL more** but takes **10.6 additional simulated seconds**. Both stop before the target. Read volume, elapsed time and outcome together.

**Inspect this arm** opens either record in Investigate. **Replay** watches it; **Run simulation** recomputes an attempt with the currently prepared specification. Unchanged inputs and seed produce a repeat, not a fresh random trial.

The three comparison choices mean:

| Choice | What changes between A and B |
|---|---|
| **Context** | A receives existing handling/orientation history; B has it withheld. The physical tube stays the same. Requires a scene with a record to withhold. |
| **Observation** | A has the side camera; B can also use the overhead camera. Availability does not guarantee a capture or better progress. |
| **Policy** | Fixed + preflight becomes Readiness controller, with the same declared evidence access. |

Open **Declared default comparison settings** for the paired policies. Run's editable settings apply to single runs; paired comparisons use their declared defaults. After choosing another comparison, click **Run paired comparison** to compute its example.

## Separate the example from the population

**Illustrative episode** is your selected pair. **Results across the assigned scenes** is a separate, previously computed exploratory population, visible even before you compute an example.

The saved 36-pair policy comparison averages **262.2 µL more removal** and **15.8 seconds more elapsed time**. All 36 A episodes and all 36 B episodes stop, with zero target completions. The plot retains the three cases where readiness removes less. A population average is not the expected difference in every scene.

The main figures use **B − A**: positive removal means B removes more; positive time means B takes longer. **Scene family** filters these results. The optional **All-family mean effects across the three interventions** always uses all families and plots **residual** differences: negative means less liquid remains in B.

## Read the displays

| Display | Meaning |
|---|---|
| **µL** | Microliters; 1,000 µL = 1 mL. |
| **Simulated remaining / removed** | Liquid still in the tube / cumulative liquid withdrawn at the selected replay time. |
| **Simulator state · not controller input** | The 3D scene shows the exact simulated state, which ordinary controllers do not receive. |
| **Liquid estimate · marginal 95% interval** | The controller's uncertain estimate from available evidence; not exact simulator truth or a joint safety guarantee. |
| **Camera cards** | Saved synthetic snapshots, not continuous video. Capture time and age identify when the evidence was acquired. |
| **Available · not captured yet** | That camera is available, but no image has been acquired by this replay time. |
| **Not enabled in this run** | That camera was excluded from the run's evidence access. |
| **BLOCKED / UNKNOWN** | A selected proposal failed a check / could not resolve it. A blocked proposal is not itself a recorded collision. |
| **PASS** | That check passed under model assumptions; the entire task may still be incomplete. |
| **Stopped before target** | The attempt ended without reaching its evaluated completion condition. |
| **Constraint violation recorded** | The recorded run breached a modeled constraint, unlike a proposal rejected before acting. |

Use **Replay/Pause**, restart, speed and scrub controls to revisit a record. Space controls replay when focus is outside buttons and fields; it does not start the first computation. R resets the 3D camera.

## Save and reopen

In Design, **Export paired evidence** saves both arms and their evidence. Reopen it through **Investigate → Import a saved trace**, then return to Design to see both restored arms. The same import control accepts single traces and paired packets.

The separate population download contains outcomes, the plan and assignment ledger—not every episode's original camera pixels and receipts.

## Geometry is optional

**Inspect workcell & research geometry → Research geometry & advanced search** opens holder configuration and export tools. The holder has not been fabricated or physically fit-tested; exports are not fabrication recommendations. TACIT does not establish robot safety, RNA yield or biological success. See the [methods dossier](methods.md) for model limits.
