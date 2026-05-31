import { z } from "zod";
import { COLLECTION_NAME } from "@/lib/config";
import { analyzeMatches } from "@/lib/analysis";
import { getQdrantClient } from "@/lib/qdrant-runtime.js";
import { resolveIdeaSources } from "@/lib/idea-sources.js";

export const runtime = "nodejs";

const SearchSchema = z.object({
  ideaText: z.string().max(12000).default(""),
  projectUrls: z.array(z.string().url()).max(3).default([]),
  githubUrls: z.array(z.string().url()).max(3).default([]),
  targetUser: z.string().max(500).optional(),
  problem: z.string().max(1000).optional(),
  solution: z.string().max(1000).optional(),
  mode: z.enum(["competitors", "alternatives"]).default("competitors"),
  industry: z.string().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  limit: z.number().int().min(3).max(12).default(8),
});

const INFERENCE_MODEL =
  process.env.QDRANT_INFERENCE_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";
function buildFilter(input: z.infer<typeof SearchSchema>) {
  const must = [
    input.industry && input.industry !== "All"
      ? { key: "industry", match: { value: input.industry } }
      : null,
    input.status && input.status !== "All"
      ? { key: "status", match: { value: input.status } }
      : null,
    input.stage && input.stage !== "All"
      ? { key: "stage", match: { value: input.stage } }
      : null,
  ].filter(Boolean);

  return must.length ? { must } : undefined;
}

export async function POST(request: Request) {
  const parsed = SearchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid search input.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const hasProjectUrls = parsed.data.projectUrls.length > 0;
    const hasGithubUrls = parsed.data.githubUrls.length > 0;

    if (hasProjectUrls && hasGithubUrls) {
      return Response.json(
        { error: "Choose either GitHub URLs or live project URLs, not both." },
        { status: 400 },
      );
    }

    const ideaText = await resolveIdeaSources(parsed.data);
    if (ideaText.trim().length < 50) {
      return Response.json(
        { error: "Please add at least 50 characters of idea text, or a GitHub/live URL source." },
        { status: 400 },
      );
    }

    const qdrant = getQdrantClient();
    const modeWeights =
      parsed.data.mode === "competitors"
        ? hasProjectUrls || hasGithubUrls
          ? [0.5, 0.5]
          : [0.7, 0.3]
        : hasProjectUrls || hasGithubUrls
          ? [0.45, 0.55]
          : [0.6, 0.4];
    const denseQuery = {
      text: ideaText,
      model: INFERENCE_MODEL,
    } as const;
    const sparseQuery = {
      text: ideaText,
      model: "qdrant/bm25",
    } as const;
    const fusionQuery = {
      fusion: "rrf",
      rrf: {
        weights: modeWeights,
      },
    } as const;
    const prefetch = [
      {
        using: "dense",
        query: denseQuery,
        limit: 24,
        filter: buildFilter(parsed.data),
      },
      {
        using: "keywords",
        query: sparseQuery,
        limit: 24,
        filter: buildFilter(parsed.data),
      },
    ];

    const results = await qdrant.query(COLLECTION_NAME, {
      prefetch,
      query: fusionQuery,
      limit: parsed.data.limit,
      with_payload: true,
      filter: buildFilter(parsed.data),
    });

    const analyses = await analyzeMatches({
      ideaText,
      matches: results.points.map((result: { id: string | number; score: number; payload?: unknown }) => ({
        id: Number(result.id),
        score: result.score,
        payload: result.payload,
      })),
    });

    return Response.json({
      query: {
        mode: parsed.data.mode,
        filters: {
          industry: parsed.data.industry ?? "All",
          status: parsed.data.status ?? "All",
          stage: parsed.data.stage ?? "All",
        },
      },
      results: results.points.map((result: { id: string | number; score: number; payload?: unknown }) => ({
        id: Number(result.id),
        score: result.score,
        payload: result.payload,
        analysis: analyses.find((analysis) => analysis.id === Number(result.id)),
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Search failed. Check your environment variables and Qdrant.",
      },
      { status: 500 },
    );
  }
}
