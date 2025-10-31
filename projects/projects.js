import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

// ---------- DOM ----------
const DATA_URL = new URL('../lib/projects.json', import.meta.url);
const container = document.querySelector('.projects');
const titleEl   = document.querySelector('.projects-title');
const svg       = d3.select('#projects-pie-plot');   // <svg id="projects-pie-plot">
const legendUL  = d3.select('.legend');              // <ul class="legend">
const searchEl  = document.querySelector('.searchBar');

// ---------- Inject minimal interaction styles ----------
(function ensurePieStyles(){
  if (document.getElementById('pie-interaction-styles')) return;
  const css = `
  #projects-pie-plot path.slice{transition:transform .18s ease,opacity .18s ease,stroke-width .18s ease}
  #projects-pie-plot:has(path.slice:hover) path.slice:not(:hover):not(.selected){opacity:.55}
  #projects-pie-plot path.slice{cursor:pointer}
  #projects-pie-plot path.slice.selected{stroke:white; stroke-width:4}
  .legend li{display:flex; align-items:center; gap:.5rem; padding:.35rem .55rem; border-radius:.5rem}
  .legend li .swatch{display:inline-block; width:.9rem; height:.9rem; border-radius:50%; background:var(--color)}
  .legend li.selected{outline:2px solid currentColor; outline-offset:2px; background: color-mix(in oklch, var(--color), canvas 85%)}
  `;
  const style = Object.assign(document.createElement('style'), { id: 'pie-interaction-styles', textContent: css });
  document.head.appendChild(style);
})();

// ---------- State ----------
let allProjects      = [];
let filteredProjects = [];
let query            = '';
let selectedLabel    = null; // year string or null

// ---------- Helpers ----------
const placeholder = (msg) => {
  if (container) container.innerHTML = `<p class="muted" style="opacity:.75">${msg}</p>`;
};
const setTitle = (n) => {
  if (titleEl) titleEl.textContent = `${n} Project${n === 1 ? '' : 's'}`;
};

// Build array [{label: '2024', value: 3}, ...] from projects
function rollupByYear(projects) {
  const withYear = projects.filter(p => p.year != null && String(p.year).trim() !== '');
  const rolled = d3.rollups(withYear, v => v.length, d => String(d.year));
  rolled.sort((a,b) => (+a[0]) - (+b[0])); // numeric ascending by year
  return rolled.map(([year, count]) => ({ label: year, value: count }));
}

// Apply text query + selected year to the list (cards and title)
// (This does NOT change the pie — the pie always shows allProjects)
function applyCardFilters() {
  const lowerQ = query.trim().toLowerCase();
  let out = allProjects;

  if (lowerQ) {
    out = out.filter(p => {
      const values = Object.values(p).join('\n').toLowerCase();
      return values.includes(lowerQ);
    });
  }

  if (selectedLabel) {
    out = out.filter(p => String(p.year) === selectedLabel);
  }

  filteredProjects = out;
  setTitle(filteredProjects.length);
  renderProjects(filteredProjects, container, 'h2');
}

function lighten(hex, amt = 0.35) {
  return d3.interpolateRgb(hex, '#ffffff')(amt);
}

function renderPieAndLegend() {
  const data = rollupByYear(allProjects);
  if (!data.length) {
    svg.html('');
    legendUL.html('');
    return;
  }

  const labels = data.map(d => d.label).sort((a,b) => (+a) - (+b));
  const color = d3.scaleOrdinal(d3.schemeSet2).domain(labels);

  // Geometry
  const R   = 140;
  const pie = d3.pie()
    .value(d => d.value)
    .sort((a, b) => (+a.label) - (+b.label));
  const arc = d3.arc().innerRadius(0).outerRadius(R);
  const arcs = pie(data);

  // Clear & draw slices
  svg.html('');
  const slices = svg.selectAll('path.slice')
    .data(arcs, d => d.data.label)
    .join('path')
      .attr('class', 'slice')
      .attr('d', arc)
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.98)
      .on('click', (_, d) => {
        selectedLabel = (selectedLabel === d.data.label) ? null : d.data.label;
        // Update cards only; keep the pie data as-is
        applyCardFilters();
        // Refresh visual highlight on slices & legend
        updateSelectionStyles(slices, legendItems, color);
      });

  // Legend
  legendUL.html('');
  const legendItems = legendUL.selectAll('li')
    .data(arcs, d => d.data.label)
    .join('li')
      .attr('style', d => `--color:${color(d.data.label)}`)
      .html(d => `<span class="swatch"></span> ${d.data.label} <em>(${d.data.value})</em>`)
      .on('click', (_, d) => {
        selectedLabel = (selectedLabel === d.data.label) ? null : d.data.label;
        applyCardFilters();
        updateSelectionStyles(slices, legendItems, color);
      });

  // Initial paint of fills & selection state
  updateSelectionStyles(slices, legendItems, color);
}

// Update fills + ring + legend selection without touching data
function updateSelectionStyles(slices, legendItems, colorScale) {
  slices
    .attr('fill', d => {
      const base = colorScale(d.data.label);
      return (selectedLabel && d.data.label === selectedLabel)
        ? lighten(base, 0.35)  // highlighted fill (lighter than base color)
        : base;                // normal
    })
    .classed('selected', d => selectedLabel && d.data.label === selectedLabel)
    .attr('transform', d => {
      // slight “pop out” for selected
      const sel = selectedLabel && d.data.label === selectedLabel;
      if (!sel) return null;
      const POP = 0.12;
      const [cx, cy] = d3.arc().innerRadius(0).outerRadius(140).centroid(d);
      return `translate(${cx * POP}, ${cy * POP})`;
    });

  legendItems.classed('selected', d => selectedLabel && d.data.label === selectedLabel);
}

// ---------- Boot ----------
try {
  const projects = await fetchJSON(DATA_URL);
  if (!Array.isArray(projects)) {
    setTitle(0);
    placeholder('Error loading projects.');
  } else if (projects.length === 0) {
    setTitle(0);
    placeholder('No projects yet — check back soon!');
  } else {
    allProjects = projects;
    // Initial list + pie
    applyCardFilters();     // list (no query/selection yet)
    renderPieAndLegend();   // pie (based on allProjects)
  }
} catch (err) {
  console.error(err);
  setTitle(0);
  placeholder('Error loading projects.');
}

// ---------- Search (live, case-insensitive; affects cards only) ----------
if (searchEl) {
  searchEl.addEventListener('input', (e) => {
    query = e.target.value || '';
    applyCardFilters();     // update cards; pie remains as-is
    // keep selection highlight as-is; no pie re-render needed
  });
}