import glob
import pandas as pd
import pyogrio

files = sorted(glob.glob("part_*.gpkg"))
collected = {}

for f in files:
    for name in pyogrio.list_layers(f)[:, 0]:
        collected.setdefault(name, []).append(pyogrio.read_dataframe(f, layer=name))

for name, frames in collected.items():
    merged = pd.concat(frames, ignore_index=True)
    pyogrio.write_dataframe(merged, "big_merged.gpkg", layer=name, driver="GPKG")
    print(name, len(merged), "features merged")