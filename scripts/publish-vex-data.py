"""Publish committed public snapshots; retrieve private rating code only in an authenticated runner."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import urllib.error

ENDPOINT = 'https://vexoverride.com/api/data-publish'
ROOT = Path.cwd()

def identity():
    url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'] + '&audience=' + urllib.parse.quote(ENDPOINT, safe='')
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)['value']

def call(payload=None):
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': 'Bearer ' + identity(), 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)

def build():
    bundle = call()
    allowed = {'scripts/build-pigeonscore.mjs', 'scripts/lib/pigeonscore-engine.mjs', 'scripts/lib/match-performance.mjs', 'scripts/lib/public-ratings.mjs', 'v2/modules/match-evidence.js'}
    if set(bundle.get('files', {})) != allowed:
        raise ValueError('Unexpected build bundle')
    with tempfile.TemporaryDirectory(prefix='vex-rating-') as directory:
        private = Path(directory)
        (private / 'package.json').write_text('{"type":"module"}')
        for name, content in bundle['files'].items():
            path = private / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        (private / 'data').symlink_to(ROOT / 'data', target_is_directory=True)
        shutil.copyfile(ROOT / 'v2/team-index.json', private / 'v2/team-index.json')
        subprocess.run(['node', str(private / 'scripts/build-pigeonscore.mjs')], check=True)
        shutil.copyfile(private / 'v2/pigeonscore.json', ROOT / 'v2/pigeonscore.json')

def publish():
    paths = [ROOT / 'v2/team-index.json', ROOT / 'v2/pigeonscore.json']
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
    result = call({'commit': commit, 'files': files, 'vexToken': os.environ.get('VEX_EVENTS_TOKEN', '')})
    print(json.dumps(result))

if __name__ == '__main__':
    try:
        {'build': build, 'publish': publish}[sys.argv[1]]()
    except urllib.error.HTTPError as error:
        print('Site delivery failed: HTTP ' + str(error.code), file=sys.stderr)
        sys.exit(1)
