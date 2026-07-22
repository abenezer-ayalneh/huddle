'use client';

import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/lib/api';
import type { HelperBootstrap } from './useRemoteControl';

export default function AgentLaunchDialog({ bootstrap, onDismiss }: { bootstrap: HelperBootstrap | null; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const deepLink = useMemo(() => {
    if (!bootstrap) return '';
    const query = new URLSearchParams({ room: bootstrap.room, session: bootstrap.sessionId, code: bootstrap.code, api: API_URL });
    return `huddle-control://join?${query.toString()}`;
  }, [bootstrap]);

  useEffect(() => {
    if (!deepLink) return;
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = deepLink;
    document.body.appendChild(frame);
    const timer = window.setTimeout(() => frame.remove(), 2_000);
    return () => {
      window.clearTimeout(timer);
      frame.remove();
    };
  }, [deepLink]);

  if (!bootstrap) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bootstrap.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {}
  };
  return (
    <div role="dialog" aria-modal="true" className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="glass-strong w-full max-w-md space-y-4 rounded-2xl p-6 text-white">
        <div>
          <h2 className="font-display text-lg font-semibold">Opening the Control Agent</h2>
          <p className="mt-1 text-sm text-white/65">
            If the app did not open, install or launch the signed macOS Control Agent and paste this one-time code. It expires shortly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white/8 px-3 py-2 font-mono text-xs text-cyan ring-1 ring-white/10">{bootstrap.code}</code>
          <button type="button" onClick={copy} aria-label="Copy one-time bootstrap code" className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
            {copied ? <Check className="h-4 w-4 text-cyan" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              const frame = document.createElement('iframe');
              frame.style.display = 'none';
              frame.src = deepLink;
              document.body.appendChild(frame);
              window.setTimeout(() => frame.remove(), 1_000);
            }}
            className="rounded-lg bg-cyan/15 px-3 py-2 text-xs text-cyan ring-1 ring-cyan/35 hover:bg-cyan/25"
          >
            <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
            Open Agent
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
