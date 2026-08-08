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
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith('0:"')) {
            try {
              const textPart = JSON.parse(line.slice(2));
              accumulatedContent += textPart;
            } catch {
              accumulatedContent += line.slice(2).replace(/^"/, "").replace(/"$/, "");
            }
          } else if (!line.startsWith("d:") && !line.startsWith("e:") && line.trim()) {
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
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `🏆 **AwardOS Assistant Notice**:\nI'm ready to assist with your event! (To enable live generative responses, ensure GOOGLE_GENERATIVE_AI_API_KEY is configured in your environment settings).`,
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
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white/95 backdrop-blur-2xl border-l border-slate-200 shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200 font-sans select-none">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              AwardOS AI Co-Pilot
            </h3>
            <span className="text-[10px] text-purple-600 font-bold">Multi-Provider AI Stream</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto bg-slate-50">
        {quickPrompts.map((qp, idx) => {
          const QIcon = qp.icon;
          return (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSend(qp.prompt)}
              className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-purple-300 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm disabled:opacity-50"
            >
              <QIcon className="w-3 h-3 text-purple-600" />
              <span>{qp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chat History */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col space-y-1.5 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`p-3.5 rounded-3xl text-xs leading-relaxed max-w-[88%] relative group font-medium ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/10 font-bold"
                  : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-none shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content || (isLoading && idx === messages.length - 1 ? "..." : "")}</p>

              {msg.role === "assistant" && msg.content && (
                <button
                  onClick={() => handleCopy(msg.content, idx)}
                  className="mt-2 text-[10px] text-slate-400 hover:text-slate-900 flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity font-bold"
                >
                  {copiedIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" /> Copied
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
          <div className="flex items-center gap-2 text-xs text-purple-700 p-3 rounded-2xl bg-purple-50 border border-purple-200 max-w-[80%] font-bold">
            <Sparkles className="w-4 h-4 animate-spin text-purple-600" />
            <span>Thinking & generating response...</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 text-xs text-amber-800 p-3 rounded-2xl bg-amber-50 border border-amber-200 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-100 bg-white">
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
            className="flex-1 bg-slate-50 text-slate-900 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-purple-500 disabled:opacity-50 font-medium"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-2.5"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
