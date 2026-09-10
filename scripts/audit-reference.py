"""Reapply the current pixel detector to the saved independent Blender images."""
from pathlib import Path
from PIL import Image
import subprocess
root=Path(__file__).resolve().parents[1]
(root/'work').mkdir(exist_ok=True)
for path in (root/'public/reference').glob('*.png'):
    (root/'work'/f'{path.stem}.rgba').write_bytes(Image.open(path).convert('RGBA').tobytes())
subprocess.run(['npx','tsx','scripts/audit-reference.ts'],cwd=root,check=True)
