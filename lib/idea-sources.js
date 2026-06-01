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

function extractHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
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
  const projectSummaries = [];

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
    const resolved = await resolveLiveProjectUrl(projectUrl);
    projectSummaries.push({
      url: projectUrl,
      host: extractHost(projectUrl),
      quality: assessSourceQuality(resolved),
      summary: resolved,
    });
    sections.push(resolved);
  }

  return {
    text: sections.filter(Boolean).join("\n"),
    projectSummaries,
  };
}

function assessSourceQuality(text) {
  const length = cleanText(text).length;
  if (length >= 1200) {
    return "clear";
  }

  if (length >= 450) {
    return "thin";
  }

  return "missing";
}
