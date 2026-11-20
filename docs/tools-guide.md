# Every tool, explained

This is the guide the map itself shows under **Tools → Guide**, as a file you can read, print or
hand to a colleague. It is generated from the same tool list that builds the Tools panel, so it
always matches the app: 125 tools, in the order you usually need them.

- Every tool is read-only: nothing here edits the underlying data files.
- Results are drawn on the map or shown in a panel; a PNG picture or a CSV export is how you
  take them away.
- The map behaves the same on a phone, a tablet and a desktop. Where a gesture differs, the
  guide says so.

## Contents

- [Focus & select](#focus-select) — 5 tools
- [Spatial analysis](#spatial-analysis) — 8 tools
- [Navigation & measuring](#navigation-measuring) — 13 tools
- [Time](#time) — 3 tools
- [Search & discovery](#search-discovery) — 4 tools
- [Data & tables](#data-tables) — 12 tools
- [Cartography & design](#cartography-design) — 4 tools
- [View](#view) — 2 tools
- [Mobile & accessibility](#mobile-accessibility) — 5 tools
- [Sharing & collaboration](#sharing-collaboration) — 3 tools
- [Raster tools](#raster-tools) — 11 tools
- [Geometry operations](#geometry-operations) — 18 tools
- [Topology & data quality](#topology-data-quality) — 16 tools
- [Network & routing](#network-routing) — 10 tools
- [Generation](#generation) — 8 tools
- [Classification](#classification) — 3 tools

## Focus & select

_Start here. These tools answer “what is inside this place?” — select it, clip to it, then analyse and export._

### Clip to an area

`clip` — Fade everything outside a shape you draw.

Everything outside the shape you choose is removed from the map, so counts, tables and exports only cover that place.

1. Tools → **Clip to an area**.
2. Press and drag for a rectangle or a square (square on the ground, equal kilometres a side), or press at the centre and drag out for a circle with a real radius in metres.
3. For a polygon, tap each corner then **Done**; for **Pick features from a layer**, choose a polygon layer, tick the shapes (or press **Pick on the map** and tap them), then **Clip**.
4. The focus chip in Layers turns green and the area in km² is shown.
5. Use **Area summary** to count what is inside, or **Clear focus** to go back to the whole country.

**Tip.** Picks can come from more than one layer, and each picked shape stays its own clip area. Esc or **Cancel** stops a drawing at any time.

### Select features

`select` — Tap or drag a box to select features.

Select one feature, several features, or everything inside a box you drag. This is the phone-friendly way to pick exactly what you want to see and export.

1. Tools → **Select features**. Pick a layer (or “All switched-on layers”) and press **Start selecting**.
2. A bar appears at the bottom of the map (top on desktop) and the map stops panning while you select.
3. **Tap a feature** to select it; tap it again to remove it.
4. **Press and drag** to draw a box — everything inside the box is selected. Drag the same box again to deselect.
5. **All** takes everything on screen, **List** shows what you have, **Zoom** fits it, **Export** saves a CSV, **Clear** empties it.
6. Press **Done** to go back to normal map panning. Your selection stays highlighted until you clear it.

**Needs.** At least one feature layer switched on (polygon, line or point).

**Tip.** The Info panel updates with the feature you last selected, so you can read attributes without leaving select mode.

### Area summary

`aoi` — Counts, classes and area inside the focus.

Counts every switched-on layer inside the focus area: features, summed polygon area, top raster classes.

1. Set a focus area first (Clip to an area).
2. Tools → **Area summary**.
3. Read the chart and table; **Zoom to area** shows it on the map, **Clear focus** returns to the whole country.

**Needs.** A focus area, and at least one layer on.

### Filter features

`filter` — Show only the rows that match.

Show only the rows that match a column — the rest of the layer is hidden until you clear it.

1. Tools → **Filter features**, choose the layer.
2. Pick a field and a condition (equal, contains, between, in a list…).
3. Press **Apply filter**; the layer row gets a “Filtered” chip.
4. Clear it from the same panel, or Layers → Clear filters.

### Group into classes

`reclass` — Reclassify and recolour a numeric field.

Groups a numeric field into classes and recolours the layer so patterns stand out.

1. Tools → **Group into classes**.
2. Choose the layer, the numeric field, the number of classes and the method.
3. Apply — the legend follows the new classes. Remove classes to return to the original colours.

## Spatial analysis

_Spatial analysis between layers. Results are drawn on the map and can be saved as a picture._

### Buffer / Proximity

`buffer` — Find features within a distance of another layer.

Draws a zone at a fixed distance around features of one layer, then counts features of another layer that fall inside it.

1. Switch on the source layer and the layer you want to check.
2. Tools → **Buffer / Proximity**, pick both layers and the distance in km.
3. Run it: the buffer is drawn and the matches are counted.

**Tip.** Works with points (circles), lines (corridors) and polygons.

### Intersect / Overlay

`intersect` — Find where two polygon layers overlap.

Shows only the area where two polygon layers overlap.

1. Switch on two polygon layers.
2. Tools → **Intersect / Overlay**, choose A and B.
3. Run; the overlap shapes are drawn on top.

**Needs.** Two polygon layers on.

### Nearest Neighbor

`nearest` — Match each feature to its closest feature in another layer.

Matches each feature of one layer to its closest feature in another layer.

1. Switch on both layers.
2. Tools → **Nearest Neighbor**, choose the source and target layers.
3. Run; distances are listed per feature.

### Dissolve / Merge

`dissolve` — Merge polygons sharing the same attribute.

Merges polygons that share the same value in a field into one shape per group.

1. Tools → **Dissolve / Merge**.
2. Choose the polygon layer and the grouping field.
3. Run; one merged outline per group is drawn.

**Needs.** A polygon layer on.

### Count Points in Polygons

`count` — Tally point features inside each polygon.

Counts the points of one layer that fall inside each polygon of another.

1. Switch on a polygon layer and a point layer.
2. Tools → **Count Points in Polygons**, choose both.
3. Run; each polygon gets a point count.

**Needs.** One polygon layer and one point layer on.

### Convex Hull

`hull` — Smallest convex boundary around selected points.

Draws the smallest convex boundary that encloses every point of a layer.

1. Switch on a point layer.
2. Tools → **Convex Hull**, choose the layer, run.
3. The hull and its area in km² are shown.

**Needs.** A point layer with at least three points.

### Simplify Geometry

`simplify` — Reduce vertices while preserving shape.

Reduces the number of vertices while keeping the shape, which makes big layers quicker to draw.

1. Tools → **Simplify Geometry**, choose the layer and a tolerance.
2. Run; the simplified version is drawn so you can compare.

**Tip.** Small tolerances keep detail; large ones make smoother, lighter shapes.

### Zonal Statistics

`zonal` — Summarize raster values within polygons.

Summarises raster values inside each polygon (mean, min, max and more).

1. Switch on a raster layer and a polygon layer.
2. Tools → **Zonal Statistics**, choose both.
3. Run; the table lists the statistics per polygon.

**Needs.** One raster and one polygon layer on.

## Navigation & measuring

_Measuring, coordinates, bookmarks and the map itself. Nothing here changes your data._

### Measure distance

`measure-dist` — Tap along a line to total the km.

Measure a distance by tapping along the route.

1. Tools → **Measure distance**.
2. Tap each point on the map; the running total appears in the bar.
3. Press **Done** to stop, or **Clear** to start again.

**Tip.** Save it with Navigate → Save Measurement, then reopen it later.

### Measure area

`measure-area` — Tap a shape to get km² and edge.

Measure the area of a shape and the length of its edge.

1. Tools → **Measure area**.
2. Tap each corner; the area in km² updates as you go.
3. Press **Done** when the shape is closed.

### Go to coordinates

`goto` — Type a latitude and longitude.

Jump to any latitude and longitude.

1. Tools → **Go to coordinates**.
2. Type latitude and longitude (or paste “lat, lon”) and choose a zoom.
3. Press **Zoom there**.

**Tip.** Neither a phone nor a desktop needs a decimal comma — paste what you copied.

### Distance & bearing

`bearing` — Between two coordinates.

Distance and compass bearing between two coordinates.

1. Tools → **Distance & bearing**.
2. Fill both points (or use the map centre as the start).
3. Press **Calculate**, then **Show both on the map**.

### Grid lines

`grid` — Latitude / longitude graticule.

Shows or hides the latitude/longitude graticule with labels.

1. Tools → **Grid lines** (the Layers panel has the same switch).
2. Toggle it off the same way.

**Tip.** The grid also appears in exported pictures when you tick “Grid” in the export panel.

### Locate Me

`locate` — Center map on your current location.

Centres the map on your current position.

1. Allow location access when the browser asks.
2. Tools → **Locate Me**, or the target button at the top right.

**Tip.** On a phone this needs location permission for the site; without it the map says so and nothing breaks.

### View Bookmarks

`bookmarks` — Save and restore map view bookmarks.

Save the current view under a name and jump back to it later.

1. Zoom to the view you want.
2. Tools → **View Bookmarks**, type a name and save.
3. Pick the bookmark at any time to return to it.

**Tip.** Bookmarks live on this device only.

### Rotate Map

`rotate` — Rotate the map display with north arrow.

Rotates the map display and shows a north arrow so orientation is never ambiguous.

1. Tools → **Rotate Map**, set an angle or use the slider.
2. Reset to 0° to go back to north-up.

**Tip.** Selecting, tapping and measuring all follow the rotation.

### Save Measurement

`meas-save` — Save the current line or area measurement.

Saves the measurement currently on the map.

1. Draw a measurement first.
2. Tools → **Save Measurement**.
3. Find it again under Navigate → Saved Measurements.

### Saved Measurements

`meas-list` — View and restore saved measurements.

Lists saved measurements and restores them to the map.

1. Tools → **Saved Measurements**.
2. Pick one to draw it again, or clear them all.

### Save Drawing

`draw-save` — Save the current focus area / drawing.

Saves the current focus area / drawing.

1. Set a focus area.
2. Tools → **Save Drawing**.

### Saved Drawings

`draw-list` — View and restore saved drawings.

Restores saved drawings.

1. Tools → **Saved Drawings**, pick one to restore it as the focus area.

### Drawing Style

`draw-style` — Set color and stroke for drawings.

Sets the colour and line width used for drawings and focus outlines.

1. Tools → **Drawing Style**, choose colour and width.
2. New drawings use it straight away.

## Time

_Filter and step through features that carry a date or a year._

### Temporal Filter

`timefilter` — Filter features by date or year field.

Shows only features whose date or year field falls in a range.

1. Switch on a layer that has a year/date column.
2. Tools → **Temporal Filter**, choose the field and the range.
3. Apply; clear it the same way.

**Needs.** A layer with a numeric date or year field.

### Temporal Layers

`timelayers` — Browse layers with time coverage.

Browses the layers that carry time coverage information.

1. Tools → **Temporal Layers**.
2. Pick a layer to switch it on.

### Time Slider

`timeslider` — Step through years to see change.

Steps through years to watch features appear and disappear.

1. Tools → **Time Slider**, choose the layer and field.
2. Drag the year slider or press Play.

## Search & discovery

_Find a place or a feature by name, or work with coordinates._

### Feature Finder

`find` — Search features by attribute across layers.

Searches feature attributes across layers and jumps to the match.

1. Tools → **Feature Finder**, type part of a name, code or number.
2. Pick a result: the map zooms there and the Info panel opens.

**Tip.** The search button at the top right does the same across places and layers.

### Coordinate Inspector

`coords` — Click map to read coordinates (DD / DMS).

Reads the coordinates of any point you tap, in decimal degrees and DMS.

1. Tools → **Coordinate Inspector**.
2. Tap the map; the coordinates appear in the panel.

### Coordinate Converter

`convert` — Convert DD, DMS and UTM coordinates.

Converts between decimal degrees, degrees-minutes-seconds and UTM.

1. Tools → **Coordinate Converter**.
2. Type a value in any box; the others update.

### Layer Discovery

`layerfind` — Search and browse the layer catalog.

Searches the whole layer catalog by name, source or type.

1. Tools → **Layer Discovery**, type what you are looking for.
2. Tap a result to zoom to it or switch it on.

## Data & tables

_Tables, statistics, filters and exports for the layer you are looking at._

### Layer statistics

`stats` — Totals, averages and a chart.

Totals, averages, extremes and a chart for any field of a layer.

1. Tools → **Layer statistics**, choose the layer.
2. Read the summary and the chart; export the numbers if needed.

### Compare fields

`chart` — Histogram of any numeric column.

Histogram of a numeric column, or a ranked count of a text column.

1. Tools → **Compare fields**, pick layer and field.
2. The chart respects the focus area when one is active.

### Attribute table

`table` — Browse, sort and search rows.

The full attribute table: sort, search, hide columns and export rows.

1. Tools → **Attribute table**, pick the layer.
2. Use the filter box to search; tap a row to locate it.

### Field Calculator

`fieldcalc` — Calculate new attribute fields.

Creates a new attribute field from an expression.

1. Tools → **Field Calculator**, choose the layer.
2. Name the field and write an expression using existing field names.
3. Apply; the new column appears in the table and can be charted.

**Tip.** This is author-mode work: it changes what you see, not the source data file.

### Select by Attribute

`selectattr` — Select features by attribute values.

Selects features by attribute value, without tapping the map.

1. Tools → **Select by Attribute**, pick the layer and field.
2. Choose the condition and value, then Apply.
3. The matching features are highlighted and can be exported.

**Tip.** For a map-based selection (tap or box), use Tools → Select features instead.

### Column Manager

`colmanage` — Show/hide table columns.

Shows or hides columns in the attribute table.

1. Tools → **Column Manager**, tick the columns you want.

### Feature labels

`labels` — Write a field on the map.

Writes a field’s value on the map for a selected layer.

1. Tools → **Feature labels**, choose the layer and field.
2. Tune size, minimum zoom, colour and halo. Labels stay hidden below the minimum zoom so the map stays readable.

### Zoom to a layer

`zoomlayer` — Fit a whole layer on screen.

Fits one whole layer on the screen.

1. Tools → **Zoom to a layer**, pick the layer.

### Save map picture

`shot` — Download the screen as a PNG.

Downloads the current map as a PNG picture.

1. Arrange the map the way you want it.
2. Tools → **Save map picture**.
3. On desktop you can add a title, legend, scale, north arrow and grid first.

**Tip.** If a basemap refuses to export for licensing reasons, the picture is saved without it — your data is still there.

### Export results

`export` — Save a map picture or attribute rows as CSV.

Saves a map picture or attribute rows as CSV.

1. Tools → **Export results**.
2. Choose the area (whole view, focus area or picked polygons), then picture or CSV.

### Count by Attribute

`countbyattr` — Tally features by field value.

Counts how many features share each value of a column — a quick category tally for the layer you are looking at.

1. Tools → **Count by Attribute**, pick the layer.
2. Pick the column to count (a name, a class, a status).
3. Press **Count**; the totals appear as a table, largest group first.

**Tip.** Works on text and numeric columns alike. Use it to check how a layer is distributed before you map it.

### Field Stats by Group

`fieldstatsbygroup` — Grouped statistics by field.

Summarises one numeric column separately for each group in another column (for example, mean borehole yield per state).

1. Tools → **Field Stats by Group**, pick the layer.
2. Choose the **group** column (text) and the **value** column (number).
3. Press **Compute**; each group gets a count, mean, minimum and maximum.

**Tip.** Both columns must be in the same layer. For a single overall summary use Layer statistics instead.

## Cartography & design

_Colours, basemaps, print layouts and saved views — how the map looks and prints._

### Color Ramps

`ramp` — Choose perceptual color ramps for layers.

Chooses a colour ramp for classified layers.

1. Tools → **Color Ramps**, pick a ramp, then apply it to a layer.

### Custom Basemap

`custombasemap` — Add your own XYZ tile basemap URL.

Adds your own XYZ tile basemap by URL.

1. Tools → **Custom Basemap**.
2. Give it a name and paste a tile URL containing {z}, {x} and {y}.
3. Save; it appears with the other basemaps.

**Tip.** Use a source whose licence allows it, and remember tiles need internet.

### Map Presets

`mappreset` — Save and restore map view states.

Saves a complete view (layers, colours, focus) under a name.

1. Set the map up as you want it.
2. Tools → **Map Presets**, name it and save.
3. Restore it later in one tap.

### Print Layouts

`printlayout` — A4 / Letter page templates for export.

Turns the export into a page layout (A4, A3 or Letter) with a title block.

1. Tools → **Print Layouts**, choose size, orientation and margin.
2. Then Tools → Save map picture; the PNG follows the layout.

## View

_The view itself: back to the start, or full screen._

### Reset the view

`resetview` — Back to the opening extent and no filters.

Back to the opening extent with no filters or focus.

1. Tools → **Reset the view**.

**Tip.** Your layer list and colours are kept; only the view and filters reset.

### Full screen

`fullscreen` — Use the whole screen, no browser chrome.

Uses the whole screen with no browser chrome.

1. Tools → **Full screen**, or the expand button at the top right.
2. Press Esc or the button again to come back.

## Mobile & accessibility

_Comfort and access settings for phones, tablets, screen readers and colourblind users._

### Guide

`guide` — Every tool, step by step.

Opens this guide — every tool in the app with what it does and how to use it, searchable.

1. Tools → **Guide**, or the **Guide** button in the About panel.
2. Type in the search box to jump to a tool (for example “drag a box”).
3. Open a row to read the steps and the tip.

**Tip.** The guide is built from the same list as the Tools panel, so it can never go out of date.

### Accessibility

`a11y` — High contrast, text size, reduced motion.

High contrast, larger text and reduced motion.

1. Tools → **Accessibility**.
2. Switch on what helps; the settings apply immediately and are remembered on this device.

### Gesture Guide

`gestures` — Touch gestures for phone and tablet.

A quick reference for touch gestures.

1. Tools → **Gesture Guide**.

### Screen Reader

`screenreader` — Enhanced ARIA labels and live announcements.

Adds clearer labels and spoken announcements for screen readers.

1. Tools → **Screen Reader** to turn the enhanced descriptions on.

### Colorblind Palettes

`colorblind` — Colorblind-safe color ramps.

Switches to colourblind-safe palettes.

1. Tools → **Colorblind Palettes**, pick a palette; classified layers and legends follow.

## Sharing & collaboration

_Send a view to a colleague, or keep sessions and notes._

### Share View

`shareview` — Copy a link to the current map view.

Copies a link that opens the exact same view.

1. Set the map up as you want it.
2. Tools → **Share View**, then paste the link into a message.

**Tip.** The link carries the layers, basemap, centre, zoom and focus area.

### Session Codes

`session` — Save and restore map sessions by code.

Saves and restores whole sessions with a short code.

1. Tools → **Session Codes**.
2. Save to get a code, or type a code to restore someone else’s session.

### Map Notes

`mapnotes` — Add text notes and markers to the map.

Adds text notes and markers to the map for a discussion.

1. Tools → **Map Notes**, type the note and add it at the centre.
2. Drag the note on the map to move it.

**Tip.** Notes are for the map only — they are not data and not exported as data.

## Raster tools

_Tools for the gridded layers (elevation, rainfall, population, flood, temperature)._

### Raster Calculator

`rastercalc` — Map algebra on raster layers.

Map algebra on one raster: multiply, add, threshold, and so on.

1. Switch on a raster layer.
2. Tools → **Raster Calculator**, write an expression using v (the cell value).
3. Run; the result is drawn as a new surface.

**Needs.** A raster layer on.

### Raster Reclassify

`rasterreclass` — Reclassify raster cell values.

Reclassifies raster cell values into your own groups.

1. Tools → **Raster Reclassify**, choose the layer and the breaks.

### Raster Statistics

`rasterstats` — Summarize raster values.

Min, max, mean and distribution of a raster.

1. Tools → **Raster Statistics**, choose the raster.

### Raster Clip / Mask

`rasterclip` — Clip raster by focus area.

Clips a raster to the focus area.

1. Set a focus area first.
2. Tools → **Raster Clip / Mask**, choose the raster, run.

**Needs.** A focus area and a raster layer on.

### Raster Contour

`rastercontour` — Contour lines from raster.

Derives contour lines from a raster surface.

1. Tools → **Raster Contour**, choose the raster and interval.

### Raster Slope

`rasterslope` — Slope from DEM raster.

Computes slope from an elevation raster.

1. Switch on the elevation/DEM layer.
2. Tools → **Raster Slope**, run.

**Needs.** An elevation raster on.

### Raster Histogram

`rasterhist` — Value distribution histogram.

Histogram of raster values.

1. Tools → **Raster Histogram**, choose the raster.

### Raster Clip by Polygon

`rasterclipoly` — Clip raster extent to polygon boundary.

Clips a raster to a polygon boundary from a layer.

1. Switch on a raster and a polygon layer.
2. Tools → **Raster Clip by Polygon**, choose both.

### Raster Overlay Math

`rasteroverlay` — Cell-by-cell math between two rasters.

Cell-by-cell arithmetic between two rasters.

1. Switch on two rasters with the same extent.
2. Tools → **Raster Overlay Math**, choose A, B and the operation.

**Needs.** Two rasters on.

### Raster Class Zonal

`rasterclasszonal` — Raster class coverage per polygon.

How much of each raster class falls inside each polygon.

1. Tools → **Raster Class Zonal**, choose the raster and the polygon layer.

### Raster Difference

`rasterdiff` — Subtract raster B from raster A.

Subtracts raster B from raster A cell by cell.

1. Tools → **Raster Difference**, choose A and B.

**Needs.** Two rasters on.

## Geometry operations

_Shape operations: centroids, hulls, buffers, simplification, measurement of shapes._

### Feature Centroid

`centroid` — Centroid of selected features.

Creates a point layer of feature centroids (or the centroid of the selection).

1. Tools → **Feature Centroid**, choose the layer.

### Densify Lines

`densify` — Add vertices along lines.

Adds vertices along lines at a fixed interval.

1. Tools → **Densify Lines**, choose the layer and spacing.

### Split Polygon by Line

`splitpoly` — Split polygons with a line.

Splits polygons with a line you draw.

1. Tools → **Split Polygon by Line**, choose the layer.

### Concave Hull

`concavehull` — Concave boundary (alpha shape).

A concave boundary (alpha shape) tighter than a convex hull.

1. Tools → **Concave Hull**, choose the layer and tightness.

### Affine Transform

`affinetransform` — Move, rotate, scale features.

Moves, rotates or scales features.

1. Tools → **Affine Transform**, choose the layer and values.

### Lines to Polygons

`linetopoly` — Close line rings into polygons.

Closes line rings into polygons.

1. Tools → **Lines to Polygons**, choose the line layer.

### Polygon Outlines

`polyoutline` — Extract polygon boundaries.

Extracts the boundary lines of polygons.

1. Tools → **Polygon Outlines**, choose the layer.

### Smooth Features

`featuresmooth` — Smooth line/polygon vertices.

Smooths the vertices of lines and polygons.

1. Tools → **Smooth Features**, choose the layer and number of passes.

### Feature Buffer

`featurebuffer` — Buffer features by distance.

Buffers every feature of a layer by a distance.

1. Tools → **Feature Buffer**, choose the layer and distance in km.
2. The buffered shapes are drawn on the map.

**Tip.** Points become circles, lines become corridors, polygons grow outward.

### Bounding Box / Envelope

`boundingbox` — Create bounding boxes around features.

Draws the rectangular envelope around each feature.

1. Tools → **Bounding Box / Envelope**, choose the layer.

### Vertices to Points

`vertexstopoints` — Extract every vertex as a point.

Turns every vertex into a point.

1. Tools → **Vertices to Points**, choose the layer.

### Area & Perimeter

`areaperim` — km² and km for each polygon.

Area in km² and perimeter in km for every polygon.

1. Tools → **Area & Perimeter**, choose the polygon layer, run.

### Points Along Lines

`linepoints` — Points at intervals along lines.

Places points at intervals along lines.

1. Tools → **Points Along Lines**, choose the layer and spacing.

### Polygon Centroids → Points

`centroidpts` — Centroid point layer from polygons.

Creates a point layer from polygon centroids.

1. Tools → **Polygon Centroids → Points**, choose the layer.

### Polygon Adjacency

`polyadjacency` — Find touching polygon pairs.

Finds pairs of polygons that touch.

1. Tools → **Polygon Adjacency**, choose the layer.

### Line Offset

`lineoffset` — Parallel offset lines at distance.

Creates parallel lines at a fixed offset.

1. Tools → **Line Offset**, choose the layer and distance.

### Polygon Union / Merge

`polyunion` — Merge all polygons into one.

Merges every polygon of a layer into a single shape.

1. Tools → **Polygon Union / Merge**, choose the layer.

### Line Length Statistics

`linelenstats` — Total, mean, min, max line lengths.

Total, mean, minimum and maximum length of lines.

1. Tools → **Line Length Statistics**, choose the layer.

## Topology & data quality

_Data-quality checks: overlaps, gaps, invalid rings, duplicates._

### Check Overlaps

`checkoverlap` — Find overlapping polygons.

Finds polygons that overlap each other.

1. Tools → **Check Overlaps**, choose the layer.

### Check Gaps

`checkgaps` — Find gaps between polygons.

Finds gaps between adjacent polygons.

1. Tools → **Check Gaps**, choose the layer.

### Validate Geometry

`validate` — Check geometry validity.

Checks geometry validity (rings, closure, minimum vertices).

1. Tools → **Validate Geometry**, choose the layer.

### Snap Features

`snap` — Snap features together.

Snaps nearby vertices of two layers together.

1. Tools → **Snap Features**, choose both layers and the tolerance.

### Check Self-Intersections

`selfintersect` — Find self-intersecting rings.

Finds rings that cross themselves.

1. Tools → **Check Self-Intersections**, choose the layer.

### Duplicate Geometries

`duplicategeom` — Find identical coordinates.

Finds features with identical coordinates.

1. Tools → **Duplicate Geometries**, choose the layer.

### Snap to Grid

`snaptogrid` — Snap vertices to regular grid.

Snaps vertices to a regular grid.

1. Tools → **Snap to Grid**, choose the layer and grid size.

### Feature Erase / Difference

`erasefeatures` — Erase one layer from another.

Erases the area of one layer from another.

1. Tools → **Feature Erase / Difference**, choose both layers.

### Check Null Geometries

`checknullgeom` — Find empty or missing coordinates.

Finds features with no coordinates.

1. Tools → **Check Null Geometries**, choose the layer.

### Check Out of Bounds

`checkoutofbounds` — Find coordinates outside valid range.

Finds coordinates outside valid longitude/latitude ranges.

1. Tools → **Check Out of Bounds**, choose the layer.

### Check Multi-part Features

`checkmultipart` — Find multi-part features.

Finds features made of several separate pieces.

1. Tools → **Check Multi-part Features**, choose the layer.

### Ring Direction Check

`ringdirection` — CW/CCW ring orientation.

Checks whether rings run clockwise or anticlockwise (holes).

1. Tools → **Ring Direction Check**, choose the layer.

### Feature Within Distance

`featurewithindist` — Features within distance of another layer.

Lists features of one layer within a distance of another layer.

1. Tools → **Feature Within Distance**, choose both layers and the distance.

### Spatial Join Count

`spatialjoincount` — Count points within polygons.

Counts points inside polygons and adds the count as an attribute.

1. Tools → **Spatial Join Count**, choose the polygon and point layers.

### Buffer Dissolve

`bufferdissolve` — Buffer then dissolve overlaps.

Buffers features, then merges the overlapping buffers.

1. Tools → **Buffer Dissolve**, choose the layer and distance.

### Remove Small Polygons

`removesmallpoly` — Delete polygons below min area.

Hides polygons below a minimum area (cleans up slivers).

1. Tools → **Remove Small Polygons**, choose the layer and minimum km².
2. Run; small slivers are hidden and can be brought back by removing the tool’s effect.

**Tip.** Use this to thin out tiny slivers at country scale, not to delete real data.

## Network & routing

_Tools that treat lines as a connected network (roads, rivers)._

### Shortest Path

`shortestpath` — Shortest path on network.

Shortest path along a line network between two points.

1. Tools → **Shortest Path**, choose the network layer and the two ends.

**Needs.** A line layer on.

### Service Area

`servicearea` — Reachable area (isochrone).

The area reachable within a distance along the network (isochrone).

1. Tools → **Service Area**, choose the network and the start point.

### Trace Network

`tracenet` — Trace upstream/downstream.

Traces a network upstream or downstream from a point.

1. Tools → **Trace Network**, choose the layer and the start point.

### Network Buffer

`networkbuffer` — Drive-time buffer around points.

A drive-time style buffer around points along the network.

1. Tools → **Network Buffer**, choose the network and the points.

### Network Connectivity

`networkconnect` — Check network graph connectivity.

Checks whether the network is fully connected.

1. Tools → **Network Connectivity**, choose the line layer.

### Multi-Stop Route

`multipath` — Optimize route through stops.

Optimises a route through several stops.

1. Tools → **Multi-Stop Route**, add the stops and run.

### Distance Matrix

`distancematrix` — Pairwise distances between points.

Pairwise distances between the points of a layer.

1. Tools → **Distance Matrix**, choose the point layer.

### Merge Connected Lines

`linemerge` — Merge lines sharing endpoints.

Merges lines that share endpoints.

1. Tools → **Merge Connected Lines**, choose the line layer.

### Line Bearing Statistics

`linebearing` — Compass direction of line segments.

Compass direction statistics for line segments.

1. Tools → **Line Bearing Statistics**, choose the line layer.

### Network Betweenness

`networkbetweenness` — Node betweenness centrality.

Ranks network nodes by how many shortest paths pass through them.

1. Tools → **Network Betweenness**, choose the line layer.

## Generation

_Create new shapes: grids, random points, hexagons. Visual only._

### Fishnet / Grid

`fishnet` — Rectangular grid of cells.

Creates a rectangular grid over the view or focus area.

1. Tools → **Fishnet / Grid**, set the cell size, run.

### Random Points

`randompts` — Random points within extent.

Places random points inside the view or focus area.

1. Tools → **Random Points**, set how many, run.

### Hexagonal Binning

`hexbin` — Bin points into hexagons.

Bins points into hexagons so density is easy to see.

1. Tools → **Hexagonal Binning**, choose the point layer and hexagon size.

### Regular Point Grid

`gridpoints` — Points on a regular grid.

Places points on a regular grid.

1. Tools → **Regular Point Grid**, set the spacing.

### Random Lines

`randomlines` — Generate random line features.

Generates random line features (for testing and illustration).

1. Tools → **Random Lines**, set the count.

### Random Polygons

`randompolygons` — Generate random polygon features.

Generates random polygon features.

1. Tools → **Random Polygons**, set the count.

### Random Sample

`randomsample` — Random subset of features.

Takes a random subset of the features of a layer.

1. Tools → **Random Sample**, choose the layer and how many.

### Random Raster

`randomraster` — Generate random raster surface.

Creates a random raster surface.

1. Tools → **Random Raster**, run.

## Classification

_Turn a numeric field into classes (natural breaks, quantile, equal interval)._

### Natural Breaks (Jenks)

`jenksbreaks` — Jenks natural breaks classes.

Classifies a numeric field with Jenks natural breaks.

1. Tools → **Natural Breaks (Jenks)**, choose the layer, field and classes.

### Quantile Classification

`quantileclass` — Equal-count quantile classes.

Classifies a numeric field into equal-count classes.

1. Tools → **Quantile Classification**, choose the layer, field and classes.

### Equal Interval Classification

`equalintervalclass` — Equal-width value classes.

Classifies a numeric field into equal-width classes.

1. Tools → **Equal Interval Classification**, choose the layer, field and classes.

## Gestures: phone, tablet and desktop

| Action | Touch | Mouse / trackpad |
|---|---|---|
| Pan the map | Drag with one finger | Drag |
| Zoom | Pinch, or double-tap | Scroll wheel, `+`/`-` keys or the buttons |
| Read a feature | Tap it | Click it, or hover to see its name |
| Select features | Select mode, then tap or drag a box | Same, with the mouse |
| Select several at once | Drag a box across them | Drag a box across them |
| Unselect one | Tap the same feature again, or List → remove | Click it again |
| Cancel a drawing | Cancel in the bar at the top | Esc, or Cancel |
| Leave select mode | Done in the selection bar | Done, or Esc |

## If something does not respond

- **“Tap inside a polygon”** — the tool needs a feature of the boundary layer under your
  finger. Zoom in and tap well inside the shape.
- **Nothing selected** — the layer you are picking from may be filtered or hidden. Check
  Layers, then try again.
- **“No raster layer” / “No polygon layer”** — switch the right kind of layer on first
  (Layers → open a group → tap the switch).
- **Blank map** — a focus area may be hiding everything. Layers → Focused, or
  Tools → Clip to an area → Clear focus.
- **Basemap missing** — tiles need internet. Your data layers still draw; try another
  basemap or None.
- **A big layer takes a second or two** — the toast names what is being worked on, the map
  stays responsive, and the answer appears as soon as it is ready.

Author tools (`symbology`, `addlabel`, `savelabels`, `import`, `reset`) only appear with
`?author=1`, because they change what every visitor sees.
