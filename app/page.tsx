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
  { value: "competitors", label: "Competitors" },
  { value: "alternatives", label: "Alternatives" },
] as const;

export default function Home() {
  const [ideaText, setIdeaText] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]["value"]>("competitors");
  const [facets, setFacets] = useState<Facets | null>(null);
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

  const canSearch = useMemo(() => ideaText.trim().length >= 50 && !isSearching, [
    ideaText,
    isSearching,
  ]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setError("");
    setResults([]);

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaText,
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

    setResults(data.results ?? []);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Radar size={21} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">IdeaRadar</h1>
              <p className="text-sm text-stone-500">
                {facets ? `${facets.totalCompanies.toLocaleString()} startups indexed` : "Corpus loading"}
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
            type="button"
            onClick={() => setIdeaText(exampleIdea)}
          >
            <FileText size={16} />
            Example
          </button>
        </div>
      </section>

      <form
        className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[430px_1fr]"
        onSubmit={handleSearch}
      >
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3">
            <label className="text-sm font-semibold" htmlFor="idea">
              Idea document
            </label>
            <textarea
              id="idea"
              className="min-h-46 w-full resize-y rounded-md border border-stone-300 bg-white p-3 text-sm leading-6 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 no-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
              value={ideaText}
              onChange={(event) => setIdeaText(event.target.value)}
              placeholder="Paste a PRD, pitch, README, product spec, or customer problem note..."
            />
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50">
                <FileText size={16} />
                {isExtracting ? "Extracting..." : "Upload file"}
                <input
                  className="hidden"
                  type="file"
                  accept=".docx,.txt,.md,.markdown,.json,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json,text/csv"
                  onChange={handleFile}
                  disabled={isExtracting}
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
            <div className="grid grid-cols-2 gap-2">
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

        <section className="min-h-[620px]">
          {results.length === 0 && !isSearching ? (
            <div className="flex h-full min-h-[620px] items-center justify-center border border-dashed border-stone-300 bg-white px-6 text-center">
              <div className="max-w-md space-y-3">
                <Radar className="mx-auto text-emerald-700" size={34} />
                <h2 className="text-2xl font-semibold">Competitive landscape</h2>
                <p className="text-sm leading-6 text-stone-600">
                  Paste an idea or load the example to explore the competitive landscape through Qdrant.
                </p>
              </div>
            </div>
          ) : null}

          {isSearching ? (
            <div className="flex h-full min-h-[620px] items-center justify-center bg-white">
              <div className="flex items-center gap-3 text-sm font-medium text-stone-600">
                <LoaderCircle className="animate-spin text-emerald-700" size={22} />
                Searching Qdrant and comparing matches
              </div>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((result, index) => (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
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
      <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
