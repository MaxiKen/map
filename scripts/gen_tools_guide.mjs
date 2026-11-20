// Generates docs/tools-guide.md from the tool registry and TOOL_HELP inside app/js/app.js,
// so the written guide can never drift from what the Tools panel actually offers.
//
//   node scripts/gen_tools_guide.mjs           # write the file
//   node scripts/gen_tools_guide.mjs --check   # fail if the file is out of date
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'app/js/app.js'), 'utf8');

function sliceLiteral(startMarker, endMarker = '\n};') {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error(`not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error(`unterminated literal: ${startMarker}`);
  return src.slice(start, end + endMarker.length);
}

const groupsSrc = sliceLiteral('const TOOL_GROUPS = {');
const helpSrc = sliceLiteral('const TOOL_HELP = {');
const notesSrc = sliceLiteral('const GUIDE_GROUP_NOTES = {');
const labelsSrc = sliceLiteral('const GUIDE_GROUP_LABEL = {');

const asModule = (body) => import('data:text/javascript,' + encodeURIComponent(body));
const { TOOL_GROUPS } = await asModule(groupsSrc + '\nexport { TOOL_GROUPS };');
const { TOOL_HELP } = await asModule(helpSrc.replace('const TOOL_HELP', 'export const TOOL_HELP'));
const { GUIDE_GROUP_NOTES, GUIDE_GROUP_LABEL } = await asModule(
  notesSrc + '\n' + labelsSrc + '\nexport { GUIDE_GROUP_NOTES, GUIDE_GROUP_LABEL };',
);

const plain = (html) => html
  .replace(/<b>/g, '**').replace(/<\/b>/g, '**')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();
const anchor = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const groups = Object.entries(TOOL_GROUPS).filter(([g]) => g !== 'author');
const total = groups.reduce((n, [, list]) => n + list.length, 0);
const out = [];

out.push('# Every tool, explained');
out.push('');
out.push('This is the guide the map itself shows under **Tools → Guide**, as a file you can read, print or');
out.push('hand to a colleague. It is generated from the same tool list that builds the Tools panel, so it');
out.push(`always matches the app: ${total} tools, in the order you usually need them.`);
out.push('');
out.push('- Every tool is read-only: nothing here edits the underlying data files.');
out.push('- Results are drawn on the map or shown in a panel. The only download is a PNG picture of the');
out.push('  map — no data is ever exported as CSV, GeoJSON or any other file.');
out.push('- The map behaves the same on a phone, a tablet and a desktop. Where a gesture differs, the');
out.push('  guide says so.');
out.push('');
out.push('## Contents');
out.push('');
for (const [g, list] of groups) {
  const label = GUIDE_GROUP_LABEL[g] || g;
  out.push(`- [${label}](#${anchor(label)}) — ${list.length} tools`);
}
out.push('');

for (const [g, list] of groups) {
  const label = GUIDE_GROUP_LABEL[g] || g;
  out.push(`## ${label}`);
  out.push('');
  if (GUIDE_GROUP_NOTES[g]) {
    out.push(`_${GUIDE_GROUP_NOTES[g]}_`);
    out.push('');
  }
  for (const [id, , name, desc] of list) {
    const help = TOOL_HELP[id];
    out.push(`### ${name}`);
    out.push('');
    out.push(`\`${id}\` — ${desc}.`);
    out.push('');
    if (!help) {
      out.push('_No detailed steps yet. Open **Tools → Guide** for the generic steps._');
      out.push('');
      continue;
    }
    if (help.about) { out.push(plain(help.about)); out.push(''); }
    if (help.steps?.length) {
      help.steps.forEach((step, i) => out.push(`${i + 1}. ${plain(step)}`));
      out.push('');
    }
    if (help.needs) { out.push(`**Needs.** ${plain(help.needs)}`); out.push(''); }
    if (help.tip) { out.push(`**Tip.** ${plain(help.tip)}`); out.push(''); }
  }
}

out.push('## Gestures: phone, tablet and desktop');
out.push('');
out.push('| Action | Touch | Mouse / trackpad |');
out.push('|---|---|---|');
out.push('| Pan the map | Drag with one finger | Drag |');
out.push('| Zoom | Pinch, or double-tap | Scroll wheel, `+`/`-` keys or the buttons |');
out.push('| Read a feature | Tap it | Click it, or hover to see its name |');
out.push('| Select features | Select mode, then tap or drag a box | Same, with the mouse |');
out.push('| Select several at once | Drag a box across them | Drag a box across them |');
out.push('| Unselect one | Tap the same feature again, or List → remove | Click it again |');
out.push('| Cancel a drawing | Cancel in the bar at the top | Esc, or Cancel |');
out.push('| Leave select mode | Done in the selection bar | Done, or Esc |');
out.push('');
out.push('## If something does not respond');
out.push('');
out.push('- **“Tap inside a polygon”** — the tool needs a feature of the boundary layer under your');
out.push('  finger. Zoom in and tap well inside the shape.');
out.push('- **Nothing selected** — the layer you are picking from may be filtered or hidden. Check');
out.push('  Layers, then try again.');
out.push('- **“No raster layer” / “No polygon layer”** — switch the right kind of layer on first');
out.push('  (Layers → open a group → tap the switch).');
out.push('- **Blank map** — a focus area may be hiding everything. Layers → Focused, or');
out.push('  Tools → Clip to an area → Clear focus.');
out.push('- **Basemap missing** — tiles need internet. Your data layers still draw; try another');
out.push('  basemap or None.');
out.push('- **A big layer takes a second or two** — the toast names what is being worked on, the map');
out.push('  stays responsive, and the answer appears as soon as it is ready.');
out.push('');
out.push('Author tools (`symbology`, `addlabel`, `savelabels`, `import`, `reset`) only appear with');
out.push('`?author=1`, because they change what every visitor sees.');
out.push('');

const target = resolve(root, 'docs/tools-guide.md');
const text = out.join('\n');
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== text) {
    console.error('docs/tools-guide.md is out of date — run node scripts/gen_tools_guide.mjs');
    process.exit(1);
  }
  console.log('docs/tools-guide.md is up to date');
} else {
  writeFileSync(target, text);
  console.log(`wrote docs/tools-guide.md (${total} tools, ${text.split('\n').length} lines)`);
}
