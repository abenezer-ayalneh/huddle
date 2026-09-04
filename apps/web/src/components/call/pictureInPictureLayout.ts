import { type TrackReferenceOrPlaceholder } from '@livekit/components-react';

export type PictureInPictureLayout = 'stack' | 'single' | 'pair' | 'trio' | 'grid' | 'primary';

export function selectPictureInPictureLayout(
  width: number,
  height: number,
  participantCount = 4,
): PictureInPictureLayout {
  if (participantCount <= 0) return 'stack';
  if (height < 280 || width / Math.max(height, 1) > 1.85) return 'primary';
  if (participantCount === 1) return 'single';
  if (participantCount === 2 && width >= 430 && height >= 360) return 'pair';
  if (participantCount === 3 && width >= 430 && height >= 360) return 'trio';
  if (width >= 430 && height >= 360) return 'grid';
  return 'stack';
}

export function orderPictureInPictureTracks(
  tracks: TrackReferenceOrPlaceholder[],
  options: { pinnedIdentity?: string | null; activeIdentity?: string; max?: number },
) {
  const unique = new Map<string, TrackReferenceOrPlaceholder>();
  for (const track of tracks) {
    if (!track.participant.isLocal && unique.has(track.participant.identity)) continue;
    unique.set(track.participant.identity, track);
  }

  const local = tracks.find((track) => track.participant.isLocal) ?? null;
  const remotes = [...unique.values()].filter((track) => !track.participant.isLocal);
  const ordered: TrackReferenceOrPlaceholder[] = [];
  const add = (track: TrackReferenceOrPlaceholder | null) => {
    if (track && !ordered.some((current) => current.participant.identity === track.participant.identity)) ordered.push(track);
  };

  add(remotes.find((track) => track.participant.identity === options.pinnedIdentity) ?? null);
  add(remotes.find((track) => track.participant.identity === options.activeIdentity) ?? null);
  remotes.forEach(add);
  add(local);

  const max = options.max ?? 4;
  return {
    tracks: ordered.slice(0, max),
    omittedCount: Math.max(0, ordered.length - max),
  };
}
