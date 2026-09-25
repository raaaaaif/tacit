"""Decode the independent Cycles grid and apply the unchanged feature extractor."""
from pathlib import Path
from PIL import Image
import subprocess
root=Path(__file__).resolve().parents[1]
(root/'work/refinement').mkdir(parents=True,exist_ok=True)
for path in (root/'public/reference-readiness').glob('*.png'):
    (root/'work/refinement'/f'{path.stem}.rgba').write_bytes(Image.open(path).convert('RGBA').tobytes())
subprocess.run(['npx','tsx','scripts/audit-readiness-optics.ts'],cwd=root,check=True)
