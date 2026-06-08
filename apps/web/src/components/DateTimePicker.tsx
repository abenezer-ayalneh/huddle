"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Generate time slots in 15-minute increments for the dropdown.
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

// Round a Date's time to the nearest future 15-minute slot (for the default).
function roundToNextQuarter(date: Date): string {
  const h = date.getHours();
  const m = Math.ceil(date.getMinutes() / 15) * 15;
  const rounded = new Date(date);
  rounded.setHours(h, m, 0, 0);
  if (rounded <= date) rounded.setMinutes(rounded.getMinutes() + 15);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes() % 60).padStart(2, "0")}`;
}

// A calendar date-picker popover with a 15-minute-increment time select.
// Built on shadcn/ui Calendar, Popover, and Select.
export default function DateTimePicker({
  value,
  onChange,
  children,
  triggerClassName,
  disabled = false,
}: {
  // ISO string of the selected datetime, or "" for no selection.
  value: string;
  onChange: (iso: string) => void;
  // Content rendered inside the popover trigger button.
  children?: ReactNode;
  // Tailwind classes for the trigger button.
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(
    () => (value ? new Date(value) : undefined),
    [value]
  );

  const selectedTime = useMemo(() => {
    if (!selectedDate) return roundToNextQuarter(new Date());
    const h = String(selectedDate.getHours()).padStart(2, "0");
    const m = String(selectedDate.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }, [selectedDate]);

  // Merge a day + time into an ISO string and fire onChange.
  const emit = useCallback(
    (day: Date | undefined, time: string) => {
      if (!day) {
        onChange("");
        return;
      }
      const [h, m] = time.split(":").map(Number);
      const merged = new Date(day);
      merged.setHours(h, m, 0, 0);
      onChange(merged.toISOString());
    },
    [onChange]
  );

  const handleDaySelect = useCallback(
    (day: Date | undefined) => {
      emit(day, selectedTime);
    },
    [emit, selectedTime]
  );

  const handleTimeChange = useCallback(
    (time: string | null) => {
      if (!time) return;
      const day = selectedDate ?? new Date();
      emit(day, time);
    },
    [emit, selectedDate]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={
          triggerClassName ??
          "inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium"
        }
      >
        {children ?? "Pick a date & time"}
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          disabled={{ before: today }}
        />

        {/* Time select */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-medium">Time</span>
            <Select value={selectedTime} onValueChange={handleTimeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected summary + clear */}
        {selectedDate && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {selectedDate.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-destructive hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
