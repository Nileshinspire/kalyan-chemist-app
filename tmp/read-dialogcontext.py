import pathlib
import sys

p = pathlib.Path('src/components/admin/ProductBatchesDialog.tsx')
text = p.read_text(encoding='utf-8')
lines = text.splitlines(keepends=True)

start = None
for i, line in enumerate(lines, start=1):
    if '<DialogContent' in line:
        start = i
        break
else:
    print('DialogContent tag not found')
    sys.exit(1)

for j in range(start, start + 8):
    if j - 1 >= len(lines):
        break
    stripped = lines[j - 1].rstrip('\n')
    print(f"{j}:{stripped}")
