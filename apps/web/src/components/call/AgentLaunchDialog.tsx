'use client';

import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { API_URL } from '@/lib/api';
import type { HelperBootstrap } from './useRemoteControl';

export default function AgentLaunchDialog({
  bootstrap,
  onReopen,
  onDismiss,
}: {
  bootstrap: HelperBootstrap | null;
  onReopen: () => Promise<HelperBootstrap | null>;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [launchedSessionId, setLaunchedSessionId] = useState<string | null>(null);
  const deepLink = useMemo(() => {
    if (!bootstrap) return '';
    const query = new URLSearchParams({ room: bootstrap.room, session: bootstrap.sessionId, code: bootstrap.code, api: API_URL });
    return `huddle-control://join?${query.toString()}`;
  }, [bootstrap]);

  const launch = (link: string, sessionId: string) => {
    // Only launch after an explicit click. Auto-launching when the dialog
    // mounted could redeem this one-time code in the standard process before
    // the Sharer copied it into the agent's administrator-mode fallback. A
    // Browser focus and visibility are not reliable evidence of whether a
    // native protocol handler opened. The server-confirmed agent connection
    // remains the authoritative session transition.
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = link;
    document.body.appendChild(frame);
    setLaunchedSessionId(sessionId);
  };

  if (!bootstrap) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {}
  };

  const retry = async () => {
    setOpening(true);
    const fresh = await onReopen();
    if (fresh) {
      const query = new URLSearchParams({ room: fresh.room, session: fresh.sessionId, code: fresh.code, api: API_URL });
      launch(`huddle-control://join?${query.toString()}`, fresh.sessionId);
    }
    setOpening(false);
  };

  const hasLaunched = launchedSessionId === bootstrap?.sessionId;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="signal-call-agent-backdrop pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <div className="signal-call-agent-dialog glass-strong w-full max-w-md space-y-4 rounded-2xl p-6 text-white">
        <div>
          <h2 className="font-display text-lg font-semibold">Opening the Control Agent</h2>
          <p className="mt-1 text-sm text-white/65">
            Open the local Control Agent in standard mode, or copy the unredeemed link first if you need administrator-app mode. The link is one-time and
            expires shortly; Open Agent creates a fresh link when needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white/8 px-3 py-2 font-mono text-xs text-cyan ring-1 ring-white/10">
            One-time launch link ready
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/20"
          >
            {copied ? <Check className="h-4 w-4 text-cyan" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy for admin mode'}
          </button>
        </div>
        <p className="text-xs text-white/45">
          For administrator-app mode, paste the copied link into the agent’s Having trouble section and choose Open in administrator-app mode. The agent never
          saves it after redemption.
        </p>
        <div className="flex justify-end gap-2">
          <a
            href="/downloads?from=remote-control"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20"
          >
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Open downloads
          </a>
          <button
            type="button"
            disabled={opening}
            onClick={() => (hasLaunched ? void retry() : launch(deepLink, bootstrap.sessionId))}
            className="rounded-lg bg-cyan/15 px-3 py-2 text-xs text-cyan ring-1 ring-cyan/35 hover:bg-cyan/25"
          >
            <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
            {opening ? 'Preparing…' : hasLaunched ? 'Try again' : 'Open Agent'}
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
