'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Shown after "Present with control" while we wait for the Control Agent to
// join. The deep link usually launches the agent; the visible code is the
// fallback for machines where the huddle:// protocol isn't registered. The
// parent closes this as soon as the agent's share appears.

export default function AgentLaunchDialog({ code, onCancel }: { code: string | null; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the code is on screen to copy by hand
    }
  };

  return (
    <AlertDialog open={code !== null} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Opening the Control Agent…</AlertDialogTitle>
          <AlertDialogDescription>
            Your screen share starts when the desktop agent connects. If nothing opened, launch the Huddle Control Agent yourself and paste this one-time code
            (it expires in about a minute):
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center justify-center gap-2">
          <code className="rounded-lg bg-white/8 px-4 py-2 font-mono text-lg tracking-widest text-cyan ring-1 ring-white/10">{code}</code>
          <button
            type="button"
            onClick={copy}
            title="Copy code"
            aria-label="Copy code"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
          >
            {copied ? <Check className="h-4 w-4 text-cyan" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
