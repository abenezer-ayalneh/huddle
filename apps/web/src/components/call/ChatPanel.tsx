"use client";

import type { ReceivedChatMessage } from "@livekit/components-react";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Custom in-call chat (replaces the chat panel that shipped inside LiveKit's
// <VideoConference>). Messages ride the room data channel; history is in-memory
// for the session, same as the prebuilt behaviour. Docked to the left so it
// never collides with the host sidebar on the right. Controlled: the useChat
// subscription lives once in CallView, which feeds messages/send in as props.
export default function ChatPanel({
  open,
  onClose,
  messages,
  onSend,
  isSending,
}: {
  open: boolean;
  onClose: () => void;
  messages: ReceivedChatMessage[];
  onSend: (text: string) => Promise<unknown>;
  isSending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as they arrive / on open.
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    try {
      await onSend(text);
    } catch {
      // Restore the draft so a failed send isn't silently lost.
      setDraft(text);
    }
  };

  return (
    <aside className="glass-strong absolute inset-y-0 left-0 z-30 flex w-80 max-w-[85vw] flex-col border-r border-white/10 shadow-[8px_0_50px_oklch(0_0_0/0.5)] animate-in slide-in-from-left duration-200">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <span className="font-display text-base font-semibold tracking-wide text-white">
          Chat
        </span>
        <button
          type="button"
          aria-label="Hide chat"
          title="Hide chat"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/15 hover:text-white [&>svg]:h-4 [&>svg]:w-4"
        >
          <X />
        </button>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm"
      >
        {messages.length === 0 ? (
          <p className="text-white/45">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.from?.isLocal ?? false;
            const who = m.from?.name || m.from?.identity || "Guest";
            return (
              <div
                key={`${m.timestamp}-${m.from?.identity ?? ""}`}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="mb-0.5 px-1 text-[11px] text-white/45">
                  {mine ? "You" : who} ·{" "}
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`max-w-[85%] break-words rounded-2xl px-3 py-2 ${
                    mine
                      ? "rounded-br-sm bg-magenta/20 text-white ring-1 ring-magenta/40"
                      : "rounded-bl-sm bg-white/8 text-white/90 ring-1 ring-white/10"
                  }`}
                >
                  {m.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none transition-colors placeholder:text-white/40 focus:border-cyan/60 focus:ring-2 focus:ring-cyan/30"
        />
        <button
          type="submit"
          aria-label="Send message"
          title="Send message"
          disabled={!draft.trim() || isSending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-magenta text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:h-4 [&>svg]:w-4"
        >
          <Send />
        </button>
      </form>
    </aside>
  );
}
