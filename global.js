console.log("IT’S ALIVE!");

export const BASE_PATH =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/"                       // local dev
    : "/portfolio/";            // <-- replace with your repo name

export function toSiteUrl(path) {
  if (!path) return "";
  // If already absolute (http(s) or protocol-relative), keep as-is
  if (/^(https?:)?\/\//i.test(path)) return path;
  // Make it absolute to the site root (works from any page)
  return BASE_PATH + path.replace(/^\/+/, "");
}
export async function fetchJSON(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    console.log(response);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
    return null;
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";

document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="scheme-select">
      <option value="light dark">Automatic (${prefersDark})</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  `
);


const select = document.querySelector("#scheme-select");

function applyScheme(value) {
  document.documentElement.style.setProperty("color-scheme", value);
  if (select) select.value = value;
}

const saved = localStorage.getItem("colorScheme");
applyScheme(saved || "light dark");

select?.addEventListener("input", (e) => {
  const value = e.target.value;
  applyScheme(value);
  localStorage.setItem("colorScheme", value);
});

const pages = [
  { url: "",           title: "Home" },
  { url: "projects/",  title: "Projects" },
  { url: "contact/",   title: "Contact" },
  { url: "Resume/",    title: "Resume" },
  { url: "https://github.com/LeDoesCS", title: "GitHub" },
];

const BASE_PATH =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/"
    : "/portfolio/";


const nav = document.createElement("nav");
document.body.prepend(nav);

const here = new URL(location.href);
const normalize = (u) => {
  const url = typeof u === "string" ? new URL(u, here) : u;
  let p = url.pathname;
  if (p.endsWith("/index.html")) p = p.slice(0, -"/index.html".length) + "/";
  if (!p.endsWith("/")) p += "/";
  return { origin: url.origin, pathname: p.toLowerCase() };
};
const cur = normalize(here);

for (const p of pages) {
  let url = p.url;
  if (!url.startsWith("http")) url = BASE_PATH + url;

  const a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;
  nav.append(a);

  const u = normalize(a.href);
  a.classList.toggle("current", u.origin === cur.origin && u.pathname === cur.pathname);
  a.classList.toggle("active",  u.origin === cur.origin && u.pathname === cur.pathname);
  if (a.classList.contains("current")) a.setAttribute("aria-current", "page");

  const isExternal = new URL(a.href).host !== location.host;
  a.toggleAttribute("target", isExternal);
  if (isExternal) {
    a.target = "_blank";
    a.rel = "noopener";
  }
}

const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const params = [];

  for (const [name, value] of data) {
    if (!value) continue;
  }

  for (const [name, value] of new FormData(form)) {
    if (!value) continue;
    params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }

  const url = form.action + (params.length ? `?${params.join('&')}` : '');
  location.href = url;
});

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  // Validate container
  if (!(containerElement instanceof Element)) {
    console.warn('renderProjects: invalid containerElement');
    return 0;
  }

  const h = String(headingLevel).toLowerCase();
  const HEADING = /^h[1-6]$/.test(h) ? h : 'h2';

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.insertAdjacentHTML(
      'beforeend',
      '<p class="muted" style="opacity:.75">No projects yet — check back soon!</p>'
    );
    return 0;
  }

  for (const proj of projects) {
    const article = document.createElement('article');

    const headingEl = document.createElement(HEADING);
    headingEl.textContent = proj?.title ?? 'Untitled project';
    article.append(headingEl);

    const src = proj?.image?.trim();
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = proj?.alt ?? proj?.title ?? 'Project image';
      img.loading = 'lazy';
      img.decoding = 'async';
      article.append(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'img-placeholder';
      ph.setAttribute('aria-hidden', 'true');
      ph.textContent = 'Image coming soon';
      article.append(ph);
    }

    if (proj?.description) {
      const p = document.createElement('p');
      p.textContent = proj.description;
      article.append(p);
    }

    containerElement.append(article);
  }

  return projects.length;
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