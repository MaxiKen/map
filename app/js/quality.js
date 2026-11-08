// Presentation-only views over the compact register already embedded in catalog.json.
// No quality score is calculated and missing metadata is never replaced with a guess.
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const human = (value) => String(value || 'not recorded').replaceAll('_', ' ');

const CLASSES = {
  current_structural_pass: {
    short: 'Checks pass', label: 'Current · structural checks pass', tone: 'pass',
    note: 'Applicable integrity, CRS, extent and geometry checks passed. This is not a positional-accuracy or source-completeness certification.',
  },
  current_with_documented_limits: {
    short: 'Limits documented', label: 'Current · documented limitations', tone: 'limits',
    note: 'The layer is usable with the limitations and reviewed disposition below. Structural checks alone do not remove those limitations.',
  },
  review_required: {
    short: 'Review required', label: 'Review required', tone: 'review',
    note: 'A specific review remains open. A structural pass does not resolve the semantic, provenance or source-vintage issue described below.',
  },
  hidden_historical_provenance: {
    short: 'Historical provenance', label: 'Hidden · historical provenance', tone: 'muted',
    note: 'Historical defects are retained as provenance, not presented as a current clean layer.',
  },
  hidden_source_restricted: {
    short: 'Source restricted', label: 'Hidden · source restricted', tone: 'muted',
    note: 'This source is retained for evidence or provenance and is not published as a current map layer.',
  },
};
const UNKNOWN_CLASS = {
  short: 'Quality unrecorded', label: 'Quality not recorded', tone: 'muted',
  note: 'No reviewed quality classification is available for this layer.',
};
const GAP_LABELS = {
  publisher: 'Publisher',
  dataset: 'Dataset name',
  url: 'Source URL',
  licence_or_terms: 'Licence / terms',
  temporal_coverage: 'Temporal coverage',
  metadata_reference: 'Local metadata reference',
};

export function qualityPresentation(meta) {
  return CLASSES[meta?.quality?.qualityUseClass] || UNKNOWN_CLASS;
}

