export function formatClock(value: string): string {
  const [hoursValue, minutes] = value.split(':');
  const hours = Number(hoursValue);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}
