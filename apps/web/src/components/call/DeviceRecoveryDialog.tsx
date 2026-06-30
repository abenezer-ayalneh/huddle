'use client';

import { Lock, Mic, MicOff, RefreshCw, TriangleAlert, Video, VideoOff, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { detectBrowser, unblockSteps, type FailureCause, type RecoveryDevice } from '@/lib/deviceRecovery';
import type { PermissionState } from './useMediaPermissions';

// Device Recovery dialog (docs/adr/0023). A page-centered, non-technical
// explanation of why a camera or microphone can't be used and how to get it
// back. One shell, three bodies (denied / in use / not found) plus a generic
// fallback. For a denial it shows browser-tailored unblock steps; the primary
// action re-attempts access (which re-fires the native prompt when the state is
// still re-promptable). When access is restored the parent closes this dialog.

export type RecoveryTarget = { device: RecoveryDevice; cause: FailureCause };

export default function DeviceRecoveryDialog({
  target,
  permission,
  onTryAgain,
  onClose,
}: {
  target: RecoveryTarget | null;
  permission: PermissionState;
  onTryAgain: () => void;
  onClose: () => void;
}) {
  // Keep the last target while the close animation plays out.
  const device = target?.device ?? 'camera';
  const cause = target?.cause ?? 'unknown';
  const isCam = device === 'camera';
  const Label = isCam ? 'Camera' : 'Microphone';
  const lower = isCam ? 'camera' : 'microphone';

  const content = useMemo(() => buildContent({ cause, device, Label, lower }), [cause, device, Label, lower]);

  // A still-re-promptable block: a click fires a fresh native prompt, so lead
  // with "Allow access" rather than "Try again".
  const canReprompt = cause === 'denied' && permission === 'prompt';
  const actionLabel = canReprompt ? `Allow ${lower}` : 'Try again';

  return (
    <AlertDialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-magenta/15 text-magenta">
            <content.Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.body}</AlertDialogDescription>
        </AlertDialogHeader>

        {content.steps && (
          <ol className="space-y-2 text-sm text-white/80">
            {content.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}

        {content.closingLine && <p className="text-xs text-white/50">{content.closingLine}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <AlertDialogAction onClick={onTryAgain}>
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function buildContent({ cause, device, Label, lower }: { cause: FailureCause; device: RecoveryDevice; Label: string; lower: string }): {
  Icon: LucideIcon;
  title: string;
  body: string;
  steps?: string[];
  closingLine?: string;
} {
  switch (cause) {
    case 'denied': {
      const { steps, autoRecovers } = unblockSteps(detectBrowser());
      return {
        Icon: Lock,
        title: `${Label} access is turned off`,
        body: `Your browser is blocking Huddle from using your ${lower}. Here's how to turn it back on:`,
        steps,
        closingLine: autoRecovers ? "Once you allow it, you'll reconnect automatically." : 'Then reload this page if it doesn’t reconnect on its own.',
      };
    }
    case 'inuse':
      return {
        Icon: device === 'camera' ? Video : Mic,
        title: `Your ${lower} is busy`,
        body: `Another app — like Zoom, FaceTime, Teams, or your ${lower} app — may be using your ${lower}. Close it, then try again.`,
      };
    case 'notfound':
      return {
        Icon: device === 'camera' ? VideoOff : MicOff,
        title: `No ${lower} found`,
        body: `We couldn't find a ${lower}. Connect one and we'll pick it up automatically — or just join without it.`,
      };
    default:
      return {
        Icon: TriangleAlert,
        title: `Can't reach your ${lower}`,
        body: `Something went wrong getting to your ${lower}. Try again, and if it keeps happening, reload the page.`,
      };
  }
}
