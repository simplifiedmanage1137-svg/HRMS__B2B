// Mirrors backend/config/ticketPolicy.js AGE_THRESHOLDS_HOURS — keep both in sync.
export const AGE_THRESHOLDS_HOURS = {
  warning: 24,   // 1 day  — amber
  elevated: 72,  // 3 days — orange
  critical: 168, // 7 days — red
};

const AGE_COLORS = {
  green:  { color: '#10b981', bg: '#ecfdf5' },
  amber:  { color: '#f59e0b', bg: '#fffbeb' },
  orange: { color: '#f97316', bg: '#fff7ed' },
  red:    { color: '#ef4444', bg: '#fef2f2' },
};

const humanize = (hours) => {
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  if (remHours === 0) return `${days} day${days === 1 ? '' : 's'}`;
  return `${days} day${days === 1 ? '' : 's'} ${remHours} hour${remHours === 1 ? '' : 's'}`;
};

/**
 * Computes a ticket's age for display. For finished tickets (closed) the age is measured
 * up to resolution/closure, not to "now" — a closed ticket doesn't keep aging.
 */
export function getTicketAge(ticket) {
  const isFinished = ticket.status === 'closed';
  const end = isFinished ? (ticket.closed_at || ticket.resolved_at || ticket.updated_at) : new Date().toISOString();
  const hours = Math.max(0, (new Date(end) - new Date(ticket.created_at)) / 3600000);

  let colorKey = 'green';
  if (hours >= AGE_THRESHOLDS_HOURS.critical) colorKey = 'red';
  else if (hours >= AGE_THRESHOLDS_HOURS.elevated) colorKey = 'orange';
  else if (hours >= AGE_THRESHOLDS_HOURS.warning) colorKey = 'amber';

  const duration = humanize(hours);
  return {
    hours,
    colorKey,
    ...AGE_COLORS[colorKey],
    label: isFinished ? `Resolved after ${duration}` : `Pending for ${duration}`,
    shortLabel: duration,
    isCritical: colorKey === 'red',
  };
}
