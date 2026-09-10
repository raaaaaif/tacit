# Application response draft

I built TACIT because one of the most important parts of lab automation is the judgment hidden inside a simple instruction.

During RNA isolation, “remove the wash without disturbing the pellet” depends on context: whether you know the tube’s orientation, whether the pellet is visible, what path a real tip can take, and when uncertainty should stop the action. My wet-lab experience made that problem concrete. My experience designing objects in 3D made me interested in changing the fixture as well as the software.

TACIT is a browser workbench for that single handling step. It connects a dimensioned 3D scene to a simulation kernel, separately rendered camera evidence, a particle-based state estimate, constrained policy search, and replayable execution traces. The output includes JSON/CSV evidence and a parametric holder export. The source and experiment commands are public.

The part I would most want to discuss with your team is where the workbench refuses to infer more than its evidence supports. Repeated ambiguous observations cannot manufacture an orientation record. An unconverged capillary-reference case is excluded from supported optimization. A separate Blender image set exposes renderer dependence. The project claims physical reasoning and inspectable engineering decisions; it does not claim biological validation.

That is why Transfyr’s physical-AI and life-sciences direction interests me: preserving how scientific work is actually executed makes it possible to specify, evaluate and eventually automate it more faithfully. TACIT is a small example of how I approach the gap between a scientific workflow and the system that has to carry it out.

Source: https://github.com/raaaaaif/tacit

Before submitting, add the published demo link and the short walkthrough video. Do not submit this application automatically; Raaif should review the final wording and choose the submission timing.
