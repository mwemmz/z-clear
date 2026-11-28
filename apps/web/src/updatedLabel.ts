/** Human-friendly freshness label that never turns clock skew into a future claim. */
export function updatedLabelFor(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const minutes = Math.min(0, Math.round((date.getTime() - Date.now()) / 60000));
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (minutes === 0) return 'just now';
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour');
  return `updated ${date.toLocaleDateString()}`;
}
