# Every tool, explained

This is the guide the map itself shows under **Tools → Guide**, as a file you can read, print or
hand to a colleague. It is generated from the same tool list that builds the Tools panel, so it
always matches the app: 126 tools, in the order you usually need them.

- Every tool is read-only: nothing here edits the underlying data files.
- Results are drawn on the map or shown in a panel, and most panels can be saved as CSV, JSON or a
  printable table. Location coordinates are never included in any export, and geometry files
  (GeoJSON, KML, shapefile) are not offered.
- The map behaves the same on a phone, a tablet and a desktop. Where a gesture differs, the
  guide says so.

## Contents

- [Focus & select](#focus-select) — 5 tools
- [Spatial analysis](#spatial-analysis) — 8 tools
- [Navigation & measuring](#navigation-measuring) — 13 tools
- [Time](#time) — 3 tools
- [Search & discovery](#search-discovery) — 4 tools
- [Data & tables](#data-tables) — 13 tools
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

_Start here. These tools answer “what is inside this place?” — select it, clip to it, then analyse it._

### Clip to an area

`clip` — Fade everything outside a shape you draw.

Everything outside the shape you choose is removed from the map, so counts and tables only cover that place.

1. Tools → **Clip to an area**.
2. Press and drag for a rectangle or a square (square on the ground, equal kilometres a side), or press at the centre and drag out for a circle with a real radius in metres.
3. For a polygon, tap each corner then **Done**; for **Pick features from a layer**, choose a polygon layer, tick the shapes (or press **Pick on the map** and tap them), then **Clip**.
4. The focus chip in Layers turns green and the area in km² is shown.
5. Use **Area summary** to count what is inside, or **Clear focus** to go back to the whole country.

**Tip.** Picks can come from more than one layer, and each picked shape stays its own clip area. Esc or **Cancel** stops a drawing at any time.

### Select features

`select` — Tap or drag a box to select features.

Select one feature, several features, or everything inside a box you drag. This is the phone-friendly way to pick exactly what you want to see.

1. Tools → **Select features**. Pick a layer (or “All switched-on layers”) and press **Start selecting**.
2. A bar appears at the bottom of the map (top on desktop) and the map stops panning while you select.
3. **Tap a feature** to select it; tap it again to remove it.
4. **Press and drag** to draw a box — everything inside the box is selected. Drag the same box again to deselect.
5. **All** takes everything on screen, **List** shows what you have, **Zoom** fits it, **Clear** empties it.
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

`filter` — Stack filters on any layer that is on.

Hide every row that does not match. Filters are numbered in one list. Several on the same layer are combined — a row must match all of them.

1. Switch on the layer you want to filter. Only layers that are on can be chosen.
2. Tools → **Filter features**. The list is at the top — the first one you add is #1.
3. Pick the layer, a field and a condition, then **Add filter**. Add another on the same layer or a different one; they stack.
4. **Edit** changes one filter. **Remove** drops just that one. Layers → **Clear filters** drops them all.

**Tip.** The same list sits at the top of the Layers panel, so you can edit or remove a filter without opening the tool again.

### Group into classes

`reclass` — Reclassify and recolour a numeric field.

Groups a numeric field into classes and recolours the layer so patterns stand out.

1. Tools → **Group into classes**.
2. Choose the layer, the numeric field, the number of classes and the method.
3. Apply — the legend follows the new classes. Remove classes to return to the original colours.

## Spatial analysis

_Spatial analysis between layers. Results are drawn on the map and can be saved as a picture._

### Buffer / Proximity

`buffer` — Tap a feature, then choose the zone shape.

Tap one feature on the map — a point, a line or a polygon — then set the distance and the shape of the zone. Everything inside that zone is named and summarised.

1. Switch on the layers you want checked.
2. Tools → **Buffer / Proximity**, then tap the feature on the map. If several sit on the same spot, the list shows the details that tell them apart, not just the shared name.
3. Choose Circle, Square, Diamond or Hexagon, set the distance, and press Analyse.

**Tip.** The zone reaches at least the distance you set. A square also covers the corners; a circle is the same distance all round.

### Intersect / Overlay

`intersect` — Find where two polygon layers overlap.

Keeps only the ground that two polygon layers both cover, measured in km².

1. Switch on two polygon layers.
2. Tools → **Intersect / Overlay**. Layer B starts on the other layer.
3. Run. The shared ground is drawn in red. The total counts that ground once; the table lists each pair.

**Needs.** Two polygon layers on.

**Tip.** A selection or a clip narrows both layers. The export has no coordinates.

### Nearest Neighbor

`nearest` — Match each feature to its closest feature in another layer.

Matches each feature in one layer to the closest feature in another, measured edge to edge. A point inside a polygon is 0 km, not the distance to its middle.

1. Switch on both layers.
2. Tools → **Nearest Neighbor**. Layer B starts on the other layer.
3. Set how many matches, and optionally a maximum distance, then run. Each match is drawn as a line.

**Needs.** Two vector layers on.

**Tip.** The search keeps widening until a nearer feature is impossible, so a neighbour just outside the first neighbourhood is not missed. A selection or a clip narrows both layers. The export has no coordinates.

### Dissolve / Merge

`dissolve` — Merge polygons sharing the same attribute.

Merges polygons that share the same value in a field into one shape per group, removing the borders they share and keeping the gaps between them.

1. Switch on a polygon layer.
2. Tools → **Dissolve / Merge**.
3. Choose the layer and the attribute to group by, then run. Each group is drawn in brown with its area.

**Needs.** A polygon layer on.

**Tip.** A selection or a clip narrows the features that are merged.

### Count Points in Polygons

`count` — Tally point features inside each polygon.

Counts the points of one layer that fall inside each polygon of another. A point on a shared border is counted in every polygon that contains it, and the result says how many were shared.

1. Switch on a polygon layer and a point layer.
2. Tools → **Count Points in Polygons**, choose both.
3. Optionally total a numeric field, and choose whether empty polygons stay in the list.

**Needs.** One polygon layer and one point layer on.

**Tip.** The headline count and the polygon rows can add up to more than the points when borders are shared. That is stated, not hidden.

### Convex Hull

`hull` — Smallest convex boundary around selected points.

Draws the smallest shape with no inward corners that still holds every feature. Lines and polygons are enclosed by their outline, not only their middle.

1. Switch on a vector layer.
2. Tools → **Convex Hull**.
3. Leave the group blank for one hull, or pick a field for one hull per value.

**Needs.** A vector layer with at least three points.

**Tip.** A group with fewer than three points is counted and left undrawn rather than failing the whole run.

### Simplify Geometry

`simplify` — Reduce vertices while preserving shape.

Drops bends that move a line or a polygon boundary by less than the tolerance, and draws a lighter copy. The original layer is not changed.

1. Switch on a line or polygon layer.
2. Tools → **Simplify Geometry**, set the tolerance in metres.
3. Run. The result shows vertices before and after, and how many features were left out.

**Needs.** A line or polygon layer on.

**Tip.** A tolerance large enough to erase a small polygon leaves that polygon out instead of drawing an empty shape. Points have no bends to drop.

### Zonal Statistics

`zonal` — Summarize raster values within polygons.

Summarises a raster inside each polygon: sample count, the cells that sample stands for, mean, median, min and max. NoData is skipped, never treated as zero.

1. Switch on a raster and a polygon layer.
2. Tools → **Zonal Statistics**.
3. Pick a sample density and run. Finer reads more cells and takes longer.

**Needs.** One raster and one polygon layer on.

**Tip.** The cells column is samples times the sample step. It is a scale, not a claim that every skipped cell was inside the polygon. A cell under two polygons is counted in both.

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

**Tip.** The grid also appears in saved pictures when you tick “Grid” in the picture panel.

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

_Filter and step through features that carry a date or a year. A source time period is listed, but it is not a field._

### Temporal Filter

`timefilter` — Keep features whose year matches.

Keeps features whose date or year field matches a range, an exact year, or on-or-before / on-or-after. The layer turns on if it is off. The rule joins the filter list, so another filter on that layer still applies.

1. Tools → **Temporal Filter**. The map stays visible.
2. Choose the layer and the year field. A source time period is not a field and is not listed here.
3. Set the years and apply. Clear removes only the time rule.

**Needs.** A numeric or date field whose name is a year, date or time. A text column is not used, even if it is called a date.

**Tip.** If the field has no year numbers, nothing is hidden.

### Temporal Layers

`timelayers` — Year fields, separate from source time periods.

Lists catalog layers that have a date or year field, and separately those that only record a source time period. Show, hide and zoom are different actions. Zoom does not turn a layer on.

1. Tools → **Temporal Layers**.
2. Show turns a layer on and names it only after it is on. Hide turns it off.
3. Zoom fits a layer that is already on. A source-period row cannot be scrubbed.

### Time Slider

`timeslider` — Show one year at a time.

Shows one year at a time on a date or year field. Play steps through years that exist. Stop removes the time filter. Closing the panel stops playback and leaves the filter in place.

1. Tools → **Time Slider**. The map stays visible.
2. Choose the layer and field, then move the slider or press Play. The layer turns on if it is off.
3. Stop shows the features again.

**Tip.** The year range is read from the field you picked, not from the first field on the layer. Empty years between the oldest and newest are skipped.

## Search & discovery

_Find a feature, read a point, convert a coordinate, or browse the catalog._

### Feature Finder

`find` — Search attributes on the layers that are on.

Searches feature attributes on the layers that are on, names the field that matched, and jumps to the feature. A layer that is off can be included without being shown.

1. Tools → **Feature Finder**. The map stays visible.
2. Type part of a name, code or number. Narrow by layer, field, or exact match if you need to.
3. Pick a result. The map zooms there and the Info panel opens.

**Needs.** A vector layer on, or one off layer chosen in the list.

**Tip.** Filters and the focus area are respected unless you tick otherwise. The button at the top right only searches layers that are already on.

### Coordinate Inspector

`coords` — Tap the map to read and copy a point.

Reads the point you tap: decimal degrees, degrees-minutes-seconds, and a grid position you can copy. The panel does not cover the map.

1. Tools → **Coordinate Inspector**.
2. Tap the map. Choose WGS 84 UTM, Minna, or a Nigeria belt.
3. Copy the readout, or stop inspecting. Closing the panel always stops the tap.

**Tip.** A Minna position uses the national shift and is only good to about 15 metres. It is not a survey fix.

### Coordinate Converter

`convert` — Decimal degrees, DMS and a named grid.

Keeps decimal degrees, degrees-minutes-seconds and a named grid in step. Decimal degrees are WGS 84, the same system as the map.

1. Tools → **Coordinate Converter**.
2. Type in any form, or paste a coordinate. The others update. Pick a fixed zone to type an easting and northing.
3. Go to moves the map. Pick on map fills the form from a tap. Map centre uses the current centre.

**Tip.** A latitude past 85 can be converted, but this map cannot draw it. An impossible value is refused, with the reason. Minna shows the 15-metre limit.

### Layer Discovery

`layerfind` — Search the catalog, then show or zoom.

Searches the catalog by name, description, source, group or column, then shows, hides or zooms as separate actions.

1. Tools → **Layer Discovery**. The map stays visible.
2. Type a name, a source, or a column name. The count of matches is shown.
3. Show turns a layer on after it has loaded. Zoom does not turn it on. Hide turns it off.

**Tip.** A catalog layer you show is saved in this browser. An imported layer is listed too, with its accuracy note, and still stays off until you show it.

## Data & tables

_Tables, statistics and filters for the layer you are looking at._

### Layer statistics

`stats` — Totals, averages and a chart.

Totals, averages, extremes and a chart for any field of a layer.

1. Tools → **Layer statistics**, choose the layer.
2. Read the summary and the chart.

### Compare fields

`chart` — Histogram of any numeric column.

Histogram of a numeric column, or a ranked count of a text column.

1. Tools → **Compare fields**, pick layer and field.
2. The chart respects the focus area when one is active.

### Attribute table

`table` — Browse, sort and search rows.

The full attribute table: sort, search and hide columns.

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
3. The matching features are highlighted on the map.

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

**Tip.** If a basemap refuses to be included for licensing reasons, the picture is saved without it — your data is still there.

### Picture with title & frame

`export` — PNG with a title, legend, scale and grid.

Saves the map as a PNG picture with a title, legend, scale bar, north arrow and grid lines. The picture never shows latitude or longitude.

1. Tools → **Picture with title & frame**.
2. Choose the area (whole view, focus area or picked polygons), tick what to draw around the map, then download the PNG.

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

### Import GeoPackage

`gpkg` — Bring your own GeoPackage onto the map.

Reads a GeoPackage in this browser and lists its layers under Imported. The file is not sent anywhere. A layer stays off until you turn it on, and can then be used with the published layers.

1. Open **Layers**. **Import** is in the same row as Show all, Hide all and Basemap. It does not sit over those controls.
2. Choose a .gpkg file and read the coordinate-system note. Files in Minna are shifted to WGS 84, and that shift is only good to about 15 metres.
3. Press **Add to imported layers**. They are listed at the top of Layers, above On the map.
4. Turn on the layer you want. It can then be used with Buffer, clip and the other tools.

**Tip.** The file is forgotten when you close the tab. If the shapes land in the wrong place, remove the layer and import again with a different coordinate system.

## Cartography & design

_Colours, basemaps, saved views and page pictures. Nothing here edits the data files._

### Color Ramps

`ramp` — Classify a number, or paint a layer one colour.

Colours a layer that is on. Classify a numeric field into quantile or equal-interval classes, or paint the whole layer one stop from the ramp. Cividis is the colourblind-safe ramp.

1. Switch on the layer.
2. Tools → **Color Ramps**. The breaks are shown before you apply.
3. Apply. Restore brings the layer’s own colours back. The data file is not edited.

**Needs.** A vector layer on.

**Tip.** A field with fewer distinct values than the class count you asked for is not padded with empty classes. Blank numbers stay grey. Lines take the class colour too, not only polygon fills.

### Custom Basemap

`custombasemap` — Add an XYZ tile URL you are allowed to use.

Adds an XYZ tile URL and keeps it in this browser, including after a reload. It cannot replace a built-in basemap.

1. Tools → **Custom Basemap**.
2. Name it, paste an https URL containing {z}, {x} and {y}, and write the attribution the licence asks for.
3. Add. Use switches to it. Remove drops it and, if it was on, returns to Light grey.

**Tip.** Tiles are requested from that server only while the basemap is on. A URL without {z}, {x} and {y}, or one that is not https, is refused.

### Map Presets

`mappreset` — Save the layers, colours and focus, then restore them.

Saves the layers that are on, their colours, filters and opacity, the basemap and the focus area, then restores that map. The centre is restored but not shown.

1. Set the map up.
2. Tools → **Map Presets**, name it and save.
3. Restore later. A layer that is not in this browser is counted, not invented.

**Tip.** Tick replace before saving over a name. This is the whole map, not just the view a bookmark stores.

### Print Layouts

`printlayout` — A4, A3 or Letter, without stretching the map.

Fits the current map on an A4, A3 or Letter page without stretching it. The picture has a title, optional legend, scale bar and north arrow, and no latitude or longitude.

1. Tools → **Print Layouts**. The preview shows the map inside the page.
2. Download this page, or leave it saved so Save map picture uses it.
3. Use screen pictures again to return Save map picture to the screen.

**Tip.** White space is page margin, not stretched ground. The scale bar assumes the map is north-up.

## View

_The view itself: back to the start, or full screen._

### Reset the view

`resetview` — Back to the opening extent and no filters.

Back to the opening extent with no filters or focus. A playing time slider stops, so the filter does not come back. Rotation returns north-up.

1. Tools → **Reset the view**.

**Tip.** Your layer list and colours are kept; only the view and filters reset.

### Full screen

`fullscreen` — Use the whole screen, no browser chrome.

Uses the whole screen with no browser chrome. The Tools button and the expand button are the same switch.

1. Tools → **Full screen**, or the expand button at the top right.
2. Press Esc or the button again to come back.

**Tip.** If this browser blocks full screen, the map says so and stays as it was.

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

High contrast, larger text and reduced motion. Each control applies as you change it, and this browser keeps the choice for the next visit.

1. Tools → **Accessibility**.
2. Tick high contrast, move the text size, or tick reduced motion. There is no separate Apply.
3. Reset returns all three to the default.

**Tip.** Reduced motion shortens panel and button animations on top of the browser’s own reduced-motion setting. High contrast uses solid borders, not a washed-out filter.

### Gesture Guide

`gestures` — What drag, pinch and double-tap do.

Says what drag, pinch and double-tap do, and whether this device reports a touch screen. A narrow window is not treated as a phone.

1. Tools → **Gesture Guide**.
2. Read the gesture, then close it. Nothing on the map changes.

### Screen Reader

`screenreader` — Live announcements for map changes.

Turns live announcements on or off. When on, layer, filter and measurement toasts are also announced, and the map names the layers that are on. This browser remembers the choice.

1. Tools → **Screen Reader**.
2. Turn live announcements on. Announce current view speaks the centre, zoom and the layers that are on.
3. Turn them off again the same way. The button follows the current state.

### Colorblind Palettes

`colorblind` — Paint a layer with a colourblind-safe ramp.

Paints a layer that is on with a colourblind-safe ramp, or classifies a numeric field with it. The legend follows. Cividis is included. A red-against-green ramp is not offered.

1. Turn a vector layer on.
2. Tools → **Colorblind Palettes**. The map stays visible.
3. Pick the layer, a numeric field or one colour, and a palette, then apply.

**Needs.** A vector layer on. A raster takes the ramp on its legend only.

**Tip.** The same ramps are in Color Ramps. Restore that layer’s own colours from there.

## Sharing & collaboration

_Send the current view, or keep a session and notes in this browser. A share link does not carry colours, filters, notes or an imported file._

### Share View

`shareview` — Copy a link to this centre, layers and focus.

Copies a link that reopens this centre, zoom, basemap and the catalog layers that are on, including a focus area and the grid. Colours, filters, notes and an imported layer are not in the link.

1. Set the map up.
2. Tools → **Share View**. The map stays visible. The link is refreshed when you copy it.
3. Copy the link, or use Share if this device offers it.

**Tip.** The link contains the map centre so the view can reopen. It is not a data export. Use a session code to send colours, filters and notes.

### Session Codes

`session` — Save this map, or paste a code from someone else.

Saves this map in this browser under a 6-character code, and copies a longer code that carries the session so someone else can paste it. There is no server. A 6-character code only works in the browser that saved it.

1. Tools → **Session Codes**. The map stays visible.
2. Save. Copy the longer code to send the session.
3. Paste a code and restore it. The layers, colours, filters, focus area, grid and notes come back after they have loaded.

**Tip.** An imported file stays in this browser and is named, not sent. The centre is restored but not shown.

### Map Notes

`mapnotes` — Markers on the map, kept in this browser.

Adds a text marker on the map. Drag it to move it. It stays in this browser. It is not a layer, it is not in an export, and a share link does not include it.

1. Tools → **Map Notes**. The map stays visible.
2. Type the note and add it at the centre.
3. Drag the marker to move it, or remove it from the list.

**Tip.** A session code can carry the notes. A share link cannot.

## Raster tools

_Cell tools for a raster that is on. A new surface or contour is drawn on the map and can be cleared. A count or a chart stays in the panel and says so._

### Raster Calculator

`rastercalc` — New surface from a cell expression.

Builds a new surface from each cell of one raster. The expression can use v, numbers, + - * /, comparisons, and abs, sqrt, log, round, floor or ceil. It does not run typed code. The original layer is unchanged.

1. Turn a raster on.
2. Tools → **Raster Calculator**. The map stays visible.
3. Write an expression such as v * 2 or v > 100, then run. The new surface is drawn on the map.

**Needs.** A raster layer on.

**Tip.** Empty cells stay empty. Clear removes the surface.

### Raster Reclassify

`rasterreclass` — Draw cell values as classes.

Groups the cell values into equal-interval or quantile classes and draws those classes as a new surface. It does not recolour the original raster, and it is not the vector classifier.

1. Turn a raster on.
2. Tools → **Raster Reclassify**. The map stays visible.
3. Choose the method and the number of classes, then run.

**Needs.** A raster layer on.

**Tip.** Class numbers on the new surface start at 1. The original layer is unchanged.

### Raster Statistics

`rasterstats` — Min, max and mean, in the panel.

Reports the lowest, highest, mean and standard deviation of the cell values. The numbers stay in the panel. This does not draw a layer.

1. Turn a raster on.
2. Tools → **Raster Statistics**. The map stays visible.
3. Choose the raster and run. Read the panel.

**Needs.** A raster layer on.

**Tip.** Empty cells are skipped, not treated as zero.

### Raster Clip / Mask

`rasterclip` — Keep cells inside the focus area.

Draws a new surface that keeps a cell only when its centre is inside the focus area. It does not draw the focus box as a layer, and it does not change the original raster.

1. Set a focus area.
2. Turn a raster on.
3. Tools → **Raster Clip / Mask**. The map stays visible.
4. Run. Cells outside the focus are left empty on the new surface.

**Needs.** A focus area and a raster layer on.

**Tip.** A cell on the boundary follows its centre.

### Raster Contour

`rastercontour` — Lines on the raster, at an interval.

Draws contour lines on the raster at the interval you set. The lines use the raster position on the map, not pixel numbers. A very fine interval is limited, and the panel says so.

1. Turn a raster on.
2. Tools → **Raster Contour**. The map stays visible.
3. Set the interval and run.

**Needs.** A raster layer on.

**Tip.** Lines are traced on a sample of the cells, so a bend between samples is not drawn.

### Raster Slope

`rasterslope` — Slope in degrees, as a new surface.

Draws a new surface of slope in degrees, using the ground size of each cell. That is a ground slope only when the cell values are heights in metres, such as the elevation layer.

1. Turn the elevation raster on.
2. Tools → **Raster Slope**. The map stays visible.
3. Run. The steepest samples are listed in the panel, without a location.

**Needs.** A raster layer on. Use elevation if you want a ground slope.

**Tip.** The edge of the raster is left empty, because a slope needs neighbouring cells. The original layer is unchanged.

### Raster Histogram

`rasterhist` — Value bars, in the panel.

Shows how the cell values are spread, as bars in the panel. This does not draw a layer.

1. Turn a raster on.
2. Tools → **Raster Histogram**. The map stays visible.
3. Choose the number of bars and run.

**Needs.** A raster layer on.

**Tip.** Empty cells are skipped, not treated as zero.

### Raster Clip by Polygon

`rasterclipoly` — Keep cells inside a polygon.

Draws a new surface that keeps a cell only when its centre is inside a polygon. The original raster is unchanged.

1. Turn on a raster and a polygon layer.
2. Tools → **Raster Clip by Polygon**. The map stays visible.
3. Choose both and run.

**Needs.** A raster and a polygon layer on.

**Tip.** A selected polygon, or a focus area, narrows which polygons are used. A cell in a hole is left empty.

### Raster Overlay Math

`rasteroverlay` — New surface from two rasters.

Draws a new surface from two rasters, cell by cell: add, subtract, multiply, divide, minimum or maximum. Both rasters must have the same number of rows and columns. The originals are unchanged.

1. Turn on two rasters of the same size.
2. Tools → **Raster Overlay Math**. The map stays visible.
3. Choose A, B and the operation. Raster B starts on the other layer.
4. Run.

**Needs.** Two different rasters on, with the same number of rows and columns.

**Tip.** A cell is left empty when either raster is empty, or when a division is by zero.

### Raster Class Zonal

`rasterclasszonal` — Class counts inside each polygon.

Counts how much of each raster class falls inside each polygon. The counts stay in the panel. This does not draw a layer. A raster with no published classes is grouped into equal-interval bins, and the panel says so.

1. Turn on a raster and a polygon layer.
2. Tools → **Raster Class Zonal**. The map stays visible.
3. Choose both and run. Read the table.

**Needs.** A raster and a polygon layer on.

**Tip.** The grid is sampled. A cell in two polygons is counted in both. Empty cells are skipped.

### Raster Difference

`rasterdiff` — How many cells are higher or lower.

Subtracts raster B from raster A cell by cell and reports how many cells are higher, lower or equal. The counts stay in the panel. This does not draw a new map layer.

1. Turn on two rasters of the same size.
2. Tools → **Raster Difference**. The map stays visible. Raster B starts on the other layer.
3. Run. Read the counts.

**Needs.** Two different rasters on, with the same number of rows and columns.

**Tip.** A cell with no value in either raster is skipped, not treated as zero.

## Geometry operations

_Shape operations. A new shape is drawn and the source is left unchanged. A measurement stays in the panel and says so._

### Feature Centroid

`centroid` — Area centre, drawn as points.

Draws a point at the area centre of each polygon, or the vertex centre of a line or point. A hole is left out of a polygon centre. The original layer is unchanged.

1. Turn a vector layer on.
2. Tools → **Feature Centroid**. The map stays visible.
3. Choose the layer and run. The points are drawn.

**Needs.** A point, line or polygon layer on.

**Tip.** A selection or a focus area narrows which features are used.

### Densify Lines

`densify` — Vertices every few kilometres.

Draws a copy of each line with a vertex added every time the line travels the interval. The interval is kilometres on the ground. The original line is unchanged.

1. Turn a line layer on.
2. Tools → **Densify Lines**. The map stays visible.
3. Set the interval in kilometres and run.

**Needs.** A line layer on.

**Tip.** A short leftover at the end is kept. It is not stretched to another full step.

### Split Polygon by Line

`splitpoly` — Cut polygons where a line crosses.

Cuts each polygon where a line crosses it and draws the pieces. A line that misses, or only touches, leaves that polygon whole. The original layers are unchanged.

1. Turn on a polygon layer and a line layer.
2. Tools → **Split Polygon by Line**. The map stays visible.
3. Choose both and run. Cut pieces are amber.

**Needs.** A polygon layer and a line layer on.

**Tip.** This uses the line layer. It does not ask you to draw a new line.

### Concave Hull

`concavehull` — Outline that can follow a bay.

Draws one outline around the vertices. A smaller alpha, in kilometres, can follow a bay when a neighbour is close enough. If the points are farther apart than that, the outline is the convex hull.

1. Turn a vector layer on.
2. Tools → **Concave Hull**. The map stays visible.
3. Set alpha in kilometres and run.

**Needs.** A point, line or polygon layer on.

**Tip.** Alpha is a ground distance, not a unitless slider. A large value stays near the convex hull.

### Affine Transform

`affinetransform` — Move in km, rotate, scale.

Draws a moved, rotated or scaled copy. East and north are kilometres on the ground, not degrees. The original layer is unchanged.

1. Turn a vector layer on.
2. Tools → **Affine Transform**. The map stays visible.
3. Set east, north, scale and rotation, then run.

**Needs.** A point, line or polygon layer on.

**Tip.** Rotation is around each feature’s own centre.

### Lines to Polygons

`linetopoly` — Close lines that can hold area.

Closes each line that has at least three vertices and draws it as a polygon. A two-point line is skipped. The original line is unchanged.

1. Turn a line layer on.
2. Tools → **Lines to Polygons**. The map stays visible.
3. Run. Closed rings are drawn.

**Needs.** A line layer on.

**Tip.** A line that was already closed is still one polygon. It is not closed a second time.

### Polygon Outlines

`polyoutline` — Boundary lines, including holes.

Draws each outer ring and each hole as its own line. The polygons are unchanged.

1. Turn a polygon layer on.
2. Tools → **Polygon Outlines**. The map stays visible.
3. Run. The lines are drawn.

**Needs.** A polygon layer on.

**Tip.** A hole is a line too, not dropped.

### Smooth Features

`featuresmooth` — A smoothed copy, source unchanged.

Draws a copy with each vertex moved toward its two neighbours. Endpoints of an open line stay put. The original layer is unchanged.

1. Turn a line or polygon layer on.
2. Tools → **Smooth Features**. The map stays visible.
3. Set the number of passes and run.

**Needs.** A line or polygon layer on.

**Tip.** More passes pull the shape further toward a simple curve. They do not add vertices.

### Feature Buffer

`featurebuffer` — Zone around each feature, in km.

Draws a zone around every feature at the distance you set, in kilometres on the ground. The original layer is unchanged.

1. Turn a point, line or polygon layer on.
2. Tools → **Feature Buffer**. The map stays visible.
3. Set the distance in kilometres and run.

**Needs.** A point, line or polygon layer on.

**Tip.** Points become circles, lines become corridors, polygons grow outward.

### Bounding Box / Envelope

`boundingbox` — A rectangle around each feature.

Draws the rectangle around each feature. A single point has no area, so it is skipped. The original layer is unchanged.

1. Turn a vector layer on.
2. Tools → **Bounding Box / Envelope**. The map stays visible.
3. Run. One rectangle is drawn per feature that has an extent.

**Needs.** A point, line or polygon layer on.

**Tip.** The rectangle uses the vertices, not a padded guess.

### Vertices to Points

`vertexstopoints` — One point per vertex.

Draws one point for every vertex. The closing point of a ring is not drawn twice. The original layer is unchanged.

1. Turn a vector layer on.
2. Tools → **Vertices to Points**. The map stays visible.
3. Run. The points are drawn.

**Needs.** A point, line or polygon layer on.

**Tip.** A point layer comes back as the same points.

### Area & Perimeter

`areaperim` — km² and km, holes subtracted.

Reports area in km² and perimeter in km for every polygon. A hole is subtracted from the area and added to the perimeter. The numbers stay in the panel. This does not draw a layer.

1. Turn a polygon layer on.
2. Tools → **Area & Perimeter**. The map stays visible.
3. Run. Read the table.

**Needs.** A polygon layer on.

**Tip.** A hole is not added to the area.

### Points Along Lines

`linepoints` — Points every few kilometres.

Draws a point at the start of each line, then one each time the line travels the interval. The interval is kilometres on the ground and continues across a bend. The original line is unchanged.

1. Turn a line layer on.
2. Tools → **Points Along Lines**. The map stays visible.
3. Set the interval in kilometres and run.

**Needs.** A line layer on.

**Tip.** The interval does not restart at every vertex.

### Polygon Centroids → Points

`centroidpts` — Area centre of each polygon.

Draws the area centre of each polygon. A hole is left out of that centre. The original layer is unchanged.

1. Turn a polygon layer on.
2. Tools → **Polygon Centroids → Points**. The map stays visible.
3. Run. The points are drawn.

**Needs.** A polygon layer on.

**Tip.** This is the area centre, not the average of the vertices.

### Polygon Adjacency

`polyadjacency` — Pairs that share a border.

Lists pairs of polygons that share a border or whose outlines cross. A shared corner alone is not listed. The list stays in the panel. This does not draw a layer.

1. Turn a polygon layer on.
2. Tools → **Polygon Adjacency**. The map stays visible.
3. Run. Read the pairs.

**Needs.** A polygon layer on.

**Tip.** A gap, even a small one, is not a shared border.

### Line Offset

`lineoffset` — Parallel copy, in kilometres.

Draws a parallel copy of each line at the distance you set, in kilometres on the ground. Left of a line going east is north. The original line is unchanged.

1. Turn a line layer on.
2. Tools → **Line Offset**. The map stays visible.
3. Set the distance and the side, then run.

**Needs.** A line layer on.

**Tip.** The distance is ground kilometres, not a step in map units.

### Polygon Union / Merge

`polyunion` — Merge polygons and remove shared borders.

Merges every polygon of a layer into one shape and removes the borders they share. Gaps stay open.

1. Switch on a polygon layer.
2. Tools → **Polygon Union / Merge**, choose the layer and run.
3. The merged shape is drawn in green. Attributes are not copied.

**Needs.** A polygon layer on.

**Tip.** Use Dissolve / Merge instead when each attribute value should stay its own shape.

### Line Length Statistics

`linelenstats` — Total, mean, min, max, in the panel.

Reports the total, mean, shortest and longest length of the lines, in kilometres. One row is one line feature. The numbers stay in the panel. This does not draw a layer.

1. Turn a line layer on.
2. Tools → **Line Length Statistics**. The map stays visible.
3. Run. Read the panel.

**Needs.** A line layer on.

**Tip.** A line made of several parts is still one feature.

## Topology & data quality

_Data-quality checks. A check stays in the panel and does not edit the source. A tool that changes geometry draws a copy._

### Check Overlaps

`checkoverlap` — Pairs whose areas overlap, in the panel.

Lists polygon pairs whose areas overlap, with the overlap in km². A shared border alone is not an overlap. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a polygon layer on.
2. Tools → **Check Overlaps**. The map stays visible.
3. Run. Read the pairs.

**Needs.** A polygon layer on.

**Tip.** A shared border is not an overlap. The area has to cross.

### Check Gaps

`checkgaps` — Holes the polygons enclose, not the outside.

Lists holes the polygons enclose between them, with the area of each hole in km². Ground outside the group is not a gap, and a hole cut into one polygon is not a gap. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a polygon layer on.
2. Tools → **Check Gaps**. The map stays visible.
3. Run. Read the enclosed gaps.

**Needs.** A polygon layer on.

**Tip.** Two polygons that only touch, or that leave a corridor open to the outside, have no enclosed gap.

### Validate Geometry

`validate` — Rings, closure, crossings, range.

Lists features with missing coordinates, an unclosed ring, fewer than three ring vertices, a zero-area ring, a ring or line that crosses itself, or a coordinate outside longitude or latitude. A point is checked for coordinates and range only. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point, line or polygon layer on.
2. Tools → **Validate Geometry**. The map stays visible.
3. Run. Read the issues.

**Needs.** A point, line or polygon layer on.

**Tip.** A valid point is not flagged for having no ring.

### Snap Features

`snap` — Copy snapped to another layer, in metres.

Draws a copy of the first layer with each vertex moved onto the nearest vertex of the second layer, when that vertex is within the tolerance. The tolerance is metres on the ground. Neither source layer is changed.

1. Turn on two layers.
2. Tools → **Snap Features**. The map stays visible.
3. Choose which layer moves, which layer it snaps to, and the metres, then run.

**Needs.** Two layers on.

**Tip.** A vertex farther than the tolerance stays where it is.

### Check Self-Intersections

`selfintersect` — Rings and lines that cross themselves.

Lists lines and polygon rings whose own segments cross. A bend, and touching at a shared vertex, are not a cross. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a line or polygon layer on.
2. Tools → **Check Self-Intersections**. The map stays visible.
3. Run. Read the features.

**Needs.** A line or polygon layer on.

**Tip.** A bowtie is listed. A simple rectangle is not.

### Duplicate Geometries

`duplicategeom` — Same coordinates, tolerance in metres.

Lists features whose coordinates match. A reverse ring and a different starting vertex still count as the same shape. The tolerance is metres on the ground, not degrees. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point, line or polygon layer on.
2. Tools → **Duplicate Geometries**. The map stays visible.
3. Set the tolerance in metres and run.

**Needs.** A point, line or polygon layer on.

**Tip.** The same outline stored clockwise and anticlockwise is still one shape.

### Snap to Grid

`snaptogrid` — Copy rounded to degrees of lon/lat.

Draws a copy with every longitude and latitude rounded to the grid step, in degrees. The step is not applied to the map’s internal units. The source layer is not changed.

1. Turn a point, line or polygon layer on.
2. Tools → **Snap to Grid**. The map stays visible.
3. Set the step in degrees and run.

**Needs.** A point, line or polygon layer on.

**Tip.** 0.01 degrees is about a kilometre, not a step in map units.

### Feature Erase / Difference

`erasefeatures` — Cut one polygon layer out of another.

Cuts one polygon layer out of another. A polygon that is only partly covered keeps the rest; one that is fully covered is removed.

1. Switch on two polygon layers.
2. Tools → **Feature Erase / Difference**. The second menu starts on the other layer.
3. Run. What remains is drawn in amber. The table lists only polygons that were cut or removed.

**Needs.** Two polygon layers on.

**Tip.** This cuts the overlapping piece out. It does not drop a whole polygon just because it touches the other layer.

### Check Null Geometries

`checknullgeom` — Features with no usable coordinates.

Lists features with no usable coordinates: a point with no position, a line with fewer than two vertices, or a polygon with no ring. A short but real shape is not null. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point, line or polygon layer on.
2. Tools → **Check Null Geometries**. The map stays visible.
3. Run. Read the features.

**Needs.** A point, line or polygon layer on.

**Tip.** A point is not null just because it has no ring.

### Check Out of Bounds

`checkoutofbounds` — Longitude or latitude out of range.

Lists features with a longitude outside −180 to 180, a latitude outside −90 to 90, or a coordinate that is not a number. The test uses degrees, not the map’s internal units. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point, line or polygon layer on.
2. Tools → **Check Out of Bounds**. The map stays visible.
3. Run. Read the features.

**Needs.** A point, line or polygon layer on.

**Tip.** A coordinate inside Nigeria is not out of bounds.

### Check Multi-part Features

`checkmultipart` — Several pieces; a hole is not a part.

Lists features stored as several separate pieces: more than one point, more than one line, or more than one polygon. A hole is part of its polygon, not a second part. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point, line or polygon layer on.
2. Tools → **Check Multi-part Features**. The map stays visible.
3. Run. Read the features and their part counts.

**Needs.** A point, line or polygon layer on.

**Tip.** One polygon with a hole is a single part.

### Ring Direction Check

`ringdirection` — Outer anticlockwise, hole clockwise.

Lists rings that run the wrong way for their role. In this map an outer ring runs anticlockwise and a hole runs clockwise, because map y grows downward. A correct outer ring is not called a hole. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a polygon layer on.
2. Tools → **Ring Direction Check**. The map stays visible.
3. Run. Read the rings that disagree with their role.

**Needs.** A polygon layer on.

**Tip.** Anticlockwise here is the ordinary outer ring, not a fault.

### Feature Within Distance

`featurewithindist` — Nearest ground distance, in the panel.

Lists features of the first layer whose nearest ground distance to the second layer is within the kilometres you set. The distance is to the edge or the interior, not only to a vertex. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn on two layers.
2. Tools → **Feature Within Distance**. The map stays visible.
3. Set the kilometres and run.

**Needs.** Two layers on.

**Tip.** A point inside a polygon is 0 km away, even when it is far from every vertex.

### Spatial Join Count

`spatialjoincount` — point_count written on a drawn copy.

Counts how many points fall inside each polygon and writes that count as a point_count attribute on a drawn copy. The source polygons are not changed. A point on a shared border is counted in each polygon that contains it.

1. Turn on a polygon layer and a point layer.
2. Tools → **Spatial Join Count**. The map stays visible.
3. Run. The copied polygons are drawn, and the table shows each point_count.

**Needs.** A polygon layer and a point layer on.

**Tip.** The count is an attribute of the copy, not a number written back onto the source.

### Buffer Dissolve

`bufferdissolve` — Buffer, then merge overlapping zones.

Draws a circle around each feature, then merges the circles that overlap into one zone.

1. Switch on a point, line or polygon layer.
2. Tools → **Buffer Dissolve**, set the distance in kilometres and run.
3. Overlapping circles become one zone. Circles that do not meet stay separate.

### Remove Small Polygons

`removesmallpoly` — Draws the polygons at or above the minimum.

Draws only the polygons at or above the minimum area, in km². A hole is subtracted, not added. Polygons below the minimum are left off the copy. The source layer is not changed and nothing is hidden.

1. Turn a polygon layer on.
2. Tools → **Remove Small Polygons**. The map stays visible.
3. Set the minimum km² and run. The polygons that remain are drawn.

**Needs.** A polygon layer on.

**Tip.** This draws a copy. It does not delete or hide the source polygons.

## Network & routing

_Tools that follow lines as a network. A route is drawn along the lines and leaves the source unchanged. A check stays in the panel._

### Shortest Path

`shortestpath` — Along the lines, not a straight line.

Draws the shortest route along the lines between two taps. Travel is allowed in either direction. Lines join only where a vertex is within the snap distance, in metres. A crossing without a shared vertex is not a junction. The length is kilometres along the lines, not the straight line between the taps. The source lines are not changed.

1. Turn a line layer on.
2. Tools → **Shortest Path**. The map stays visible.
3. Pick the start and the end on the map, then run.

**Needs.** A line layer on.

**Tip.** If the taps are on lines that never meet, no route is drawn. Crossing is not enough.

### Service Area

`servicearea` — Lines you can reach, not a circle.

Draws the parts of the lines you can travel within the distance, starting from a tap. It is not a circle, and land off the lines is not included. Travel is allowed in either direction. The source lines are not changed.

1. Turn a line layer on.
2. Tools → **Service Area**. The map stays visible.
3. Set the distance in kilometres, pick the start on the map, and run.

**Needs.** A line layer on.

**Tip.** The drawn length stops at the distance. It does not keep going to the end of the line.

### Trace Network

`tracenet` — Follows the stored direction.

Draws the lines reached by following the stored direction from a tap. Downstream runs from the first vertex of each line toward the last. It does not follow a line backward, and it does not know a river’s flow unless the line was stored that way. The source lines are not changed.

1. Turn a line layer on.
2. Tools → **Trace Network**. The map stays visible.
3. Choose downstream or upstream, pick the start on the map, and run.

**Needs.** A line layer on.

**Tip.** Upstream from the first vertex of a line does not walk back along that line.

### Network Buffer

`networkbuffer` — Along the lines from each point.

Draws the lines you can travel within the distance of each point. A point farther from a line than the snap distance is left out and named. This is not a circle around the point. The first 80 points are used. The source layers are not changed.

1. Turn on a line layer and a point layer.
2. Tools → **Network Buffer**. The map stays visible.
3. Set the distance in kilometres and how near a point must be to a line, then run.

**Needs.** A line layer and a point layer on.

**Tip.** A point that is not on a line does not grow a circle.

### Network Connectivity

`networkconnect` — Separate pieces, not dead ends.

Counts separate pieces of a line layer. Two lines are the same piece when a vertex of one is within the snap distance of a vertex of the other. A dead end is a line that stops. It is not a separate piece. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a line layer on.
2. Tools → **Network Connectivity**. The map stays visible.
3. Set the snap distance in metres and run.

**Needs.** A line layer on.

**Tip.** One connected tree has dead ends and is still one piece.

### Multi-Stop Route

`multipath` — Nearest neighbour along the lines.

Orders up to 12 stops by nearest neighbour along the lines, starting at the first stop, and draws that route. It does not return to the start and is not a proven shortest tour. A stop farther from a line than the snap distance is left out. A gap is not crossed with a straight line. The source layers are not changed.

1. Turn on a line layer and a point layer.
2. Tools → **Multi-Stop Route**. The map stays visible.
3. Set how near a stop must be to a line, and run.

**Needs.** A line layer and a point layer on.

**Tip.** Select the stops you want when the layer has more than 12.

### Distance Matrix

`distancematrix` — Straight-line kilometres, in the panel.

Lists the straight-line distance between each pair of points, in kilometres on the ground. This is not the distance along a road. The first 40 points are measured, and a selection narrows that. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a point layer on.
2. Tools → **Distance Matrix**. The map stays visible.
3. Run. Read the pairs.

**Needs.** A point layer on.

**Tip.** A road between the points is not used. The number is the straight line.

### Merge Connected Lines

`linemerge` — Joins only where two ends meet.

Draws a copy with lines joined where exactly two ends meet, within the snap distance in metres. A junction of three or more lines stays a junction. A line is reversed when that is what makes the ends meet. The source layer is not changed.

1. Turn a line layer on.
2. Tools → **Merge Connected Lines**. The map stays visible.
3. Set the snap distance in metres and run.

**Needs.** A line layer on.

**Tip.** Three lines meeting at one point are not merged into one.

### Line Bearing Statistics

`linebearing` — Compass bearing, weighted by length.

Reports the compass bearing of each segment, from north and clockwise, using longitude and latitude. A long segment counts more than a short one. North is increasing latitude, not the map’s internal up. The numbers stay in the panel. This does not draw a layer and does not change the source.

1. Turn a line layer on.
2. Tools → **Line Bearing Statistics**. The map stays visible.
3. Run. Read the directions.

**Needs.** A line layer on.

**Tip.** An eastward line is east. The map’s internal y growing downward is not used.

### Network Betweenness

`networkbetweenness` — Shortest paths through each junction.

Ranks junctions by how many shortest paths along the lines pass through them. A junction is named by the lines that meet there. A dead end ranks below a junction that joins two parts of the network. This is not a count of lines touching the junction. On a network of more than 1,200 junctions the rank uses 200 starts and says so. The list stays in the panel. This does not draw a layer and does not change the source.

1. Turn a line layer on.
2. Tools → **Network Betweenness**. The map stays visible.
3. Set the snap distance in metres and run.

**Needs.** A line layer on.

**Tip.** A junction with many lines touching it is not automatically the highest rank.

## Generation

_New shapes drawn on the map. A grid uses kilometres on the ground and covers the view, or the focus area if one is set. Nothing here edits a source layer._

### Fishnet / Grid

`fishnet` — Kilometre cells over the view.

Draws a rectangular grid over the current view, or over the focus area if one is set. Each cell is the size you set, in kilometres on the ground, measured at the centre of that area. The grid starts at the south-west corner. A cell may extend past the edge so the area is covered. If that size would make more than 2,500 cells, nothing is drawn. This does not edit a layer.

1. Tools → **Fishnet / Grid**. The map stays visible.
2. Set the cell size in kilometres and run.

**Tip.** On the opening view a 5 km cell is too small. Zoom in, or use a larger cell.

### Random Points

`randompts` — Inside the view or the focus area.

Places random points inside the current view, or inside the focus area if one is set. The points are spread across that area on the map. A focus area that is not a rectangle only keeps points that fall inside it. At most 5,000 are placed. This does not edit a layer.

1. Tools → **Random Points**. The map stays visible.
2. Set how many and run.

**Tip.** The points fill the area you are looking at, not a fixed box around the centre.

### Hexagonal Binning

`hexbin` — Counts points in each hexagon.

Draws a hexagon for each group of points and writes how many fell in it. The width is the distance across the hexagon, flat side to flat side, in kilometres on the ground. A point is counted in the hexagon whose centre is nearest. This is not a square grid. A hexagon with no points is not drawn. The source points are not changed. More than 4,000 hexagons keeps the fullest and says so.

1. Turn a point layer on.
2. Tools → **Hexagonal Binning**. The map stays visible.
3. Set the width in kilometres and run.

**Needs.** A point layer on.

**Tip.** The count is an attribute of the drawn hexagon, not a number written back onto the points.

### Regular Point Grid

`gridpoints` — Evenly spaced, in kilometres.

Places points on a regular grid over the current view, or the focus area if one is set. The spacing is kilometres on the ground, measured at the centre. The grid starts at the south-west corner. If that spacing would make more than 2,500 points, nothing is drawn. This does not edit a layer.

1. Tools → **Regular Point Grid**. The map stays visible.
2. Set the spacing in kilometres and run.

**Tip.** The distance between neighbours is the spacing you set, not a step in map units.

### Random Lines

`randomlines` — Illustration lines, in kilometres.

Draws random lines inside the current view, or the focus area if one is set, for illustration. Each step is about the length you set, in kilometres on the ground. The lines are not a survey and they do not follow a road. At most 500 are drawn. This does not edit a layer.

1. Tools → **Random Lines**. The map stays visible.
2. Set the count, the vertices and the step in kilometres, then run.

**Tip.** A short step on a wide view makes a short line. That length is still kilometres on the ground.

### Random Polygons

`randompolygons` — Simple shapes, in kilometres.

Draws random polygons inside the current view, or centred in the focus area if one is set, for illustration. Each polygon is a simple shape about the width you set, in kilometres on the ground. Vertices go in order around the centre, so the shape does not cross itself. It is not a survey boundary. At most 500 are drawn. This does not edit a layer.

1. Tools → **Random Polygons**. The map stays visible.
2. Set the count, the vertices and the width in kilometres, then run.

**Tip.** If the width is larger than the view, it is reduced so the shape fits, and the panel says so.

### Random Sample

`randomsample` — A copy, the source unchanged.

Draws a random subset of the features that are on, as a new layer. A selection, or a focus area, narrows the features it can pick. The copy does not share its shape with the source. The source is not hidden and is not changed. More than 2,000 features keeps 2,000 and says so. A later run can pick a different subset.

1. Turn a point, line or polygon layer on.
2. Tools → **Random Sample**. The map stays visible.
3. Set how many and run.

**Needs.** A point, line or polygon layer on.

**Tip.** The source layer stays as it was. Nothing is hidden.

### Random Raster

`randomraster` — A random surface, not a measurement.

Draws a new raster surface over the current view, or the focus area if one is set. Each cell is a random number between the minimum and the maximum. Neighbouring cells are not related. This is not a measurement of the ground, and it is not added to the catalog. The surface can be cleared.

1. Tools → **Random Raster**. The map stays visible.
2. Set the columns, rows and the value range, then run.

**Tip.** The cell count is the columns times the rows. It is not a kilometre size.

## Classification

_Turn a numeric field into classes (natural breaks, quantile, equal interval)._

### Natural Breaks (Jenks)

`jenksbreaks` — Jenks natural breaks classes.

Classifies a numeric field with Jenks natural breaks — classes that follow the gaps in the numbers, not equal counts or equal widths. The table stays in the panel. The layer is coloured with Cividis. The source file is not edited.

1. Tools → **Natural Breaks (Jenks)**, choose the layer, field and classes.
2. Press **Classify**. The ranges stay open. Restore brings the layer’s own colours back.

**Tip.** Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.

### Quantile Classification

`quantileclass` — Equal-count quantile classes.

Classifies a numeric field into equal-count classes. Identical values stay in one class, so a repeated value can make the counts uneven. The table stays in the panel and the layer is coloured. The source file is not edited.

1. Tools → **Quantile Classification**, choose the layer, field and classes.
2. Press **Classify**. The ranges stay open. Restore brings the layer’s own colours back.

**Tip.** Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.

### Equal Interval Classification

`equalintervalclass` — Equal-width value classes.

Classifies a numeric field into equal-width classes, from the lowest value to the highest. A step with no features is still listed. The table stays in the panel and the layer is coloured. The source file is not edited.

1. Tools → **Equal Interval Classification**, choose the layer, field and classes.
2. Press **Classify**. The ranges stay open. Restore brings the layer’s own colours back.

**Tip.** Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.

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
