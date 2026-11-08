# Residual ward/LGA exception review

**Status: three evidence-backed LGA corrections applied; all 40 cases reviewed.**

The pre-review register contains 40 cases in 20 states. INEC controls ward-to-LGA assignment. The ArcGIS/Michael Bauer Research/NBS 2023 service supplies an independent point-intersection check. Neither source licenses forced containment, coordinate movement or automatic relabelling of a containing polygon.

## Outcome

- **3 LGA attribute corrections:** Kwarau → Igabi, Gidan Waya → Jema’a, and Ward XI E9 I → Ibadan North East. Ward names and coordinates are unchanged.
- **20 boundary-generalisation/source-disagreement retentions.** INEC assignments are retained; local and independent polygon results are recorded individually.
- **14 coastal/water retentions.** Empty local land containers and conflicting coastal polygons are not treated as proof of an LGA error.
- **2 suspect-coordinate retentions:** Gambaki/Bidir and Ilasa II/Ikun/Araromi. Both boundary sources disagree with INEC by more than 1 km, so coordinates need separate authoritative corroboration rather than an LGA relabel.
- **1 delimitation-uncertainty retention:** Kwambai remains assigned to Ussa with its original point. Current INEC extraction is incomplete and the Takum/Ussa history is disputed.
- **0 ward geometries changed.** The ledger stores complete before/after attributes and SHA256 geometry hashes for all 40 cases.

## Applied LGA plan

| feature_index | FID | Ward | Previous LGA | Reviewed LGA | Old centroid km | New centroid km |
|---:|---:|---|---|---|---:|---:|
| 4095 | 4096 | Kwarau | Kaduna North | Igabi | 17.8 | 25.5 |
| 4214 | 4215 | Gidan Waya | Sanga | Jema'a | 19.6 | 23.4 |
| 7294 | 7295 | Ward XI E9 I | Ibadan South East | Ibadan North East | 7.8 | 0.9 |

The CSV `feature_index` is zero-based. The actual GeoPackage FID is `feature_index + 1`; using the index as a FID would select the wrong ward.

## All 40 dispositions

