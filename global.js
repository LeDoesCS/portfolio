console.log("IT’S ALIVE!");

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