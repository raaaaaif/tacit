# TACIT

A physical reasoning workbench for laboratory automation. Built by Raaif Bokhari around a familiar wet-lab action: removing wash liquid while preserving an RNA pellet.

**Development build.** The interface and deterministic simulation are functional. Reference-model calculations, held-out experiments, and final release verification are tracked in the research workflow. This repository does not claim biological validation.

## Run locally

Node 24 is recommended.

```sh
npm ci
npm run dev
npm test
npm run build
```

The browser app needs no account, API key, database, or local AI model. Three.js runs the explanatory view; a separate worker runs the simulation and pixel-based observations. CAD is loaded on demand.

## What is modeled

- Nominal tube, complete tapered tip and shaft, cap, holder, and Cartesian travel.
- Conserved liquid volume with immersed-tip displacement and inclined-container integration.
- Air / polypropylene / liquid refraction; image-derived level and pose features.
- A particle belief and controllers with different access to evidence.
- Reproducible action traces, explicit stops, and constraint violations.

Dimensions and material properties live in `src/model/dimensions.json`. All model geometry uses millimetres: 1 mm³ = 1 µL. Geometry is nominal; no manufacturer fit certification is implied. Near-tip hydrodynamics, adhesion, RNA yield, and final pellet-adjacent drying require physical validation.

## Reproducible assets

`scripts/assets.py` authors the original labware and workcell using Blender. Run Blender in background mode with this script to regenerate the compact glTF assets. No external asset pack is used. IBM Plex fonts are self-hosted through Fontsource and retain their upstream licenses.

## Research context

- [Transfyr: execution data for robotics](https://www.transfyr.ai/news/ai-robotics)
- [Ethanol–water mixture properties](https://pcprakt.userpage.fu-berlin.de/SKRIPT/T13/DensityH2O_EtOH.pdf)
- [Surface Evolver energy model](https://kenbrakke.com/evolver/html/energies.htm)
- [Geometric optics](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission)

Independent application project; no affiliation or integration with Transfyr is implied.
