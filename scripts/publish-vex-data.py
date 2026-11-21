"""Create an atomic release manifest after committing the public datasets."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path.cwd()
paths = [ROOT / 'v2/team-index.json', ROOT / 'data/rating-input.json']
paths += [ROOT / 'data/events' / (name + '.json') for name in ['catalog', 'index']]
paths += [ROOT / 'data/season-204' / (name + '.json') for name in ['skills-high-school', 'skills-middle-school', 'sync-status']]
paths += [p for p in (ROOT / 'data/events').glob('*/*.json') if p.parent.name.isdigit() and p.stem in {'event', 'teams', 'skills', 'matches', 'rankings', 'awards', 'meta'}]
files = {}
for path in paths:
    if not path.exists():
        if path.name == 'skills-middle-school.json':
            continue
        raise ValueError('Required dataset missing: ' + str(path.relative_to(ROOT)))
    body = path.read_bytes()
    json.loads(body)
    files['/' + path.relative_to(ROOT).as_posix()] = {'sha256': hashlib.sha256(body).hexdigest(), 'size': len(body)}
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
manifest = {'commit': commit, 'files': files}
(ROOT / 'data/site-release.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
print(json.dumps({'commit': commit, 'files': len(files)}))
