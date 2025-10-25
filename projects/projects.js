import { fetchJSON, renderProjects } from '../global.js';

const DATA_URL = new URL('../lib/projects.json', import.meta.url);

const container = document.querySelector('.projects');
const titleEl   = document.querySelector('.projects-title');

const placeholder = (msg) => {
  if (!container) return;
  container.innerHTML = `<p class="muted" style="opacity:.75">${msg}</p>`;
};

const setTitle = (n) => {
  if (titleEl) titleEl.textContent = `${n} Project${n === 1 ? '' : 's'}`;
};

try {
  const projects = await fetchJSON(DATA_URL);

  if (!Array.isArray(projects)) {
    setTitle(0);
    placeholder('Error loading projects.');
  } else if (projects.length === 0) {
    setTitle(0);
    placeholder('No projects yet — check back soon!');
  } else {
    setTitle(projects.length);
    renderProjects(projects, container, 'h2');
  }
} catch (err) {
  console.error(err);
  setTitle(0);
  placeholder('Error loading projects.');
}

