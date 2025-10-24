import { fetchJSON, renderProjects, fetchGitHubData} from "./global.js";

const DATA_URL = new URL("./lib/projects.json", import.meta.url);

const container = document.querySelector(".projects");

const showMsg = (msg) => {
  if (container) container.innerHTML = `<p class="muted" style="opacity:.75">${msg}</p>`;
};

if (container) {
  const all = await fetchJSON(DATA_URL);

  if (!Array.isArray(all)) {
    showMsg("Error loading projects.");
  } else {
    const latest = all.slice(0, 3);
    if (latest.length === 0) {
      showMsg("No projects yet — check back soon!");
    } else {
      renderProjects(latest, container, "h3");
    }
  }
}

const profileStats = document.querySelector("#profile-stats");

if (profileStats) {
  try {
    // ← replace with your GitHub username if different
    const githubData = await fetchGitHubData("LeDoesCS");

    if (!githubData) {
      profileStats.textContent = "Could not load GitHub data.";
    } else {
      const {
        login,
        name,
        html_url,
        avatar_url,
        public_repos,
        public_gists,
        followers,
        following,
      } = githubData;

      profileStats.innerHTML = `
        <header class="stats-header">
          <a href="${html_url}" target="_blank" rel="noopener">
            <img src="${avatar_url}" alt="${name || login} avatar" width="64" height="64" style="border-radius:50%;display:block">
            <strong>${name || login}</strong>
            <span>@${login}</span>
          </a>
        </header>

        <dl class="stats-grid">
          <dt>Public Repos</dt><dd>${public_repos}</dd>
          <dt>Public Gists</dt><dd>${public_gists}</dd>
          <dt>Followers</dt><dd>${followers}</dd>
          <dt>Following</dt><dd>${following}</dd>
        </dl>
      `;
    }
  } catch (err) {
    console.error(err);
    profileStats.textContent = "Could not load GitHub data.";
  }
}