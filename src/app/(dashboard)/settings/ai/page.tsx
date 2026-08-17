import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const providers = [
  { id: "google", name: "Google Gemini", env: "GOOGLE_GENERATIVE_AI_API_KEY", configured: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY) },
  { id: "openai", name: "OpenAI", env: "OPENAI_API_KEY", configured: Boolean(process.env.OPENAI_API_KEY) },
  { id: "anthropic", name: "Anthropic", env: "ANTHROPIC_API_KEY", configured: Boolean(process.env.ANTHROPIC_API_KEY) },
];

export default function AISettingsPage() {
  const configuredDefault = process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || "google";
  return <main className="mx-auto max-w-3xl space-y-6 pb-16 text-content"><header><h1 className="text-2xl font-bold">AI provider status</h1><p className="mt-1 text-sm text-content-secondary">Provider credentials are deployment secrets and are never accepted or displayed in the browser.</p></header><Card><CardHeader><CardTitle>Server configuration</CardTitle></CardHeader><CardContent className="space-y-3">{providers.map((provider) => <div key={provider.id} className="flex items-center justify-between rounded-lg border border-border-subtle p-4"><span><span className="block text-sm font-semibold">{provider.name}</span><code className="text-xs text-content-secondary">{provider.env}</code></span><span className={`flex items-center gap-2 text-xs font-semibold ${provider.configured ? "text-success" : "text-warning"}`}>{provider.configured ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleAlert className="size-4" aria-hidden="true" />}{provider.configured ? "Configured" : "Not configured"}</span></div>)}</CardContent></Card><p className="text-sm text-content-secondary">Default provider: <strong className="text-content">{configuredDefault}</strong>. Change deployment secrets in Vercel or the local environment, then redeploy.</p></main>;
}
