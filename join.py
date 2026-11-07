import glob
import pandas as pd
import geopandas as gpd

files = sorted(glob.glob("part_*.gpkg"))
gdf = pd.concat([gpd.read_file(f, layer="data") for f in files], ignore_index=True)
gdf = gpd.GeoDataFrame(gdf, crs=gpd.read_file(files[0], layer="data").crs)
gdf.to_file("big_merged.gpkg", driver="GPKG", layer="data")
print(len(gdf), "features merged")