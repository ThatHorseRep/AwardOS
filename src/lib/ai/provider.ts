import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export type AIProvider = "google" | "openai" | "anthropic";

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
}

export function getAIModel(config?: Partial<AIProviderConfig>) {
  const provider = config?.provider || (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider) || "google";

  switch (provider) {
    case "openai": {
      const modelName = config?.model || "gpt-4o-mini";
      return openai(modelName);
    }
    case "anthropic": {
      const modelName = config?.model || "claude-3-5-haiku-20241022";
      return anthropic(modelName);
    }
    case "google":
    default: {
      const modelName = config?.model || "gemini-2.5-flash";
      return google(modelName);
    }
  }
}

export function getAvailableProviders(): Array<{ id: AIProvider; name: string; configured: boolean; defaultModel: string }> {
  return [
    {
      id: "google",
      name: "Google Gemini",
      configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      defaultModel: "gemini-2.5-flash",
    },
    {
      id: "openai",
      name: "OpenAI GPT",
      configured: Boolean(process.env.OPENAI_API_KEY),
      defaultModel: "gpt-4o-mini",
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      defaultModel: "claude-3-5-haiku-20241022",
    },
  ];
}
