import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

export type SelfViewMode = 'auto' | 'float' | 'grid';
export type SelfViewCorner = 'tl' | 'tr' | 'bl' | 'br';
export type SelfViewPreference = {
  version: 1;
  mode: SelfViewMode;
  corner: SelfViewCorner;
  minimized: boolean;
};

export const SELF_VIEW_STORAGE_KEY = 'huddle-self-view-v1';
export const DEFAULT_SELF_VIEW_PREFERENCE: SelfViewPreference = {
  version: 1,
  mode: 'auto',
  corner: 'bl',
  minimized: false,
};

export function parseSelfViewPreference(value: string | null | undefined): SelfViewPreference {
  if (!value) return DEFAULT_SELF_VIEW_PREFERENCE;
  try {
    const parsed = JSON.parse(value) as Partial<SelfViewPreference>;
    if ((parsed.version ?? 1) !== 1) return DEFAULT_SELF_VIEW_PREFERENCE;
    const mode = parsed.mode === 'float' || parsed.mode === 'grid' || parsed.mode === 'auto' ? parsed.mode : 'auto';
    const corner = parsed.corner === 'tl' || parsed.corner === 'tr' || parsed.corner === 'bl' || parsed.corner === 'br' ? parsed.corner : 'bl';
    return { version: 1, mode, corner, minimized: parsed.minimized === true };
  } catch {
    return DEFAULT_SELF_VIEW_PREFERENCE;
  }
}

export function selfViewShouldGrid(mode: SelfViewMode, remoteCount: number): boolean {
  if (mode === 'grid') return true;
  if (mode === 'float') return false;
  return remoteCount > 1;
}

export function pageCapacity(portrait: boolean): number {
  return portrait ? 4 : 8;
}

export type LayoutIdentity = {
  identity: string;
  track: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  speaking?: boolean;
  lastSpokeAt?: number;
};

export function centerLastRow<T>(items: T[], columns: number): { item: T; index: number }[] {
  if (columns <= 1) return items.map((item, index) => ({ item, index }));
  const remainder = items.length % columns;
  if (remainder === 0) return items.map((item, index) => ({ item, index }));
  const offset = Math.floor((columns - remainder) / 2);
  return items.map((item, index) => ({ item, index: index + (index >= items.length - remainder ? offset : 0) }));
}

export function promoteSpeakingParticipant<T extends { identity: string; speaking?: boolean; lastSpokeAt?: number }>(
  visible: T[],
  incoming: T,
  protectedIdentities: Set<string>,
): { visible: T[]; evicted?: T } {
  if (visible.some((item) => item.identity === incoming.identity)) return { visible };
  const candidates = visible.filter((item) => !protectedIdentities.has(item.identity) && !item.speaking);
  if (candidates.length === 0) return { visible };
  const evicted = [...candidates].sort((a, b) => {
    const activity = (a.lastSpokeAt ?? 0) - (b.lastSpokeAt ?? 0);
    return activity || 0;
  })[0];
  const next = visible.map((item) => (item.identity === evicted.identity ? incoming : item));
  return { visible: next, evicted };
}

export type ParticipantPage<T> = { items: T[]; pageIndex: number; pageCount: number };

/** Stable pages: callers provide a stable join-ordered roster. */
export function buildParticipantPages<T>(items: T[], portrait: boolean): ParticipantPage<T>[] {
  const capacity = pageCapacity(portrait);
  const pageCount = Math.max(1, Math.ceil(items.length / capacity));
  return Array.from({ length: pageCount }, (_, pageIndex) => ({
    items: items.slice(pageIndex * capacity, (pageIndex + 1) * capacity),
    pageIndex,
    pageCount,
  }));
}

export function reconcilePageIndex(pageIndex: number, pageCount: number): number {
  return Math.max(0, Math.min(pageIndex, Math.max(0, pageCount - 1)));
}

export function speakingOrder<T extends { identity: string; speaking?: boolean; speechStartedAt?: number }>(items: T[]): T[] {
  return [...items].filter((item) => item.speaking).sort((a, b) => (a.speechStartedAt ?? Infinity) - (b.speechStartedAt ?? Infinity));
}
