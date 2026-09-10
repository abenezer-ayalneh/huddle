'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LoadingSpinner from '@/components/LoadingSpinner';
import { isFutureSchedule, roundToNextQuarter, scheduledAt } from './scheduleTime';

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const date = new Date(2000, 0, 1, h, m);
  const label = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { value, label };
});

export default function DateTimePicker({
  onSchedule,
  children,
  triggerClassName,
  disabled = false,
}: {
  onSchedule: (iso: string) => void;
  children?: ReactNode;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState(() => roundToNextQuarter(new Date()));

  const summary = useMemo(() => {
    if (!selectedDay) return null;
    const dt = scheduledAt(selectedDay, selectedTime);
    return dt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [selectedDay, selectedTime]);

  const handleConfirm = useCallback(() => {
    if (!selectedDay || !isFutureSchedule(selectedDay, selectedTime)) return;
    onSchedule(scheduledAt(selectedDay, selectedTime).toISOString());
    setSelectedDay(undefined);
    setSelectedTime(roundToNextQuarter(new Date()));
    setOpen(false);
  }, [selectedDay, selectedTime, onSchedule]);

  const handleClear = useCallback(() => {
    setSelectedDay(undefined);
    setSelectedTime(roundToNextQuarter(new Date()));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedTimeIsFuture = selectedDay ? isFutureSchedule(selectedDay, selectedTime) : false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={triggerClassName ?? 'inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium'}
      >
        {children ?? 'Pick a date & time'}
      </PopoverTrigger>

      <PopoverContent className="lobby-date-picker w-auto p-0" align="start">
        <Calendar mode="single" selected={selectedDay} onSelect={setSelectedDay} disabled={{ before: today }} />

        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <label htmlFor="meeting-time" className="shrink-0 text-sm font-medium">
              Time
            </label>
            <select
              id="meeting-time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent py-2 pl-2.5 pr-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value} disabled={selectedDay ? !isFutureSchedule(selectedDay, slot.value) : false}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          {summary ? (
            <>
              <span className="text-sm text-muted-foreground">{summary}</span>
              <button type="button" onClick={handleClear} className="lobby-date-picker-clear text-xs hover:underline">
                Clear
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Pick a date above</span>
          )}
        </div>

        {selectedDay && !selectedTimeIsFuture && <p className="px-3 pb-2 text-sm text-destructive">Choose a time in the future.</p>}

        <div className="border-t border-border px-3 py-3">
          <button
            type="button"
            disabled={!selectedDay || !selectedTimeIsFuture || disabled}
            onClick={handleConfirm}
            className="lobby-primary-button lobby-primary-button-full"
          >
            {disabled && <LoadingSpinner className="h-3.5 w-3.5" />}
            {!disabled && 'Schedule'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
