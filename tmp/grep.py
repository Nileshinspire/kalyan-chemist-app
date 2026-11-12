import re
from pathlib import Path
for p in Path('src/components/admin/ProductBatchesDialog.tsx').read_text(encoding='utf-8').splitlines():
    if 'paddingLeft' in p:
        print(p.rstrip())
