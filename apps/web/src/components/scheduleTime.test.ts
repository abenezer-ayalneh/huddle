import { describe, expect, it } from 'vitest';
import { isFutureSchedule, roundToNextQuarter, scheduledAt } from './scheduleTime';

describe('scheduled meeting time helpers', () => {
  it('rounds across midnight without returning an invalid minute value', () => {
    expect(roundToNextQuarter(new Date(2026, 8, 10, 23, 46, 0))).toBe('00:00');
  });

  it('keeps the selected local day and time when converting to an instant', () => {
    const scheduled = scheduledAt(new Date(2026, 8, 11), '13:45');
    expect(scheduled.getFullYear()).toBe(2026);
    expect(scheduled.getMonth()).toBe(8);
    expect(scheduled.getDate()).toBe(11);
    expect(scheduled.getHours()).toBe(13);
    expect(scheduled.getMinutes()).toBe(45);
  });

  it('does not allow an earlier time today but does allow a later one', () => {
    const now = new Date(2026, 8, 10, 14, 10, 0);
    const today = new Date(2026, 8, 10);
    expect(isFutureSchedule(today, '14:00', now)).toBe(false);
    expect(isFutureSchedule(today, '14:15', now)).toBe(true);
  });
});
