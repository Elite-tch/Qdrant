function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return "";
  }
}

function isGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

function extractGitHubRepoPath(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1].replace(/\.git$/i, ""),
  };
}

function stripHtml(html) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractMetaContent(html, names) {
  for (const name of names) {
    const regex = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const match = html.match(regex);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return "";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "IdeaRadar/1.0",
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status})`);
  }

  return response.text();
}

async function resolveLiveProjectUrl(projectUrl) {
  try {
    const html = await fetchText(projectUrl);
    const title =
      extractMetaContent(html, ["og:title", "twitter:title"]) || /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] || "";
    const description =
      extractMetaContent(html, ["description", "og:description", "twitter:description"]) || "";
    return [
      `Live project URL: ${projectUrl}`,
      title ? `Project title: ${title}` : "",
      description ? `Project description: ${description}` : "",
      `Page summary: ${stripHtml(html).slice(0, 3000)}`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return [`Live project URL: ${projectUrl}`, "Project page could not be fetched."]
      .filter(Boolean)
      .join("\n");
  }
}

async function resolveGitHubProjectUrl(githubUrl) {
  if (!isGitHubUrl(githubUrl)) {
    return [`GitHub URL: ${githubUrl}`, "No README found."].join("\n");
  }

  try {
    const repo = extractGitHubRepoPath(githubUrl);
    if (!repo) {
      return [`GitHub URL: ${githubUrl}`, "No README found."].join("\n");
    }

    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/readme`;
    const response = await fetch(apiUrl, {
      headers: {
        "user-agent": "IdeaRadar/1.0",
        accept: "application/vnd.github.raw+json",
      },
    });

    if (!response.ok) {
      return [`GitHub URL: ${githubUrl}`, "No README found."].join("\n");
    }

    const readme = cleanText(await response.text());
    return [`GitHub URL: ${githubUrl}`, readme ? `README: ${readme.slice(0, 5000)}` : "No README found."]
      .filter(Boolean)
      .join("\n");
  } catch {
    return [`GitHub URL: ${githubUrl}`, "No README found."].join("\n");
  }
}

function toUrlList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanUrl).filter(Boolean);
  }

  const cleaned = cleanUrl(value);
  return cleaned ? [cleaned] : [];
}

export async function resolveIdeaSources(input) {
  const sections = [];
  const projectUrls = toUrlList(input.projectUrls ?? input.projectUrl);
  const githubUrls = toUrlList(input.githubUrls ?? input.githubUrl);

  if (input.targetUser) {
    sections.push(`Target user: ${cleanText(input.targetUser)}`);
  }

  if (input.problem) {
    sections.push(`Problem: ${cleanText(input.problem)}`);
  }

  if (input.solution) {
    sections.push(`Solution: ${cleanText(input.solution)}`);
  }

  for (const projectUrl of projectUrls.slice(0, 3)) {
    sections.push(await resolveLiveProjectUrl(projectUrl));
  }

  for (const githubUrl of githubUrls.slice(0, 3)) {
    sections.push(await resolveGitHubProjectUrl(githubUrl));
  }

  return sections.filter(Boolean).join("\n");
}
