import type { CompanyPayload } from "@/lib/yc";

export type MatchAnalysis = {
  id: number;
  verdict: "direct competitor" | "adjacent" | "inspiration";
  common: string[];
  different: string[];
  differentiation: string;
  risk: "low" | "medium" | "high";
};

export function analyzeMatches(args: {
  ideaText: string;
  matches: Array<{ id: number; score: number; payload: CompanyPayload }>;
}): MatchAnalysis[] {
  const ideaTokens = tokenize(args.ideaText);

  return args.matches.map((match) => {
    const companyTokens = tokenize(
      [
        match.payload.name,
        match.payload.one_liner,
        match.payload.long_description,
        match.payload.industry,
        match.payload.subindustry,
        match.payload.tags.join(" "),
      ].join(" "),
    );

    const overlap = intersection(ideaTokens, companyTokens);
    const overlapLabel = pickOverlapLabel(overlap, match.payload);
    const verdict = overlap.length >= 5 ? "direct competitor" : overlap.length >= 3 ? "adjacent" : "inspiration";
    const risk = verdict === "direct competitor" ? "high" : verdict === "adjacent" ? "medium" : "low";

    return {
      id: match.id,
      verdict,
      risk,
      common: buildCommon(match.payload, overlapLabel),
      different: buildDifferent(match.payload, overlapLabel),
      differentiation: buildDifferentiation(match.payload, verdict),
    };
  });
}

function buildCommon(payload: CompanyPayload, overlapLabel: string) {
  const items = [
    overlapLabel ? `Shared theme: ${overlapLabel}` : null,
    payload.industry ? `Same broader category: ${payload.industry}` : null,
    payload.stage !== "Unknown" ? `Comparable stage: ${payload.stage}` : null,
  ].filter((item): item is string => Boolean(item));

  return items.slice(0, 3);
}

function buildDifferent(payload: CompanyPayload, overlapLabel: string) {
  const items = [
    payload.tags[0] ? `Their core angle is ${payload.tags[0]}` : null,
    payload.subindustry && payload.subindustry !== payload.industry
      ? `Narrower focus: ${payload.subindustry}`
      : null,
    overlapLabel ? `Your idea is more about ${overlapLabel}` : null,
  ].filter((item): item is string => Boolean(item));

  return items.slice(0, 3);
}

function buildDifferentiation(payload: CompanyPayload, verdict: MatchAnalysis["verdict"]) {
  if (verdict === "direct competitor") {
    return `You need a sharper wedge than ${payload.name}. They already own this lane.`;
  }

  if (verdict === "adjacent") {
    return `Differentiate by choosing a narrower user, workflow, or distribution angle than ${payload.name}.`;
  }

  return `Use ${payload.name} as inspiration, then focus on a more specific problem or customer segment.`;
}

function pickOverlapLabel(overlap: string[], payload: CompanyPayload) {
  const candidates = [
    ...overlap,
    ...payload.tags,
    payload.subindustry,
    payload.industry,
  ]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 3);

  if (!candidates.length) {
    return "";
  }

  const ranking = [
    "payment",
    "payments",
    "security",
    "collaboration",
    "productivity",
    "workflow",
    "automation",
    "platform",
    "marketplace",
    "developer",
    "analytics",
    "search",
    "design",
    "infrastructure",
  ];

  const ranked = ranking.find((term) => candidates.includes(term));
  if (ranked) {
    return ranked;
  }

  return candidates[0];
}

function tokenize(value: string) {
  const stopwords = new Set([
    "about",
    "after",
    "also",
    "and",
    "another",
    "around",
    "backed",
    "best",
    "both",
    "build",
    "building",
    "business",
    "customer",
    "customers",
    "direct",
    "from",
    "have",
    "help",
    "idea",
    "into",
    "make",
    "more",
    "note",
    "other",
    "over",
    "product",
    "products",
    "service",
    "services",
    "small",
    "solution",
    "solutions",
    "startup",
    "startups",
    "support",
    "team",
    "teams",
    "that",
    "their",
    "this",
    "through",
    "with",
    "work",
    "workspace",
    "your",
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function intersection(first: string[], second: string[]) {
  const set = new Set(second);
  return Array.from(new Set(first.filter((token) => set.has(token))));
}
