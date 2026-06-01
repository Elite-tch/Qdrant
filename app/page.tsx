"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  LoaderCircle,
  Radar,
  Search,
  SlidersHorizontal,
} from "lucide-react";

type Facets = {
  industries: string[];
  statuses: string[];
  stages: string[];
  totalCompanies: number;
};

type SourceSummary = {
  url: string;
  host: string;
  quality: "clear" | "thin" | "missing";
  summary: string;
};

type Analysis = {
  verdict: "direct competitor" | "adjacent" | "inspiration";
  common: string[];
  different: string[];
  differentiation: string;
  risk: "low" | "medium" | "high";
};

type SearchResult = {
  id: number;
  score: number;
  payload: {
    name: string;
    logo_url: string | null;
    website: string | null;
    yc_url: string | null;
    one_liner: string;
    long_description: string;
    industry: string;
    subindustry: string;
    batch: string;
    status: string;
    stage: string;
    team_size: number | null;
    tags: string[];
    regions: string[];
  };
  analysis?: Analysis;
};

const exampleIdea = `A workspace for small B2B SaaS teams that turns customer calls, support tickets, and product feedback into a living opportunity map. Product managers can see repeated pain points, competitor mentions, deal blockers, and feature requests, then connect them to roadmap bets.`;

const modes = [
  { value: "validate", label: "Validate idea" },
  { value: "competitors", label: "Competitors" },
  { value: "alternatives", label: "Alternatives" },
  { value: "inspiration", label: "Inspiration" },
] as const;

