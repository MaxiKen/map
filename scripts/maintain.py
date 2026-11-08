#!/usr/bin/env python3
"""One entry point for routine build, artifact, Python and browser verification."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(label, command, env):
    print(f'\n==> {label}\n    {" ".join(map(str, command))}', flush=True)
    subprocess.run(list(map(str, command)), cwd=ROOT, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true', help='Rebuild public/ before verification')
    parser.add_argument('--check-build', action='store_true',
                        help='Also require a temporary rebuild to match public/ byte-for-byte')
    parser.add_argument('--skip-browser', action='store_true',
                        help='Skip npm/Chromium checks (not sufficient for a release)')
    args = parser.parse_args()
    env = os.environ.copy()
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    env['PYTHONUNBUFFERED'] = '1'
    python = sys.executable

    try:
        if args.build:
            run('Build the static site', [python, 'scripts/build_site.py'], env)
        run('Compile Python sources', [python, '-m', 'compileall', '-q', 'scripts', 'tests'], env)
        if args.check_build:
            run('Check reproducible public output', [python, 'scripts/check_build.py'], env)
        run('Validate geospatial and public artifacts', [python, 'scripts/validate_artifacts.py'], env)
        run('Run Python and Node regression suites', [python, '-m', 'unittest', 'discover', '-s', 'tests', '-v'], env)
        if not args.skip_browser:
            npm = 'npm.cmd' if os.name == 'nt' else 'npm'
            run('Install locked browser-test dependencies', [npm, 'ci', '--no-audit', '--no-fund'], env)
            run('Run Chromium, offline and visual tests', [npm, 'run', 'test:browser'], env)
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode or 1) from error
    except FileNotFoundError as error:
        raise SystemExit(f'Required executable not found: {error.filename}') from error
    print('\nMaintenance verification passed.' + (' Browser checks were skipped.' if args.skip_browser else ''))


if __name__ == '__main__':
    main()