export function metadataGapLabels(sourceMetadata) {
  return (sourceMetadata?.metadataGaps || []).map((field) => GAP_LABELS[field] || human(field));
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

function recorded(value) {
  return value !== undefined && value !== null && String(value).trim() ? esc(value) : '<span class="quality-missing">Not recorded</span>';
}

function kv(rows) {
  return `<div class="kv">${rows.map(([key, value]) => `<div>${esc(key)}</div><div>${value}</div>`).join('')}</div>`;
}

export function qualityDetailHTML(meta) {
  const quality = meta.quality || {};
  const source = meta.sourceMetadata || {};
  const cross = meta.crossBorder || {};
  const presentation = qualityPresentation(meta);
  const gaps = metadataGapLabels(source);
  const limitations = quality.limitations || [];
  const sourceUrl = safeHttpUrl(source.url);
  const hash = /^[0-9a-f]{64}$/i.test(quality.sourceSha256 || '') ? quality.sourceSha256 : '';
  const fieldsRecorded = source.metadataFieldsRecorded ?? 0;
  const fieldsTotal = source.metadataFieldsTotal ?? 6;
  const description = meta.description || source.description;
  return `<article class="quality-detail" data-quality-detail="${esc(meta.id)}">
    <div class="quality-detail-head">
      <div><h3 class="quality-title">${esc(meta.label)}</h3><p>${esc(meta.group)} · ${esc(meta.kind)}${meta.count != null ? ` · ${Number(meta.count).toLocaleString()} features` : ''}</p></div>
      <span class="quality-status q-${presentation.tone}">${esc(presentation.label)}</span>
    </div>
    <p class="quality-explainer">${esc(presentation.note)}</p>
    <section><h4>Measured checks and review</h4>${kv([
      ['Structural checks', esc(human(quality.structuralStatus))],
      ['Topology', esc(human(quality.topologyStatus))],
      ['Reviewed disposition', recorded(quality.reviewStatus)],
      ['Coverage interpretation', esc(human(quality.coverageStatus))],
      ['Quality register', recorded(quality.registerId)],
    ])}</section>
    <section><h4>Limitations and caveats</h4>
      ${limitations.length ? `<ul class="quality-list">${limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="quality-note">No additional narrative limitations are recorded. This does not certify absolute accuracy.</p>'}
    </section>
    <section><h4>Source metadata</h4>
      <div class="quality-gapbox ${gaps.length ? 'has-gaps' : 'is-complete'}">
        <b>${fieldsRecorded} of ${fieldsTotal} tracked fields recorded · ${esc(human(source.metadataStatus))}</b>
        <p>${gaps.length ? `Not recorded: ${esc(gaps.join(', '))}.` : 'All six tracked source fields are recorded.'}</p>
        <small>Metadata completeness is not licence clearance or a quality score.</small>
      </div>
      ${kv([
        ['Dataset', recorded(source.dataset)],
        ['Publisher', recorded(source.publisher)],
        ['Source URL', sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(sourceUrl)}</a>` : '<span class="quality-missing">Not recorded</span>'],
        ['Licence / terms', recorded(source.licenceOrTerms)],
        ['Licence evidence', esc(human(source.licenceStatus))],
        ['Temporal coverage', recorded(source.temporalCoverage)],
        ['Local evidence reference', source.reference ? `<code>${esc(source.reference)}</code>` : '<span class="quality-missing">Not recorded</span>'],
        ['Source GeoPackage', meta.source ? `<code>${esc(meta.source)}</code>` : '<span class="quality-missing">Not recorded</span>'],
        ['Source SHA-256', hash ? `<code class="quality-hash">${esc(hash)}</code>` : '<span class="quality-missing">Not recorded</span>'],
      ])}
      ${description ? `<p class="quality-note">${esc(description)}</p>` : ''}
      ${source.notes ? `<p class="quality-note"><b>Metadata notes:</b> ${esc(source.notes)}</p>` : ''}
    </section>
    <section><h4>Geographic scope and aggregation</h4>
      ${kv([
        ['Scope class', recorded(cross.scopeClass && human(cross.scopeClass))],
        ['National statistics', recorded(cross.nationalStatistics)],
        ['Foreign features', recorded(cross.foreignFeatures)],
        ['Source retention', recorded(cross.sourceRetention)],
      ])}
      ${cross.scopeNote ? `<p class="quality-note">${esc(cross.scopeNote)}</p>` : ''}
    </section>
    <div class="actions">
      <button class="btn" data-quality-clear>Catalog overview</button>
      ${hash ? `<button class="btn" data-quality-copy="${esc(hash)}">Copy source SHA-256</button>` : ''}
      ${meta.file ? `<a class="btn" href="${esc(meta.file)}" download>Download GeoJSON</a>` : ''}
    </div>
  </article>`;
}

function overviewHTML(catalog, published) {
  const register = catalog.layerQualityRegister;
  const summary = register.summary;
  const publishedGaps = published.filter((meta) => metadataGapLabels(meta.sourceMetadata).length).length;
  const review = published.filter((meta) => meta.quality.qualityUseClass === 'review_required');
  const counts = summary.quality_use_class_counts || {};
  const structural = summary.structural_status_counts || {};
  const registerFile = register.registerFile || 'quality-register.json';
  return `<section class="quality-overview">
    <div class="quality-intro"><b>Evidence, not a score</b>
      <p>Checks, source completeness, publication state and narrative caveats are shown separately. Structural passes do not certify survey accuracy, and metadata completeness does not grant reuse rights.</p>
    </div>
    <div class="statgrid quality-stats">
      <div class="statbox"><b>${published.length}</b><small>published layers</small></div>
      <div class="statbox"><b>${review.length}</b><small>published layers need review</small></div>
      <div class="statbox"><b>${publishedGaps}</b><small>published layers have metadata gaps</small></div>
      <div class="statbox"><b>${summary.layers_with_metadata_gaps ?? 0}</b><small>layers with gaps across all ${summary.layer_count ?? 0} sources</small></div>
    </div>
    <h3>Published use classes</h3>
    <div class="quality-breakdown">
      <div><span class="quality-status q-pass">Checks pass</span><b>${counts.current_structural_pass ?? 0}</b><small>Current layers without an additional documented-limit use class</small></div>
      <div><span class="quality-status q-limits">Limits documented</span><b>${counts.current_with_documented_limits ?? 0}</b><small>Current layers with explicit scope, coverage or interpretation limits</small></div>
      <div><span class="quality-status q-review">Review required</span><b>${counts.review_required ?? 0}</b><small>Open source-vintage, semantic or provenance review</small></div>
    </div>
    <h3>Open review</h3>
    ${review.length ? review.map((meta) => `<button class="quality-review-row q-review" data-quality-layer="${esc(meta.id)}"><span><b>${esc(meta.label)}</b><small>${esc((meta.quality.limitations || [])[0] || 'Open review required')}</small></span><span>Inspect</span></button>`).join('') : '<p class="quality-note">No published layer is currently classified as review required.</p>'}
    <div class="quality-register">
      <b>Complete source register</b>
      <p>The download covers all <b>${summary.layer_count ?? 0}</b> sources: ${summary.visible_layer_count ?? published.length} visible and ${summary.hidden_layer_count ?? 0} hidden. Across those sources, ${structural.structural_pass ?? 0} pass applicable structural checks and ${structural.historical_defects_retained ?? 0} hidden originals retain historical defects as provenance.</p>
      <p><code>${esc(register.registerId)}</code> · generated ${esc((register.generatedUtc || '').slice(0, 10) || 'date not recorded')}</p>
      <p class="quality-hash-label">Register SHA-256<br><code class="quality-hash">${esc(register.registerSha256 || 'not recorded')}</code></p>
      <a class="btn primary" href="${esc(registerFile)}" download>Download full JSON register</a>
    </div>
  </section>`;
}

export function qualityPanelHTML(catalog, selectedId = null) {
  const published = (catalog.layers || []).filter((meta) => meta.quality && meta.sourceMetadata);
  if (!published.length || !catalog.layerQualityRegister) {
    return '<p class="empty">Quality and source metadata have not been generated for this catalog. No quality judgment is inferred.</p>';
  }
  const selected = published.find((meta) => meta.id === selectedId) || null;
  const options = published.map((meta) => `<option value="${esc(meta.id)}"${selected?.id === meta.id ? ' selected' : ''}>${esc(meta.group)} / ${esc(meta.label)}</option>`).join('');
  const picker = `<div class="quality-picker"><label for="quality-layer">Inspect a published layer</label><select id="quality-layer"><option value="">Choose a layer…</option>${options}</select></div>`;
  const overview = overviewHTML(catalog, published);
  if (selected) {
    return `<div class="quality-intro"><b>Layer quality &amp; source</b><p>Measured checks and descriptive metadata remain separate; no numeric quality score is assigned.</p></div>${picker}${qualityDetailHTML(selected)}<details class="quality-catalog"><summary>Catalog overview and full register</summary>${overview}</details>`;
  }
  return picker + overview;
}
