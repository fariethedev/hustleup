export function ticketIsPast(ticket, now = Date.now()) {
  if (['CHECKED_IN', 'CANCELLED'].includes(ticket.status)) return true;
  const startsAt = Date.parse(ticket.eventStartsAt);
  return Number.isFinite(startsAt) && startsAt < now;
}
export function ticketDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'To be announced';
}
export const ticketStatus = status => ({ VALID: 'Ready to go', CHECKED_IN: 'Checked in', CANCELLED: 'Cancelled' }[status] || status || 'Unknown');
