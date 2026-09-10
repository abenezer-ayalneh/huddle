export function roundToNextQuarter(date: Date): string {
  const rounded = new Date(date);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0);
  if (rounded <= date) rounded.setMinutes(rounded.getMinutes() + 15);
  return `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`;
}

export function scheduledAt(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(day);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

export function isFutureSchedule(day: Date, time: string, now = new Date()): boolean {
  return scheduledAt(day, time).getTime() > now.getTime();
}
