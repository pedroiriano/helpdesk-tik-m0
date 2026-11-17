"""Create missing local development secrets only. Never rotate existing secrets."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
target = root / '.local' / 'secrets'
target.mkdir(parents=True, exist_ok=True)
for name in ['postgres', 'session_key'] + [f'm{i}' for i in range(1, 10)]:
    path = target / name
    if not path.exists():
        with path.open('x', encoding='ascii') as f:
            f.write(secrets.token_hex(32))
print('PASS local secrets prepared; existing values preserved')
