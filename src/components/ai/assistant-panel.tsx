"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Copy, Check, FileText, Share2, Mic, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your AwardOS AI Co-Pilot. How can I assist with your recognition event program today?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setErrorMessage(null);

    // Placeholder for assistant stream response
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Process Vercel AI SDK Data Stream protocol or raw text
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith('0:"')) {
            // Vercel AI SDK text part format 0:"text"
            try {
              const textPart = JSON.parse(line.slice(2));
              accumulatedContent += textPart;
            } catch {
              accumulatedContent += line.slice(2).replace(/^"/, "").replace(/"$/, "");
            }
          } else if (!line.startsWith("d:") && !line.startsWith("e:") && line.trim()) {
            // Fallback for plain text chunk
            accumulatedContent += line;
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulatedContent || "..." };
          return next;
        });
      }
    } catch (err: any) {
      console.error("AI Streaming error:", err);
      setErrorMessage(err.message || "Failed to connect to AI assistant");
      // Fallback simulated response if offline or key unconfigured
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `🏆 **AwardOS Assistant Notice**:\nI'm ready to assist with your event! (To enable live generative responses, ensure GEMINI_API_KEY is configured in your environment settings).`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const quickPrompts = [
    { label: "Draft Social Post", icon: Share2, prompt: "Draft a high-engagement Social Announcement for my award event" },
    { label: "Ceremony MC Script", icon: Mic, prompt: "Write an Award Ceremony MC Script opening remarks" },
    { label: "Event Description", icon: FileText, prompt: "Generate an inspiring Event Description for nominees and voters" },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#090d16]/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              AwardOS AI Co-Pilot
            </h3>
            <span className="text-[10px] text-purple-400 font-medium">Multi-Provider AI Stream</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="p-3 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto">
        {quickPrompts.map((qp, idx) => {
          const QIcon = qp.icon;
          return (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSend(qp.prompt)}
              className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-slate-300 text-[11px] font-medium flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
            >
              <QIcon className="w-3 h-3 text-purple-400" />
              <span>{qp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chat History */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col space-y-1.5 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[88%] relative group ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content || (isLoading && idx === messages.length - 1 ? "..." : "")}</p>

              {msg.role === "assistant" && msg.content && (
                <button
                  onClick={() => handleCopy(msg.content, idx)}
                  className="mt-2 text-[10px] text-slate-400 hover:text-white flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                >
                  {copiedIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Text
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 max-w-[80%]">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Thinking & generating response...</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 text-xs text-amber-400 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask AI assistant anything..."
            className="flex-1 bg-slate-900 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
