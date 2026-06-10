"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const date = new Date(2000, 0, 1, h, m);
  const label = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { value, label };
});

function roundToNextQuarter(date: Date): string {
  const h = date.getHours();
  const m = Math.ceil(date.getMinutes() / 15) * 15;
  const rounded = new Date(date);
  rounded.setHours(h, m, 0, 0);
  if (rounded <= date) rounded.setMinutes(rounded.getMinutes() + 15);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes() % 60).padStart(2, "0")}`;
}

function mergeDayTime(day: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const merged = new Date(day);
  merged.setHours(h, m, 0, 0);
  return merged.toISOString();
}

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
    const dt = new Date(mergeDayTime(selectedDay, selectedTime));
    return dt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [selectedDay, selectedTime]);

  const handleConfirm = useCallback(() => {
    if (!selectedDay) return;
    onSchedule(mergeDayTime(selectedDay, selectedTime));
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={triggerClassName ?? "inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium"}
      >
        {children ?? "Pick a date & time"}
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selectedDay} onSelect={setSelectedDay} disabled={{ before: today }} />

        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-medium">Time</span>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent py-2 pl-2.5 pr-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
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
              <button type="button" onClick={handleClear} className="text-xs text-destructive hover:underline">
                Clear
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Pick a date above</span>
          )}
        </div>

        <div className="border-t border-border px-3 py-3">
          <button
            type="button"
            disabled={!selectedDay || disabled}
            onClick={handleConfirm}
            className="w-full rounded-lg bg-magenta px-4 py-2 font-display font-semibold text-sm tracking-wide text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Schedule
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
