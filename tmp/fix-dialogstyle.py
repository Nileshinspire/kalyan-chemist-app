import subprocess
from pathlib import Path
import re

file = Path('src/components/admin/ProductBatchesDialog.tsx')
text = file.read_text(encoding='utf-8')

pattern = re.compile(
    r'(        style=\{\{\n)'
    r'(          width: "100%",\n)'
    r'(          maxWidth: "min\(900px, calc\(100vw - 32px\)\)",\n)'
    r'(          maxHeight: "calc\(100dvh - 32px\)",\n)'
    r'(          boxSizing: "border-box",\n)'
    r'(          minWidth: 0,\n)'
    r'(\        \}\})\n',
    re.MULTILINE,
)

m = pattern.search(text)
if not m:
    print('no style block found')
    raise SystemExit(1)

new_style = (
    '        style={{\n'
    '          width: "100%",\n'
    '          maxWidth: "min(900px, calc(100vw - 32px))",\n'
    '          maxHeight: "calc(100dvh - 32px)",\n'
    '          boxSizing: "border-box",\n'
    '          minWidth: 0,\n'
    '          paddingLeft: `${viewportWidth < 480 ? 12 : 20}px`,\n'
    '          paddingRight: `${viewportWidth < 480 ? 12 : 20}px`,\n'
    '          paddingTop: `${viewportWidth < 480 ? 12 : 20}px`,\n'
    '          paddingBottom: `${viewportWidth < 480 ? 12 : 20}px`,\n'
    '        }}\n'
)

text2 = text[: m.start()] + new_style + text[m.end():]
file.write_text(text2, encoding='utf-8')
print('done')