export default function Home() {
  const [ideaText, setIdeaText] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]["value"]>("competitors");
  const [sourceType, setSourceType] = useState<"live" | "upload" | "">("");
  const [projectUrls, setProjectUrls] = useState<string[]>([""]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [sourceSummaries, setSourceSummaries] = useState<SourceSummary[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    fetch("/api/facets")
      .then((response) => response.json())
      .then(setFacets)
      .catch(() => setError("Could not load filters from Qdrant."));
  }, []);

  const hasSourceUrl = useMemo(() => {
    const activeUrls = sourceType === "live" ? projectUrls : [];
    return activeUrls.some((value) => value.trim().length > 0);
  }, [projectUrls, sourceType]);

  const canSearch = useMemo(() => {
    const hasIdeaText = ideaText.trim().length >= 50;
    return !isSearching && (hasIdeaText || hasSourceUrl);
  }, [ideaText, hasSourceUrl, isSearching]);

  const laneCounts = useMemo(() => {
    const counts = {
      direct: 0,
      adjacent: 0,
      inspiration: 0,
    };

    for (const result of results) {
      if (result.analysis?.verdict === "direct competitor") {
        counts.direct += 1;
      } else if (result.analysis?.verdict === "adjacent") {
        counts.adjacent += 1;
      } else {
        counts.inspiration += 1;
      }
    }

    return counts;
  }, [results]);

  const saturation = useMemo(() => {
    if (!results.length) {
      return { label: "Open", value: 0, tone: "low" as const };
    }

    const topScores = results.slice(0, 5).map((result) => result.score);
    const averageScore = topScores.reduce((total, score) => total + score, 0) / topScores.length;
    const directCount = results.filter((result) => result.analysis?.verdict === "direct competitor").length;
    const density = Math.min(1, averageScore * 0.7 + (directCount / Math.max(results.length, 1)) * 0.5);

    if (density >= 0.72) {
      return { label: "Crowded", value: density, tone: "high" as const };
    }

    if (density >= 0.45) {
      return { label: "Mixed", value: density, tone: "medium" as const };
    }

    return { label: "Open", value: density, tone: "low" as const };
  }, [results]);

  const landscapePoints = useMemo(() => {
    return results.slice(0, 8).map((result, index) => {
      const score = clamp(result.score, 0, 1);
      const directBoost = result.analysis?.verdict === "direct competitor" ? 16 : result.analysis?.verdict === "adjacent" ? 10 : 4;
      const x = 10 + ((hashString(result.payload.name) % 72) / 72) * 80;
      const y = 14 + (1 - score) * 56 + directBoost + index * 0.8;
      return {
        id: result.id,
        name: result.payload.name,
        x,
        y: clamp(y, 10, 88),
        score,
        risk: result.analysis?.risk ?? "low",
        lane: result.analysis?.verdict ?? "inspiration",
      };
    });
  }, [results]);

  const topComparison = useMemo(() => results.slice(0, 2), [results]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setError("");
    setResults([]);
    setSourceSummaries([]);

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaText,
        projectUrls: sourceType === "live" ? projectUrls : [],
        mode,
        limit: 8,
      }),
    });

    const data = await response.json();
    setIsSearching(false);

    if (!response.ok) {
      setError(data.error ?? "Search failed.");
      return;
    }

    setSourceSummaries(data.sources ?? []);
    setResults(data.results ?? []);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSourceType("upload");
    setProjectUrls([""]);
    setIsExtracting(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setIsExtracting(false);
    event.target.value = "";

    if (!response.ok) {
      setError(data.error ?? "Could not extract text from this file.");
      return;
    }

    setIdeaText(data.text);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-stone-950">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Radar size={21} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal sm:text-xl">IdeaRadar</h1>
              <p className="text-sm text-stone-500">
                {facets ? `${facets.totalCompanies.toLocaleString()} startups indexed` : "Corpus loading"}
              </p>
            </div>
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 sm:w-auto"
            type="button"
            onClick={() => setIdeaText(exampleIdea)}
          >
            <FileText size={16} />
            Example
          </button>
        </div>
      </section>

      <form
        className="mx-auto grid max-w-7xl gap-5 px-4 py-4 sm:px-5 sm:py-6 lg:grid-cols-[430px_1fr]"
        onSubmit={handleSearch}
      >
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Source mode</div>
                <p className="text-xs leading-5 text-stone-500">
                  Choose one way to search. The other inputs go quiet so it feels like one clean path at a time.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { value: "", label: "Text" },
                  { value: "upload", label: "Doc upload" },
                  { value: "live", label: "Live project URLs" },
                ].map((option) => (
                  <button
                    key={option.value || "text"}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${sourceType === option.value
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-stone-300 bg-white hover:bg-stone-50"
                      }`}
                    type="button"
                    onClick={() => {
                      setSourceType(option.value as typeof sourceType);
                      if (option.value === "") {
                        setProjectUrls([""]);
                        return;
                      }

                      setIdeaText("");
                      if (option.value === "upload") {
                        setProjectUrls([""]);
                        return;
                      }

                      if (option.value === "live") {
                        setProjectUrls([""]);
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {sourceType === "live" ? (
                <UrlFieldGroup
                  addLabel="Add link"
                  helper="We pull the page title, description, and visible text summary."
                  label="Live project URL"
                  placeholder="Paste a live demo or product URL..."
                  values={projectUrls}
                  onChange={setProjectUrls}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold" htmlFor="idea">
              Idea document
            </label>
            <div className="relative">
              <textarea
                id="idea"
                className={`min-h-46 w-full resize-y rounded-md border p-3 text-sm leading-6 outline-none no-scrollbar ${sourceType === ""
                  ? "border-stone-300 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  : sourceType === "upload"
                    ? "border-stone-300 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    : "border-stone-200 bg-stone-100 text-stone-400"
                  }`}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
                value={ideaText}
                onChange={(event) => setIdeaText(event.target.value)}
                placeholder="Paste a PRD, pitch, README, product spec, or customer problem note..."
                disabled={sourceType === "live"}
              />
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${sourceType === "upload"
                  ? "cursor-pointer border-stone-300 bg-white hover:bg-stone-50"
                  : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                  }`}
              >
                <FileText size={16} />
                {isExtracting ? "Extracting..." : "Upload file"}
                <input
                  className="hidden"
                  type="file"
                  accept=".docx,.txt,.md,.markdown,.json,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json,text/csv"
                  onChange={handleFile}
                  disabled={isExtracting || sourceType !== "upload"}
                />
              </label>
              <span className="text-xs text-stone-500">{ideaText.length}/12000</span>
            </div>
            <p className="text-xs leading-5 text-stone-500">
              Supported files: DOCX, TXT, MD, Markdown, JSON, CSV.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={16} />
              Search controls
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {modes.map((item) => (
                <button
                  key={item.value}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${mode === item.value
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-stone-300 bg-white hover:bg-stone-50"
                    }`}
                  type="button"
                  onClick={() => setMode(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            type="submit"
            disabled={!canSearch}
          >
            {isSearching ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}
            Find Similar Companies
          </button>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </aside>

        <section className="min-h-[520px] lg:min-h-[620px]">

          {results.length === 0 && !isSearching ? (
            <div className="flex h-full min-h-[520px] items-center justify-center border border-dashed border-stone-300 bg-white px-5 text-center sm:px-6 lg:min-h-[620px]">
              <div className="max-w-md space-y-3">
                <Radar className="mx-auto text-emerald-700" size={34} />
                <h2 className="text-xl font-semibold sm:text-2xl">Competitive landscape</h2>
                <p className="text-sm leading-6 text-stone-600">
                  Paste an idea or load the example to explore the competitive landscape through Qdrant.
                </p>
              </div>
            </div>
          ) : null}

          {isSearching ? (
            <div className="flex h-full min-h-[520px] items-center justify-center bg-white lg:min-h-[620px]">
              <div className="flex items-center gap-3 text-sm font-medium text-stone-600">
                <LoaderCircle className="animate-spin text-emerald-700" size={22} />
                Searching Qdrant and comparing matches
              </div>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="space-y-4 overflow-hidden">


              <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="text-sm font-semibold">Competitor comparison</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  The top two matches side by side, so you can quickly see who is closest and where your wedge is.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {topComparison.map((result, index) => (
                    <div key={result.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 sm:p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-700">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{result.payload.name}</div>
                          <div className="text-xs text-stone-500">{(result.score * 100).toFixed(1)}% match</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-700">{result.payload.one_liner}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-stone-600">
                        <span className="rounded-full border border-stone-200 bg-white px-2 py-1">
                          {result.analysis?.verdict ?? "inspiration"}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-2 py-1">
                          {result.analysis?.risk ?? "low"} risk
                        </span>
                      </div>
                      {result.analysis ? (
                        <p className="mt-3 text-xs leading-5 text-stone-600">
                          {result.analysis.differentiation}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              {results.map((result, index) => (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
                  key={result.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      {result.payload.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="size-12 rounded-md border border-stone-200 object-cover"
                          src={result.payload.logo_url}
                        />
                      ) : (
                        <div className="size-12 rounded-md bg-stone-100" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{index + 1}. {result.payload.name}</h2>
                          <span className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                            {(result.score * 100).toFixed(1)}%
                          </span>
                          {result.analysis ? (
                            <span
                              className={`rounded-sm px-2 py-1 text-xs font-medium ${result.analysis.verdict === "direct competitor"
                                ? "bg-red-50 text-red-700"
                                : result.analysis.verdict === "adjacent"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                                }`}
                            >
                              {result.analysis.verdict}
                            </span>
                          ) : null}
                          {result.analysis ? (
                            <span className="rounded-sm bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                              {result.analysis.risk} risk
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-medium text-stone-700">{result.payload.one_liner}</p>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                          {result.payload.long_description}
                        </p>
                      </div>
                    </div>
                    <a
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
                      href={result.payload.website ?? result.payload.yc_url ?? "#"}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open
                      <ArrowUpRight size={15} />
                    </a>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
                    {[result.payload.industry, result.payload.stage, result.payload.status, result.payload.batch]
                      .filter(Boolean)
                      .map((item) => (
                        <span className="rounded-sm border border-stone-200 px-2 py-1" key={item}>
                          {item}
                        </span>
                      ))}
                    {result.payload.tags.slice(0, 5).map((tag) => (
                      <span className="rounded-sm border border-stone-200 px-2 py-1" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {result.analysis ? (
                    <div className="mt-5 grid gap-4 border-t border-stone-200 pt-4 md:grid-cols-3">
                      <InsightList title="Why it overlaps" items={result.analysis.common} />
                      <InsightList title="What differs" items={result.analysis.different} />
                      <div>
                        <h3 className="text-sm font-semibold">Your wedge</h3>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {result.analysis.differentiation}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </form>
    </main>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2 text-sm leading-6 text-stone-600">
        {items.map((item) => (
          <li key={item} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrlFieldGroup({
  addLabel,
  helper,
  label,
  placeholder,
  values,
  onChange,
}: {
  addLabel: string;
  helper: string;
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div className="space-y-2" key={`${label}-${index}`}>
          <label className="text-sm font-semibold">{label}</label>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              type="url"
              value={value}
              onChange={(event) =>
                onChange(values.map((current, currentIndex) => (currentIndex === index ? event.target.value : current)))
              }
              placeholder={placeholder}
            />
            {index === values.length - 1 && values.length < 3 ? (
              <button
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
                type="button"
                onClick={() => onChange([...values, ""])}
                aria-label={`Add another ${label.toLowerCase()}`}
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <p className="text-xs leading-5 text-stone-500">{helper}</p>
      {values.length >= 3 ? (
        <p className="text-xs leading-5 text-stone-400">Maximum of 3 links for this source type.</p>
      ) : null}
      {values.some((value) => value.trim()) ? null : (
        <p className="text-xs leading-5 text-stone-400">Start with the first link, then use + if you want another one.</p>
      )}
      <p className="text-xs font-medium text-emerald-700">{addLabel}</p>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
