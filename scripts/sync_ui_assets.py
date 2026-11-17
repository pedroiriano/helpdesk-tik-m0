"""Copy original CSS into runtime assets, with exact-byte provenance."""
from pathlib import Path
import hashlib, json, shutil

root = Path(__file__).resolve().parents[1]
records = []
for name, directory in [('piui-modern', 'css'), ('piui-zero', 'assets/css')]:
    source = root / 'references' / name / directory
    dest = root / 'frontend/public/vendor' / name / 'css'
    dest.mkdir(parents=True, exist_ok=True)
    for file in sorted(source.glob('*.css')):
        output = dest / file.name
        shutil.copy2(file, output)
        records.append({'source': file.relative_to(root).as_posix(),
                        'runtime': output.relative_to(root).as_posix(),
                        'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
(root / 'frontend/vendor-manifest.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print(f'PASS {len(records)} original PIUI CSS assets copied')
