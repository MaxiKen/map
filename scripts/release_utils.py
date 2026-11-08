"""Shared, side-effect-free release parsing helpers."""
import datetime as dt
import json
from pathlib import Path
import re

VERSION_RE = re.compile(r'^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')


def numeric_version(value):
    match = VERSION_RE.fullmatch(value)
    if not match:
        raise ValueError(f'Invalid stable semantic version: {value!r}; expected X.Y.Z or vX.Y.Z')
    return '.'.join(match.groups())


def valid_date(value):
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as error:
        raise ValueError(f'Invalid release date {value!r}; expected YYYY-MM-DD') from error


def changelog_section(path, version):
    """Return (ISO date, Markdown body) for one released changelog section."""
    lines = Path(path).read_text(encoding='utf8').splitlines()
    header = re.compile(rf'^## \[{re.escape(version)}\] - (\d{{4}}-\d{{2}}-\d{{2}})$')
    starts = [index for index, line in enumerate(lines) if header.fullmatch(line)]
    if len(starts) != 1:
        raise ValueError(f'CHANGELOG.md must contain exactly one released [{version}] section')
    start = starts[0]
    date = valid_date(header.fullmatch(lines[start]).group(1))
    end = next((index for index in range(start + 1, len(lines))
                if lines[index].startswith('## [')), len(lines))
    body = '\n'.join(lines[start + 1:end]).strip()
    if not body:
        raise ValueError(f'Release notes for {version} are empty')
    return date, body


def public_build(root):
    root = Path(root)
    index = (root / 'public/index.html').read_text(encoding='utf8')
    match = re.search(r'<meta name="build" content="([0-9a-f]{10})"', index)
    if not match:
        raise ValueError('public/index.html has no valid ten-character build identifier')
    catalog = json.loads((root / 'public/catalog.json').read_text(encoding='utf8'))
    return match.group(1), catalog
