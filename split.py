import pyogrio

src = "Nigeria_Geology_and_Mineral_Resources_digitized.gpkg"
parts = 20

layers = pyogrio.list_layers(src)[:, 0]
print("Layers:", list(layers))

for name in layers:
    df = pyogrio.read_dataframe(src, layer=name)
    size = -(-len(df) // parts)
    for i in range(parts):
        chunk = df.iloc[i*size:(i+1)*size]
        if chunk.empty:
            continue
        pyogrio.write_dataframe(chunk, f"part_{i+1:02d}.gpkg", layer=name, driver="GPKG")
    print(name, len(df), "features")