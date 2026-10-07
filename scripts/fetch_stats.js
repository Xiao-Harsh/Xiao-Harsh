const fs = require('fs');
const path = require('path');

async function fetchStats() {
  const username = "Xiao-Harsh";
  console.log(`Fetching stats for user: ${username}...`);

  const sourcePath = path.join(__dirname, '..', 'readme.source.md');
  let content = fs.readFileSync(sourcePath, 'utf8');

  // Read current fallback values directly from readme.source.md
  const currentReposMatch = content.match(/\{\s*label:\s*['"]Repos['"],\s*value:\s*['"]([^'"]+)['"]/);
  const currentDaysMatch = content.match(/\{\s*label:\s*['"]Account Age['"],\s*value:\s*['"]([^'"]+)['"]/);
  const currentCommitsMatch = content.match(/\{\s*label:\s*['"]Commits['"],\s*value:\s*['"]([^'"]+)['"]/);

  let repos = currentReposMatch ? parseInt(currentReposMatch[1], 10) : 12;
  let activeDays = currentDaysMatch ? parseInt(currentDaysMatch[1], 10) : 693;
  let commits = currentCommitsMatch ? parseInt(currentCommitsMatch[1], 10) : 123;
  let createdAt = "2024-11-12T14:11:23Z";

  // Calculate active days dynamically from creation date
  activeDays = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));

  const baseHeaders = { "User-Agent": "readme-aura-fetcher" };
  const authHeaders = process.env.GITHUB_TOKEN 
    ? { ...baseHeaders, "Authorization": `Bearer ${process.env.GITHUB_TOKEN}` }
    : baseHeaders;

  // 1. Fetch User Data (Repos & Created Date)
  let userFetched = false;
  try {
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers: authHeaders });
    if (userRes.ok) {
      const userJson = await userRes.json();
      if (typeof userJson.public_repos === 'number') {
        repos = userJson.public_repos;
        userFetched = true;
      }
      if (userJson.created_at) {
        createdAt = userJson.created_at;
        activeDays = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
      }
    } else {
      console.warn(`User API with auth returned ${userRes.status}, trying unauthenticated...`);
      const unauthUserRes = await fetch(`https://api.github.com/users/${username}`, { headers: baseHeaders });
      if (unauthUserRes.ok) {
        const unauthUserJson = await unauthUserRes.json();
        if (typeof unauthUserJson.public_repos === 'number') {
          repos = unauthUserJson.public_repos;
          userFetched = true;
        }
        if (unauthUserJson.created_at) {
          createdAt = unauthUserJson.created_at;
          activeDays = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
        }
      }
    }
  } catch (err) {
    console.warn("User API request failed:", err.message);
  }

  // Fallback scraping for public repos if API rate-limited
  if (!userFetched) {
    try {
      const profileRes = await fetch(`https://github.com/${username}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (profileRes.ok) {
        const html = await profileRes.text();
        const m = html.match(/Repositories\s*<span[^>]*class="[^"]*Counter[^"]*"[^>]*>(\d+)<\/span>/i)
          || html.match(/data-tab-item="repositories"[\s\S]*?<span[^>]*class="[^"]*Counter[^"]*"[^>]*>(\d+)<\/span>/i);
        if (m) {
          repos = parseInt(m[1], 10);
          console.log(`Scraped public repos from profile: ${repos}`);
          userFetched = true;
        }
      }
    } catch (err) {
      console.warn("Profile scraping fallback failed:", err.message);
    }
  }

  // 2. Fetch Commits Count
  // Note: GitHub Actions default GITHUB_TOKEN does not have permissions for commit search.
  // We try auth first (if custom AURA_TOKEN/PAT), and fallback immediately to unauthenticated search.
  let commitsFetched = false;
  if (process.env.GITHUB_TOKEN) {
    try {
      const searchRes = await fetch(`https://api.github.com/search/commits?q=author:${username}`, {
        headers: { ...authHeaders, "Accept": "application/vnd.github.cloak-preview" }
      });
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        if (typeof searchJson.total_count === 'number') {
          commits = searchJson.total_count;
          commitsFetched = true;
        }
      } else {
        console.warn(`Authenticated commit search returned ${searchRes.status}. Retrying without token...`);
      }
    } catch (err) {
      console.warn("Authenticated commit search failed:", err.message);
    }
  }

  if (!commitsFetched) {
    try {
      const unauthSearchRes = await fetch(`https://api.github.com/search/commits?q=author:${username}`, {
        headers: { ...baseHeaders, "Accept": "application/vnd.github.cloak-preview" }
      });
      if (unauthSearchRes.ok) {
        const unauthSearchJson = await unauthSearchRes.json();
        if (typeof unauthSearchJson.total_count === 'number') {
          commits = unauthSearchJson.total_count;
          commitsFetched = true;
        }
      } else {
        console.warn(`Unauthenticated commit search returned ${unauthSearchRes.status}`);
      }
    } catch (err) {
      console.warn("Unauthenticated commit search failed:", err.message);
    }
  }

  console.log(`Final stats to write: Repos = ${repos}, Active Days = ${activeDays}, Commits = ${commits}`);

  // 3. Update readme.source.md
  content = content.replace('{{REPOS}}', String(repos));
  content = content.replace('{{ACTIVE_DAYS}}', String(activeDays));
  content = content.replace('{{COMMITS}}', String(commits));

  content = content.replace(/(\{\s*label:\s*['"]Repos['"],\s*value:\s*['"])[^'"]*(['"])/, `$1${repos}$2`);
  content = content.replace(/(\{\s*label:\s*['"]Account Age['"],\s*value:\s*['"])[^'"]*(['"])/, `$1${activeDays}$2`);
  content = content.replace(/(\{\s*label:\s*['"]Commits['"],\s*value:\s*['"])[^'"]*(['"])/, `$1${commits}$2`);

  fs.writeFileSync(sourcePath, content, 'utf8');
  console.log("readme.source.md updated successfully!");
}

fetchStats();