| feature_index | FID | State | Ward | LGA before → reviewed | Independent polygon | Disposition |
|---:|---:|---|---|---|---|---|
| 59 | 60 | Abia | Amasaa Nsulu | Isiala Ngwa North → Isiala Ngwa North | Isiala Ngwa South | retain_boundary_generalisation |
| 472 | 473 | Akwa Ibom | Etim Ekpo X | Etim Ekpo → Etim Ekpo | Etim Ekpo | retain_boundary_generalisation |
| 668 | 669 | Akwa Ibom | Oron Urban IV | Oron → Oron | Udung Uko | retain_boundary_generalisation |
| 1184 | 1185 | Bauchi | Gambaki/Bidir | Katagum → Katagum | Shira | retain_suspect_coordinate |
| 1282 | 1283 | Bayelsa | Minibie | Brass → Brass | Brass | retain_coastal_water |
| 1762 | 1763 | Borno | Guzamala West | Guzamala → Guzamala | Guzamala | retain_boundary_generalisation |
| 2007 | 2008 | Cross River | Efut Inwang | Bakassi → Bakassi | no containing polygon | retain_coastal_water |
| 2195 | 2196 | Delta | Ngbilebiri I | Burutu → Burutu | Ughelli South | retain_boundary_generalisation |
| 2334 | 2335 | Delta | Patani I | Patani → Patani | Patani | retain_boundary_generalisation |
| 2431 | 2432 | Delta | Orere | Warri South West → Warri South West | Warri South West | retain_coastal_water |
| 2821 | 2822 | Ekiti | Ilasa II/Ikun/Araromi | Ekiti East → Ekiti East | Ikole | retain_suspect_coordinate |
| 3291 | 3292 | Federal Capital Territory | Kashi | Abuja → Abuja | Abuja Municipal | retain_boundary_generalisation |
| 4095 | 4096 | Kaduna | Kwarau | Kaduna North → Igabi | Igabi | correct_lga |
| 4210 | 4211 | Kaduna | Arak | Sanga → Sanga | Sanga | retain_boundary_generalisation |
| 4214 | 4215 | Kaduna | Gidan Waya | Sanga → Jema'a | Jema'A | correct_lga |
| 4456 | 4457 | Kano | Lakwaya | Gwarzo → Gwarzo | Gwarzo | retain_boundary_generalisation |
| 4823 | 4824 | Katsina | Tsangamawa | Danja → Danja | Giwa | retain_boundary_generalisation |
| 5070 | 5071 | Katsina | Babban Duhu 'A' | Safana → Safana | Safana | retain_boundary_generalisation |
| 5127 | 5128 | Kebbi | Gwazange/Kisawa/Ugyaga | Argungu → Argungu | Argungu | retain_boundary_generalisation |
| 6042 | 6043 | Nasarawa | Panda / Kare | Karu → Karu | Karu | retain_boundary_generalisation |
| 6952 | 6953 | Osun | Ira Gberi I | Egbedore → Egbedore | Egbedore | retain_boundary_generalisation |
| 6990 | 6991 | Osun | Aye | Ife South → Ife South | Ife South | retain_boundary_generalisation |
| 6994 | 6995 | Osun | Kere | Ife South → Ife South | Ife South | retain_boundary_generalisation |
| 7294 | 7295 | Oyo | Ward XI E9 I | Ibadan South East → Ibadan North East | Egbeda | correct_lga |
| 7733 | 7734 | Plateau | Kurungbau (B) | Shendam → Shendam | Shendam | retain_boundary_generalisation |
| 7811 | 7812 | Rivers | Ataba II | Andoni → Andoni | Khana | retain_coastal_water |
| 7817 | 7818 | Rivers | Unyeada II | Andoni → Andoni | Andoni | retain_coastal_water |
| 7851 | 7852 | Rivers | Bukuma | Degema → Degema | Degema | retain_coastal_water |
| 7853 | 7854 | Rivers | Degema II | Degema → Degema | Akukutoru | retain_coastal_water |
| 7854 | 7855 | Rivers | Degema III | Degema → Degema | Obua/Odual | retain_coastal_water |
| 7860 | 7861 | Rivers | Tomble IV | Degema → Degema | Degema | retain_coastal_water |
| 7891 | 7892 | Rivers | Igbo II | Etche → Etche | Ikwerre | retain_boundary_generalisation |
| 7997 | 7998 | Rivers | Ogu VI | Ogu/Bolo → Ogu/Bolo | Ogu/Bolo | retain_coastal_water |
| 8003 | 8004 | Rivers | Ogoloma III | Okrika → Okrika | Okrika | retain_coastal_water |
| 8028 | 8029 | Rivers | Nkoro II | Opobo/Nkoro → Opobo/Nkoro | Opobo/Nkoro | retain_coastal_water |
| 8042 | 8043 | Rivers | Abuloma/Amadi-Ama | Port Harcourt → Port Harcourt | Okrika | retain_coastal_water |
| 8048 | 8049 | Rivers | Nkpolu Oroworukwo Two | Port Harcourt → Port Harcourt | Port Harcourt | retain_coastal_water |
| 8149 | 8150 | Sokoto | Darna/ Sabon Gari | Illela → Illela | Illela | retain_boundary_generalisation |
| 8342 | 8343 | Taraba | Gindin Dutse | Donga → Donga | Donga | retain_boundary_generalisation |
| 8447 | 8448 | Taraba | Kwambai | Ussa → Ussa | no containing polygon | retain_delimitation_uncertainty |

The case-specific INEC label/code, source URL, local and independent containers, query URL, reason, complete attributes and geometry hashes are in `ward-lga-review-ledger.csv`. `references/ward-lga-review-sources.md` lists the source directories, query method and supplementary evidence.

## Cautions that were not silently corrected

- Kashi/Karshi, Efut Inwang/EFUT INSANG, Guzamala/GUZAMALI WEST, Tsangamawa/TSANGAAMAWA, Gindin Dutse/FIINDA-DUTSE and Tomble/TOMBIA are name or source-vintage issues outside these three LGA corrections.
- Ward XI E9 I is supported by INEC and the local Ibadan North East polygon, but the independent service says Egbeda. That third-source disagreement remains visible in the ledger.
- Arak and Panda/Kare exceed 1 km locally but the independent polygons support Sanga and Karu respectively. They are not grouped with the two suspect-coordinate cases.
- Kwambai is not declared resolved merely because other cases were reviewed. Its current assignment and coordinates are preserved while delimitation uncertainty remains explicit.

## Reproduction

```bash
python scripts/correct_residual_ward_lgas.py
# Only after reviewing the ledger and verification:
python scripts/correct_residual_ward_lgas.py --apply --approve-verified
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/build_site.py
```

Pre-review source SHA256: `97065ca02cf64444cdb5e265e48de4fd462e08c904a37b9fc8999f3f75aca534`  
All-ward geometry digest: `87bd448abc6aabd4c730b6856a5180b59dddfe37e60b5b3fe16cc5d5f65195c8`
