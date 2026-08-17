import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export interface RawNominationItem {
  id: string;
  nomineeText: string;
  categoryId: string;
  categoryName?: string;
}

export interface MergeSuggestion {
  categoryId: string;
  categoryName: string;
  sourceNominees: string[];
  suggestedName: string;
  confidence: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  matchReason: string;
}

export interface CleanupResult {
  cleanedItems: Array<{
    original: string;
    normalized: string;
    categoryId: string;
  }>;
  mergeSuggestions: MergeSuggestion[];
  blankRemovedCount: number;
  normalizedCount: number;
}

export function batchCleanupItems<T>(items: T[], batchSize = 500): T[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1)
    throw new Error("Cleanup batch size must be a positive integer.");
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize)
    batches.push(items.slice(offset, offset + batchSize));
  return batches;
}

/**
 * Normalizes name capitalization (Title Case with Mc, Mac, O' edge cases)
 */
export function normalizeCapitalization(name: string): string {
  if (!name) return "";
  const clean = name.trim().replace(/\s+/g, " ");

  return clean
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      const lower = word.toLowerCase();

      // Handle Mc / Mac / O' prefixes
      if (lower.startsWith("mc") && lower.length > 2) {
        return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
      }
      if (lower.startsWith("mac") && lower.length > 3) {
        return "Mac" + lower.charAt(3).toUpperCase() + lower.slice(4);
      }
      if (lower.startsWith("o'") && lower.length > 2) {
        return "O'" + lower.charAt(2).toUpperCase() + lower.slice(3);
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Calculates Levenshtein similarity score between 0 and 100
 */
export function calculateLevenshteinSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();

  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const maxLength = Math.max(a.length, b.length);
  const distance = matrix[b.length][a.length];
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Runs the complete AI Nomination Cleanup Pipeline
 */
export async function runAINominationCleanup(
  nominations: RawNominationItem[],
): Promise<CleanupResult> {
  // Step 1: Remove blank & junk entries
  const valid = nominations.filter((item) => {
    const text = item.nomineeText?.trim() || "";
    return text.length >= 2 && !/^[^a-zA-Z0-9]+$/.test(text);
  });
  const blankRemovedCount = nominations.length - valid.length;

  // Step 2: Normalize capitalization
  const cleanedItems = valid.map((item) => ({
    original: item.nomineeText,
    normalized: normalizeCapitalization(item.nomineeText),
    categoryId: item.categoryId,
  }));

  // Step 3: Deduplication
  const mergeSuggestions: MergeSuggestion[] = [];
  const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Group by category to process deduplication per-category
  const itemsByCategory: Record<
    string,
    { categoryName: string; list: typeof valid }
  > = {};
  for (const item of valid) {
    if (!itemsByCategory[item.categoryId]) {
      itemsByCategory[item.categoryId] = {
        categoryName: item.categoryName || "Award Category",
        list: [],
      };
    }
    itemsByCategory[item.categoryId].list.push(item);
  }

  for (const categoryId of Object.keys(itemsByCategory)) {
    const { categoryName, list } = itemsByCategory[categoryId];
    const rawNamesByNormalized = new Map<string, Set<string>>();
    for (const item of list) {
      const normalized = normalizeCapitalization(item.nomineeText);
      const rawNames =
        rawNamesByNormalized.get(normalized) ?? new Set<string>();
      rawNames.add(item.nomineeText);
      rawNamesByNormalized.set(normalized, rawNames);
    }
    const uniqueNames = [...rawNamesByNormalized.keys()];

    if (uniqueNames.length < 2) continue;

    const categorySuggestions: MergeSuggestion[] = [];

    if (hasGeminiKey) {
      try {
        const prompt = `You are an AI assistant designed to clean up and deduplicate nomination entries for an award ceremony.
Category: "${categoryName}"

Here is the list of unique nominee names submitted by the public:
${JSON.stringify(uniqueNames)}

Your task is to identify names that refer to the exact same nominee (e.g. spelling errors, typos, abbreviations, prefixes/suffixes like "Dr." or "Mr.", common nicknames, or inverted name order).
For each pair or group of duplicates you identify, recommend a merge.

Return a JSON array of objects, each representing a merge suggestion:
[
  {
    "suggestedName": "The correct, standardized name to use (e.g. 'Jane Doe')",
    "sourceNominees": ["Dr. Jane Doe", "Jane Doe", "J. Doe"],
    "confidence": 95,
    "confidenceTier": "HIGH",
    "matchReason": "Fuzzy match: Dr. Jane Doe and Jane Doe"
  }
]

Note: "confidenceTier" must be one of: "HIGH", "MEDIUM", "LOW".
Only return merges you are confident in. If there are no duplicates, return an empty array []. Output ONLY valid JSON, do not wrap in markdown code blocks.`;

        const { text } = await generateText({
          model: google("gemini-1.5-flash"),
          prompt,
        });

        // Strip markdown code blocks if present
        let cleanText = text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText
            .replace(/^```json\s*/, "")
            .replace(/```$/, "")
            .trim();
        }

        const data = JSON.parse(cleanText);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (
              item.suggestedName &&
              Array.isArray(item.sourceNominees) &&
              item.sourceNominees.length >= 2
            ) {
              const proposedSources = item.sourceNominees as string[];
              const rawSources: string[] = [
                ...new Set(
                  proposedSources.flatMap((name) => [
                    ...(rawNamesByNormalized.get(
                      normalizeCapitalization(name),
                    ) ?? [name]),
                  ]),
                ),
              ];
              categorySuggestions.push({
                categoryId,
                categoryName,
                sourceNominees: rawSources,
                suggestedName: item.suggestedName,
                confidence: item.confidence || 80,
                confidenceTier: item.confidenceTier || "MEDIUM",
                matchReason:
                  item.matchReason || "Semantic match resolved by AI",
              });
            }
          }
        }
      } catch (err) {
        console.error(
          "Gemini cleanup failed, falling back to Levenshtein:",
          err,
        );
      }
    }

    // Fallback or backup: Levenshtein distance check if Gemini didn't produce suggestions
    if (categorySuggestions.length === 0) {
      for (let i = 0; i < uniqueNames.length; i++) {
        for (let j = i + 1; j < uniqueNames.length; j++) {
          const nameA = uniqueNames[i];
          const nameB = uniqueNames[j];
          const score = calculateLevenshteinSimilarity(nameA, nameB);

          if (score >= 60) {
            const tier = score >= 85 ? "HIGH" : "MEDIUM";
            categorySuggestions.push({
              categoryId,
              categoryName,
              sourceNominees: [
                ...new Set([
                  ...(rawNamesByNormalized.get(nameA) ?? [nameA]),
                  ...(rawNamesByNormalized.get(nameB) ?? [nameB]),
                ]),
              ],
              suggestedName: nameA, // default to first one
              confidence: score,
              confidenceTier: tier,
              matchReason: `Fuzzy edit distance match (${score}%)`,
            });
          }
        }
      }
    }

    mergeSuggestions.push(...categorySuggestions);
  }

  return {
    cleanedItems,
    mergeSuggestions,
    blankRemovedCount,
    normalizedCount: cleanedItems.length,
  };
}
