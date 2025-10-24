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

export const BASE_PATH =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/"   
    : "/portfolio/"; 

export function toSiteUrl(path) {
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path)) return path;
  return BASE_PATH + path.replace(/^\/+/, "");
}

export function renderProjects(projects, containerEl, headingLevel = "h2") {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  const tag = /^h[1-6]$/i.test(headingLevel) ? headingLevel : "h2";

  for (const project of projects) {
    const article = document.createElement("article");

    const imgSrc = project.image
      ? toSiteUrl(project.image)
      : "https://dsc106.com/labs/lab02/images/empty.svg";

    article.innerHTML = `
      <${tag}>${project.title ?? "Untitled project"}</${tag}>
      <img src="${imgSrc}" alt="${project.title ?? ""}">
      <p>${project.description ?? ""}</p>
    `;
    containerEl.appendChild(article);
  }
}