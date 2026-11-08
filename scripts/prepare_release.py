#!/usr/bin/env python3
"""Move CHANGELOG's Unreleased notes into a version and align npm metadata."""
import argparse
import datetime as dt
import json
from pathlib import Path
from release_utils import numeric_version, valid_date

ROOT = Path(__file__).resolve().parents[1]


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf8')


def prepare(root, version, date):
    root = Path(root)
    version = numeric_version(version)
    date = valid_date(date)
    changelog = root / 'CHANGELOG.md'
    text = changelog.read_text(encoding='utf8')
    marker = '## [Unreleased]'
    if text.count(marker) != 1:
        raise ValueError('CHANGELOG.md must contain exactly one [Unreleased] section')
    start = text.index(marker) + len(marker)
    end = text.find('\n## [', start)
    end = len(text) if end < 0 else end
    notes = text[start:end].strip()
    if not notes:
        raise ValueError('Add maintenance notes under [Unreleased] before preparing a release')
    if f'## [{version}]' in text:
        raise ValueError(f'Release {version} already exists in CHANGELOG.md')

    package = json.loads((root / 'package.json').read_text(encoding='utf8'))
    lock = json.loads((root / 'package-lock.json').read_text(encoding='utf8'))
    package['version'] = version
    lock['version'] = version
    if lock.get('packages', {}).get('') is not None:
        lock['packages']['']['version'] = version
    replacement = f'{marker}\n\n## [{version}] - {date}\n\n{notes}\n'
    changelog.write_text(text[:start - len(marker)] + replacement + text[end:], encoding='utf8')
    write_json(root / 'package.json', package)
    write_json(root / 'package-lock.json', lock)
    return version, date


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('version', help='Stable release version, X.Y.Z or vX.Y.Z')
    parser.add_argument('--date', default=dt.datetime.now(dt.timezone.utc).date().isoformat(),
                        help='Release date in YYYY-MM-DD (default: current UTC date)')
    args = parser.parse_args()
    try:
        version, date = prepare(ROOT, args.version, args.date)
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(str(error)) from error
    print(f'Prepared {version} ({date}). Review CHANGELOG.md and package metadata, then run:')
    print('  python scripts/maintain.py --build --check-build')
    print('Commit and merge normally before tagging the resulting main commit.')


if __name__ == '__main__':
    main()
