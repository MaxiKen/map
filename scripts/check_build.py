#!/usr/bin/env python3
"""Rebuild public/ into a temporary directory and require byte-identical output."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def inventory(root):
    return {str(path.relative_to(root)): path for path in root.rglob('*') if path.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', default='public')
    parser.add_argument('--data', default='data')
    parser.add_argument('--app', default='app')
    parser.add_argument('--config', default='config/layers.config.json')
    args = parser.parse_args()
    public = (ROOT / args.public).resolve()
    catalog = json.loads((public / 'catalog.json').read_text(encoding='utf8'))
    built = dt.datetime.strptime(catalog['built'], '%Y-%m-%d %H:%M UTC').replace(tzinfo=dt.timezone.utc)
    env = os.environ.copy()
    env['SOURCE_DATE_EPOCH'] = str(int(built.timestamp()))
    env['PYTHONDONTWRITEBYTECODE'] = '1'

    with tempfile.TemporaryDirectory(prefix='ngmap-build-check-') as temporary:
        output = Path(temporary) / 'public'
        subprocess.run([
            sys.executable, str(ROOT / 'scripts/build_site.py'),
            '--data', str((ROOT / args.data).resolve()),
            '--app', str((ROOT / args.app).resolve()),
            '--config', str((ROOT / args.config).resolve()),
            '--out', str(output),
        ], cwd=ROOT, env=env, check=True)
        expected, actual = inventory(public), inventory(output)
        missing = sorted(expected.keys() - actual.keys())
        extra = sorted(actual.keys() - expected.keys())
        changed = sorted(name for name in expected.keys() & actual.keys()
                         if digest(expected[name]) != digest(actual[name]))
        if missing or extra or changed:
            for label, names in (('missing', missing), ('unexpected', extra), ('different', changed)):
                for name in names[:30]:
                    print(f'{label}: {name}', file=sys.stderr)
            if changed:
                name = changed[0]
                print(f'first difference: {name}\n  committed: {digest(expected[name])}\n'
                      f'  rebuilt:   {digest(actual[name])}', file=sys.stderr)
            raise SystemExit(f'Public build is stale or not reproducible: {len(missing)} missing, '
                             f'{len(extra)} unexpected, {len(changed)} different file(s)')
        index = (public / 'index.html').read_text(encoding='utf8')
        version = re.search(r'<meta name="build" content="([^"]+)"', index).group(1)
        print(f'Reproducible public build verified: {len(expected)} files, build {version}, '
              f'timestamp {catalog["built"]}')


if __name__ == '__main__':
    main()
