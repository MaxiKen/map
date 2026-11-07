#!/usr/bin/env python3
"""Output-path helpers for the import/fetch utilities.

The site builder does NOT use these defaults: it always takes a layer's group from
its top-level folder under data/. These helpers merely prevent the repository's
maintenance scripts from writing new GeoPackages directly into data/.

When a GeoPackage already exists in a group folder, its current location and any
hidden_ filename prefix always win. Moving or hiding a layer therefore survives
an automated refresh instead of creating a visible duplicate.
"""
import glob
import os


# Destinations for layers that the maintenance scripts can create for the first
# time. These are folder/display names, not filename-derived catalog groups.
DEFAULT_GROUPS = {
    'admin': 'Administrative boundaries',
    'climate': 'Climate',
    'elevation': 'Elevation - DEM',
    'ethnic': 'Ethnic groups',
    'forest': 'Forest',
    'geology': 'Geology',
    'geophysics': 'Geology',
    'groundwater': 'Groundwater & hydrogeology',
    'hazards': 'Natural hazards',
    'infrastructure': 'Infrastructure & services',
    'landcover': 'Land cover',
    'minerals': 'Mineral resources',
    'population': 'Population',
    'protected': 'Protected areas',
    'reference': 'Reference',
    'settlements': 'Settlements',
    'soil': 'Soils',
    'transport': 'Transport',
    'water': 'Water',
}


def group_for_table(table):
    """Return the maintenance default group; the builder never uses this function."""
    prefix = table.split('_', 1)[0]
    try:
        return DEFAULT_GROUPS[prefix]
    except KeyError as e:
        raise ValueError(
            f'No default group is registered for {table!r}. Create its group folder '
            f'and place {table}.gpkg there, or add an explicit default in data_paths.py.') from e


def layer_path(data_dir, table):
    """Return the grouped .gpkg path for table, preserving visibility and location."""
    filenames = (table + '.gpkg', 'hidden_' + table + '.gpkg')
    existing = []
    for filename in filenames:
        existing.extend(glob.glob(os.path.join(data_dir, '*', '**', filename), recursive=True))
    existing = sorted(set(existing))
    if len(existing) > 1:
        raise RuntimeError(f'{table} occurs in more than one group/visibility file: {existing}')
    if existing:
        return existing[0]

    out = os.path.join(data_dir, group_for_table(table), table + '.gpkg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    return out
