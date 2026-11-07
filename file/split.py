import geopandas as gpd

src = "Nigeria_Geology_and_Mineral_Resources_digitized.gpkg"
parts = 20

gdf = gpd.read_file(src)  # add layer="layer_name" if the file has several layers
size = -(-len(gdf) // parts)

for i in range(parts):
    chunk = gdf.iloc[i*size:(i+1)*size]
    chunk.to_file(f"part_{i+1:02d}.gpkg", driver="GPKG", layer="data")