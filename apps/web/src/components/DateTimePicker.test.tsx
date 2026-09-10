import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DateTimePicker from './DateTimePicker';

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect: (day: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date(2026, 8, 10))}>
      Select today
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DateTimePicker', () => {
  it('disables times earlier today and never submits one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10, 14, 10, 0));
    const onSchedule = vi.fn();

    render(<DateTimePicker onSchedule={onSchedule}>Schedule</DateTimePicker>);
    fireEvent.click(screen.getByRole('button', { name: 'Select today' }));

    const time = screen.getByLabelText('Time') as HTMLSelectElement;
    expect((time.querySelector('option[value="14:00"]') as HTMLOptionElement | null)?.disabled).toBe(true);
    expect((time.querySelector('option[value="14:15"]') as HTMLOptionElement | null)?.disabled).toBe(false);

    fireEvent.change(time, { target: { value: '14:00' } });
    expect(screen.getByText('Choose a time in the future.')).toBeTruthy();
    const confirm = screen.getAllByRole('button', { name: 'Schedule' }).at(-1)!;
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onSchedule).not.toHaveBeenCalled();
  });
});
