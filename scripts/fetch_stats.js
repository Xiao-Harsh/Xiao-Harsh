const fs = require('fs');
const path = require('path');

async function fetchStats() {
  const username = "Xiao-Harsh";
  
  console.log(`Fetching stats for user: ${username}...`);
  
  try {
    const headers = { "User-Agent": "readme-aura-fetcher" };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Fetch user data (repos and creation date)
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!userRes.ok) throw new Error(`User API returned status ${userRes.status}`);
    const userJson = await userRes.json();
    
    const repos = userJson.public_repos || 8;
    const createdAt = userJson.created_at || "2024-11-12T14:11:23Z";
    const activeDays = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
    
    // 2. Fetch commits count
    const searchRes = await fetch(`https://api.github.com/search/commits?q=author:${username}`, {
      headers: { 
        ...headers,
        "Accept": "application/vnd.github.cloak-preview"
      }
    });
    if (!searchRes.ok) throw new Error(`Search API returned status ${searchRes.status}`);
    const searchJson = await searchRes.json();
    const commits = searchJson.total_count || 51;
    
    console.log(`Successfully fetched stats: Repos = ${repos}, Active Days = ${activeDays}, Commits = ${commits}`);
    
    // 3. Update readme.source.md
    const sourcePath = path.join(__dirname, '..', 'readme.source.md');
    let content = fs.readFileSync(sourcePath, 'utf8');
    
    content = content.replace('{{REPOS}}', String(repos));
    content = content.replace('{{ACTIVE_DAYS}}', String(activeDays));
    content = content.replace('{{COMMITS}}', String(commits));
    
    fs.writeFileSync(sourcePath, content, 'utf8');
    console.log("readme.source.md updated successfully!");
  } catch (err) {
    console.error("Failed to fetch GitHub stats:", err);
    // Fallback to safe defaults but keep activeDays dynamic if network request fails
    const createdAt = "2024-11-12T14:11:23Z";
    const activeDays = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
    
    const sourcePath = path.join(__dirname, '..', 'readme.source.md');
    let content = fs.readFileSync(sourcePath, 'utf8');
    content = content.replace('{{REPOS}}', "8");
    content = content.replace('{{ACTIVE_DAYS}}', String(activeDays));
    content = content.replace('{{COMMITS}}', "51");
    fs.writeFileSync(sourcePath, content, 'utf8');
    console.log(`Fell back to default stats (Repos=8, Commits=51) but updated Active Days to dynamic value: ${activeDays}`);
  }
}

fetchStats();
