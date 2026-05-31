import type { ToolMetadata } from "./tool-metadata.js";

export const DEFAULT_TOOL_RETRIEVAL_TOP_K = 5;

const TOKEN_WEIGHT = {
  exactName: 20,
  name: 8,
  keyword: 6,
  description: 3,
  phrase: 2
} as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "is",
  "it",
  "of",
  "the",
  "to",
  "what"
]);

type ScoredTool = {
  index: number;
  score: number;
  tool: ToolMetadata;
};

export function retrieveTools(
  goal: string,
  registry: readonly ToolMetadata[],
  topK = DEFAULT_TOOL_RETRIEVAL_TOP_K
): readonly ToolMetadata[] {
  const limit = Math.max(0, Math.floor(topK));

  if (limit === 0 || registry.length === 0) {
    return [];
  }

  const goalTokens = tokenize(goal);
  const goalTokenSet = new Set(goalTokens);
  const normalizedGoal = normalize(goal);

  return registry
    .map((tool, index): ScoredTool => {
      return {
        index,
        score: scoreTool(tool, goalTokenSet, normalizedGoal),
        tool
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const nameComparison = left.tool.name.localeCompare(right.tool.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map((result) => result.tool);
}

function scoreTool(tool: ToolMetadata, goalTokens: ReadonlySet<string>, normalizedGoal: string): number {
  const normalizedName = normalize(tool.name);
  const nameTokens = tokenize(tool.name);
  const descriptionTokens = tokenize(tool.description);
  const keywordTokens = tool.keywords.flatMap((keyword) => tokenize(keyword));

  let score = normalizedGoal === normalizedName ? TOKEN_WEIGHT.exactName : 0;

  score += scoreTokenOverlap(goalTokens, nameTokens, TOKEN_WEIGHT.name);
  score += scoreTokenOverlap(goalTokens, keywordTokens, TOKEN_WEIGHT.keyword);
  score += scoreTokenOverlap(goalTokens, descriptionTokens, TOKEN_WEIGHT.description);

  if (normalizedName.length > 0 && ` ${normalizedGoal} `.includes(` ${normalizedName} `)) {
    score += TOKEN_WEIGHT.phrase;
  }

  return score;
}

function scoreTokenOverlap(
  goalTokens: ReadonlySet<string>,
  candidateTokens: readonly string[],
  weight: number
): number {
  let score = 0;
  const seenTokens = new Set<string>();

  for (const token of candidateTokens) {
    if (!seenTokens.has(token) && goalTokens.has(token)) {
      score += weight;
      seenTokens.add(token);
    }
  }

  return score;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
