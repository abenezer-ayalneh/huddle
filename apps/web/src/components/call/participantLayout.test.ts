import { describe, expect, it } from 'vitest';
import { buildParticipantPages, centerLastRow, pageCapacity, parseSelfViewPreference, reconcilePageIndex, selfViewShouldGrid } from './participantLayout';

describe('participant layout model', () => {
  it('uses landscape and portrait capacities', () => {
    expect(pageCapacity(false)).toBe(8);
    expect(pageCapacity(true)).toBe(4);
    expect(
      buildParticipantPages(
        Array.from({ length: 9 }, (_, i) => i),
        false,
      ),
    ).toHaveLength(2);
  });
  it('centers incomplete final rows without changing item order', () => {
    expect(centerLastRow(['a', 'b', 'c', 'd', 'e'], 3).map((x) => x.item)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('applies self view mode rules and safe persistence parsing', () => {
    expect(selfViewShouldGrid('auto', 1)).toBe(false);
    expect(selfViewShouldGrid('auto', 2)).toBe(true);
    expect(selfViewShouldGrid('float', 8)).toBe(false);
    expect(parseSelfViewPreference('{"version":99,"mode":"grid"}').mode).toBe('auto');
    expect(parseSelfViewPreference('{"mode":"grid","corner":"tr","minimized":true}')).toMatchObject({ mode: 'grid', corner: 'tr', minimized: true });
  });
  it('reconciles pages after roster changes', () => {
    expect(reconcilePageIndex(3, 2)).toBe(1);
    expect(reconcilePageIndex(-1, 0)).toBe(0);
  });
});
