"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateMessageId(),
      role: "assistant",
      content: "こんにちは！ご用件を入力してください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: text,
    };

    setInput("");
    setIsSending(true);
    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      // 期待するレスポンス: { reply: string } or { message: { role, content } }
      const data = await response.json().catch(() => ({}));
      const replyText: string | undefined = data?.reply ?? data?.message?.content ?? data?.choices?.[0]?.message?.content;
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: replyText || "（応答形式を解釈できませんでした）",
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "エラーが発生しました";
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `エラー: ${message}`,
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Chat Demo</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">REST API バックエンドと連携するモダンなチャットUI</p>
        </header>

        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 backdrop-blur shadow-sm">
          <div ref={scrollRef} className="h-[60dvh] sm:h-[65dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="flex">
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 text-white px-4 py-2 shadow"
                      : "mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 px-4 py-2 shadow"
                  }
                >
                  <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 dark:border-white/10 p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力（Enterで送信、Shift+Enterで改行）"
                className="flex-1 resize-none rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-[15px] leading-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-h-40 min-h-10"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={isSending}
              >
                {isSending ? "送信中..." : "送信"}
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-3 text-center text-xs text-zinc-500">
          Enterで送信、Shift+Enterで改行。環境変数でAPIエンドポイントを設定してください。
        </footer>
      </div>
    </div>
  );
} 