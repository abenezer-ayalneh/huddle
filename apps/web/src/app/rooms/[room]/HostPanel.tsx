'use client';

import { useRemoteParticipants, useRoomInfo } from '@livekit/components-react';
import { Check, Copy, ShieldCheck, UserCheck, UserMinus, UserX, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type PendingKnock } from '@/lib/api';
import { isAgentIdentity } from '@/lib/controlProtocol';
import IconButton from '@/components/IconButton';
import RecordingControls from './RecordingControls';

function playDing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // Audio blocked or unavailable — glow still works.
  }
}

export default function HostPanel({ room, hostKey }: { room: string; hostKey: string }) {
  // Control Agents never appear as people — not even to the host. Stopping an
  // agent's share is the presenter's Revoke/stop, not a host mute/kick.
  const participants = useRemoteParticipants().filter((p) => !isAgentIdentity(p.identity));
  const { metadata } = useRoomInfo();
  const muteOnEntry = useMemo(() => {
    if (!metadata) return false;
    try {
      return (JSON.parse(metadata) as { muteOnEntry?: unknown }).muteOnEntry === true;
    } catch {
      return false;
    }
  }, [metadata]);
  const [knocks, setKnocks] = useState<PendingKnock[]>([]);
  const seenKnockIds = useRef(new Set<string>());

  useEffect(() => {
    const currentIds = new Set(knocks.map((k) => k.knockId));
    let newCount = 0;
    for (const id of currentIds) {
      if (!seenKnockIds.current.has(id)) newCount++;
    }
    seenKnockIds.current = currentIds;
    if (newCount === 0) return;
    playDing();
    for (let i = 1; i < newCount; i++) {
      setTimeout(() => playDing(), i * 250);
    }
  }, [knocks]);

  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/rooms/${encodeURIComponent(room)}` : '';

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked
    }
  }, [inviteLink]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { knocks } = await api.listKnocks(room, hostKey);
        if (!cancelled) setKnocks(knocks);
      } catch {
        // Transient — keep the last known list and try again next tick.
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room, hostKey]);

  const withBusy = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      // Surface nothing intrusive; the periodic poll / participant list
      // will reconcile state on the next update.
    } finally {
      setBusy(null);
    }
  }, []);

  const admit = (k: PendingKnock) =>
    withBusy(`admit-${k.knockId}`, async () => {
      await api.admit(room, k.knockId, hostKey);
      setKnocks((prev) => prev.filter((p) => p.knockId !== k.knockId));
    });

  const deny = (k: PendingKnock) =>
    withBusy(`deny-${k.knockId}`, async () => {
      await api.deny(room, k.knockId, hostKey);
      setKnocks((prev) => prev.filter((p) => p.knockId !== k.knockId));
    });

  const mute = (identity: string) => withBusy(`mute-${identity}`, () => api.mute(room, identity, true, hostKey));

  const remove = (identity: string) => withBusy(`remove-${identity}`, () => api.removeParticipant(room, identity, hostKey));

  const toggleMuteOnEntry = () => withBusy('mute-on-entry', () => api.setMuteOnEntry(room, !muteOnEntry, hostKey));

  if (!open) {
    return (
      <div className="absolute right-4 top-4 z-30">
        <button
          type="button"
          aria-label={`Host controls${knocks.length ? ` (${knocks.length} waiting)` : ''}`}
          title={`Host controls${knocks.length ? ` (${knocks.length} waiting)` : ''}`}
          onClick={() => setOpen(true)}
          className={`glass-strong relative flex h-12 items-center gap-2 rounded-full px-4 font-display text-sm font-medium tracking-wide text-white transition-all hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 ${
            knocks.length ? 'knock-border-spin' : ''
          }`}
        >
          <ShieldCheck className="h-5 w-5 text-cyan" />
          Host
          {knocks.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta px-1 text-xs font-semibold text-white">{knocks.length}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside className="glass-strong absolute inset-y-0 right-0 z-30 flex w-80 max-w-[85vw] flex-col border-l border-white/10 shadow-[-8px_0_50px_oklch(0_0_0/0.5)] animate-in slide-in-from-right duration-200">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <span className="flex items-center gap-2 font-display text-base font-semibold tracking-wide text-white">
          <ShieldCheck className="h-5 w-5 text-cyan" />
          Host controls
        </span>
        <IconButton
          icon={X}
          label="Close host controls"
          size="sm"
          className="text-white/60 hover:bg-white/15 hover:text-white"
          onClick={() => setOpen(false)}
        />
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm">
        <Section title="Invite">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-cyan">{room}</code>
            <IconButton icon={copied ? Check : Copy} label={copied ? 'Copied!' : 'Copy invite link'} variant="subtle" size="sm" onClick={copyInvite} />
          </div>
        </Section>

        <Section title="Recording">
          <RecordingControls room={room} hostKey={hostKey} />
        </Section>

        <Section title="Waiting room" badge={knocks.length > 0 ? knocks.length : undefined}>
          {knocks.length === 0 ? (
            <p className="text-white/45">No one waiting.</p>
          ) : (
            <ul className="space-y-2">
              {knocks.map((k) => (
                <li key={k.knockId} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="truncate text-white/90">{k.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      icon={UserCheck}
                      label={`Admit ${k.name}`}
                      size="sm"
                      className="bg-cyan text-black hover:brightness-110"
                      disabled={busy === `admit-${k.knockId}`}
                      onClick={() => admit(k)}
                    />
                    <IconButton
                      icon={UserX}
                      label={`Deny ${k.name}`}
                      variant="subtle"
                      size="sm"
                      disabled={busy === `deny-${k.knockId}`}
                      onClick={() => deny(k)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Participants">
          <button
            onClick={toggleMuteOnEntry}
            disabled={busy === 'mute-on-entry'}
            aria-pressed={muteOnEntry}
            className={`mb-3 w-full rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 disabled:opacity-50 ${
              muteOnEntry ? 'neon-magenta bg-magenta text-white hover:brightness-110' : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            {muteOnEntry ? 'Muted on entry — allow unmuting' : 'Mute all'}
          </button>
          {participants.length === 0 ? (
            <p className="text-white/45">No other participants.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.identity} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="truncate text-white/90">{p.name || p.identity}</span>
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      icon={VolumeX}
                      label={`Mute ${p.name || p.identity}`}
                      variant="subtle"
                      size="sm"
                      disabled={busy === `mute-${p.identity}`}
                      onClick={() => mute(p.identity)}
                    />
                    <IconButton
                      icon={UserMinus}
                      label={`Remove ${p.name || p.identity}`}
                      variant="danger"
                      size="sm"
                      disabled={busy === `remove-${p.identity}`}
                      onClick={() => remove(p.identity)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}

// Section with a neon left-accent header and an optional count badge.
function Section({ title, badge, children }: { title: string; badge?: number; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        <span className="h-3 w-0.5 rounded-full bg-gradient-to-b from-magenta to-cyan" />
        {title}
        {badge !== undefined && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-semibold text-white">{badge}</span>
        )}
      </h3>
      {children}
    </section>
  );
}
