#!/usr/bin/env python3
"""Package a validated public/ tree as deterministic GitHub Release assets."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile
from release_utils import changelog_section, numeric_version, public_build

ROOT = Path(__file__).resolve().parents[1]


def file_digest(path):
    value = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def zip_info(name, date):
    stamp = dt.datetime.combine(dt.date.fromisoformat(date), dt.time(), tzinfo=dt.timezone.utc)
    info = zipfile.ZipInfo(name, (stamp.year, stamp.month, stamp.day, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def package(root, requested_version, output, commit):
    root = Path(root)
    output = Path(output)
    version = numeric_version(requested_version)
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Release packaging requires the full 40-character lowercase source commit')
    tag = f'v{version}'
    date, notes = changelog_section(root / 'CHANGELOG.md', version)
    package_version = json.loads((root / 'package.json').read_text(encoding='utf8'))['version']
    if package_version != version:
        raise ValueError(f'package.json version {package_version!r} does not match tag {tag}')
    build, catalog = public_build(root)
    register_bytes = (root / 'public/quality-register.json').read_bytes()
    register_hash = hashlib.sha256(register_bytes).hexdigest()
    if catalog.get('layerQualityRegister', {}).get('registerSha256') != register_hash:
        raise ValueError('Public quality-register bytes do not match the catalog hash')

    files = []
    for path in sorted((root / 'public').rglob('*')):
        if path.is_file():
            files.append({
                'path': path.relative_to(root / 'public').as_posix(),
                'bytes': path.stat().st_size,
                'sha256': file_digest(path),
            })
    if not files:
        raise ValueError('public/ is empty')
    manifest = {
        'schemaVersion': 1,
        'application': catalog.get('title', 'Nigeria WebGIS'),
        'version': version,
        'tag': tag,
        'releaseDate': date,
        'commit': commit,
        'build': build,
        'catalogBuilt': catalog.get('built'),
        'publishedLayers': len(catalog.get('layers', [])),
        'sourceLayers': catalog.get('layerQualityRegister', {}).get('summary', {}).get('layer_count'),
        'publishedFeatures': sum(layer.get('count') or 0 for layer in catalog.get('layers', [])),
        'qualityRegisterSha256': register_hash,
        'files': files,
    }
    output.mkdir(parents=True, exist_ok=True)
    stem = f'ngmap-{tag}-{build}'
    archive_path = output / f'{stem}.zip'
    manifest_path = output / f'{stem}-manifest.json'
    notes_path = output / f'{stem}-notes.md'
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode('utf8')
    manifest_path.write_bytes(manifest_bytes)

    prefix = f'{stem}/'
    with zipfile.ZipFile(archive_path, 'w') as archive:
        for record in files:
            source = root / 'public' / record['path']
            with source.open('rb') as reader, archive.open(zip_info(prefix + record['path'], date), 'w') as writer:
                shutil.copyfileobj(reader, writer, 1024 * 1024)
        archive.writestr(zip_info(prefix + 'release.json', date), manifest_bytes)
    with zipfile.ZipFile(archive_path) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise ValueError(f'ZIP CRC verification failed for {corrupt}')

    archive_hash = file_digest(archive_path)
    checksum_path = output / f'{stem}.sha256'
    checksum_path.write_text(f'{archive_hash}  {archive_path.name}\n', encoding='ascii')
    notes_path.write_text(
        notes + f'\n\n---\n\nBuild `{build}` · catalog built {catalog.get("built")} · commit `{commit}`.\n\n'
        f'The ZIP contains the complete static site and `release.json` with hashes for all '
        f'{len(files)} published files. Extract it and serve the folder with any static HTTP server. '
        'The reusable validation workflow passed before these assets were uploaded.\n',
        encoding='utf8')
    return {
        'archive': archive_path,
        'checksum': checksum_path,
        'manifest': manifest_path,
        'notes': notes_path,
        'sha256': archive_hash,
        'build': build,
        'tag': tag,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('version', help='Release tag or version, X.Y.Z or vX.Y.Z')
    parser.add_argument('--output', default='dist')
    args = parser.parse_args()
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, check=True,
                            text=True, capture_output=True).stdout.strip()
    try:
        result = package(ROOT, args.version, ROOT / args.output, commit)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error)) from error
    print(f'Packaged {result["tag"]} build {result["build"]}:')
    for key in ('archive', 'checksum', 'manifest', 'notes'):
        print(f'  {key}: {result[key]}')
    print(f'SHA-256: {result["sha256"]}')


if __name__ == '__main__':
    main()
