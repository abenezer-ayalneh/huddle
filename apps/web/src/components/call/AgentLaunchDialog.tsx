'use client';

import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/lib/api';
import type { HelperBootstrap } from './useRemoteControl';

export default function AgentLaunchDialog({
  bootstrap,
  onReopen,
  onAgentUnavailable,
  onDismiss,
}: {
  bootstrap: HelperBootstrap | null;
  onReopen: () => Promise<HelperBootstrap | null>;
  onAgentUnavailable: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [handoffUnavailableSessionId, setHandoffUnavailableSessionId] = useState<string | null>(null);
  const bootstrapSessionId = bootstrap?.sessionId ?? null;
  const deepLink = useMemo(() => {
    if (!bootstrap) return '';
    const query = new URLSearchParams({ room: bootstrap.room, session: bootstrap.sessionId, code: bootstrap.code, api: API_URL });
    return `huddle-control://join?${query.toString()}`;
  }, [bootstrap]);

  useEffect(() => {
    if (!deepLink) return;
    let handedOff = false;
    let timer: number | null = null;
    let frame: HTMLIFrameElement | null = null;
    const markHandedOff = () => {
      if (handedOff) return;
      handedOff = true;
      if (timer !== null) window.clearTimeout(timer);
      frame?.remove();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markHandedOff();
    };
    const onPageHide = () => markHandedOff();

    // A custom URL scheme has no completion callback. Leaving the page is the
    // positive signal; the timeout is only recovery guidance.
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = deepLink;
    document.body.appendChild(frame);
    timer = window.setTimeout(() => {
      if (!handedOff) {
        setHandoffUnavailableSessionId(bootstrapSessionId);
        onAgentUnavailable();
      }
      frame?.remove();
    }, 3_000);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      frame?.remove();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [bootstrapSessionId, deepLink, onAgentUnavailable]);

  if (!bootstrap) return null;
  const launch = (link: string) => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = link;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 2_000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {}
  };

  const retry = async () => {
    setHandoffUnavailableSessionId(null);
    setOpening(true);
    const fresh = await onReopen();
    if (fresh) {
      const query = new URLSearchParams({ room: fresh.room, session: fresh.sessionId, code: fresh.code, api: API_URL });
      launch(`huddle-control://join?${query.toString()}`);
    }
    setOpening(false);
  };

  if (handoffUnavailableSessionId === bootstrap.sessionId) {
    return (
      <div role="status" aria-live="polite" className="signal-call-agent-recovery glass-strong pointer-events-auto fixed right-4 top-4 z-50 w-[min(92vw,26rem)] rounded-xl p-4 text-white shadow-[0_12px_36px_oklch(0_0_0/0.35)] ring-1 ring-amber-200/30">
        <h2 className="text-sm font-semibold">Control Agent not detected</h2>
        <p className="mt-1 text-xs leading-5 text-white/70">Huddle could not confirm that the Control Agent opened. If it is not installed, download it, then return to this call and try again.</p>
        <div className="mt-3 flex justify-end gap-2">
          <a
            href="/downloads?from=remote-control"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-cyan/15 px-3 py-2 text-xs font-semibold text-cyan ring-1 ring-cyan/35 hover:bg-cyan/25"
          >
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Open downloads
          </a>
          <button type="button" disabled={opening} onClick={() => void retry()} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/20">
            {opening ? 'Preparing…' : 'Try again'}
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/20">
            Close
          </button>
        </div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" className="signal-call-agent-backdrop pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="signal-call-agent-dialog glass-strong w-full max-w-md space-y-4 rounded-2xl p-6 text-white">
        <div>
          <h2 className="font-display text-lg font-semibold">Opening the Control Agent</h2>
          <p className="mt-1 text-sm text-white/65">
            Huddle is opening the signed macOS Control Agent. If it is not installed, download it, then return here and press Open Agent again. The launch link
            is one-time and expires shortly; Open Agent creates a fresh link when needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white/8 px-3 py-2 font-mono text-xs text-cyan ring-1 ring-white/10">
            One-time launch link ready
          </code>
          <button type="button" onClick={copy} aria-label="Copy one-time Control Agent launch link" className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
            {copied ? <Check className="h-4 w-4 text-cyan" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-white/45">Copy the full link only if your browser cannot open the app. The agent never saves it after redemption.</p>
        <div className="flex justify-end gap-2">
          <a
            href="/downloads?from=remote-control"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20"
          >
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Download for Mac
          </a>
          <button
            type="button"
            disabled={opening}
            onClick={() => void retry()}
            className="rounded-lg bg-cyan/15 px-3 py-2 text-xs text-cyan ring-1 ring-cyan/35 hover:bg-cyan/25"
          >
            <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
            {opening ? 'Preparing…' : 'Open Agent'}
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
