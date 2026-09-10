# TACIT: three-minute walkthrough

Keep the browser at 1920 × 1080, reset the camera, and use 2× playback. Turn off browser notifications before recording. A stop is part of the story; do not describe it as successful completion or pellet survival.

**0:00–0:20 — The task.**

“In RNA isolation, ‘remove the wash without disturbing the pellet’ sounds like one instruction. At the bench it depends on things that are rarely written down: orientation history, a difficult-to-see pellet, how far the tip can enter, and how much uncertainty remains. TACIT makes that execution context explicit.”

**0:20–0:55 — A run.**

Leave Known setup and Belief-aware selected. Click Run procedure. While it plays, briefly switch to the whole-workcell view and back.

“The policy can move, withdraw, observe or stop. The scene shows the physical state; the separate camera snapshots are the evidence used by the controller. The stage follows its speed and acceleration limits, and withdrawn liquid is conserved between tube and tip.”

**0:55–1:30 — Inspect the decision.**

Click Inspect this decision after the stop. Scrub to a camera event, then advance across its capture boundary. Show that the snapshot and estimate change only after acquisition. Return to the final event.

“The evidence, motion and decision share one clock. This run retains liquid because the remaining uncertainty consumes the declared clearance. That is a conservative simulated stop—not a claim about RNA yield.”

**1:30–2:05 — Missing context.**

Go to Run → Missing context. Keep Belief-aware selected. Run it. Point out both camera views and the unresolved orientation. Optionally show Design → Orientation index: adding an index cannot recreate lost history.

“Another view is useful only if it supplies information. An effectively invisible pellet and a missing orientation record should not become a confident action just because we looked twice.”

**2:05–2:40 — Design and evidence.**

Return to Known setup. Open Design. Show the stationary 0°, 5° and 10° holders. The 10° equilibrium-reference case is unsupported and must not be presented as an improvement. Show the held-out results. Filter to Known setup and switch between baseline and tuned policies: the belief-aware mean residual changes from 184 to 161 µL, with many conservative stops still retained. The saved training search is ready immediately; use Apply candidate and Test this configuration if you want a second run. Interactive policy search is cancellable and its scatterplot is training-only; avoid waiting for a full search in the recording.

“The fixture changes the conditions under which a policy can act. Geometry, observation and the policy have to be evaluated together. The comparisons keep residual wash, time, violations and conservative stops separate.”

**2:40–3:00 — Export and connection.**

Export the holder ZIP, and show the trace JSON/CSV controls in Investigate.

“The output is inspectable execution evidence and a dimensioned design, with the assumptions and negative results attached. That is the bridge I wanted to build between wet-lab judgment, 3D engineering and Transfyr’s work on scientific execution data for physical AI.”

Avoid these claims: “validated robot,” “safe aspiration,” “pellet survival,” “improved RNA yield,” “zero risk,” or “production-ready fixture.” Be ready to explain the optical consistency audit and the excluded surface-reference case. Those are part of the engineering work, not footnotes to hide.
