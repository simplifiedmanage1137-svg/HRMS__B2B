// Trusted-time sync — anchors the frontend's notion of "now" to the backend's clock instead
// of the employee's device clock, which can be freely changed and must not be trusted for
// attendance (see attendanceController.js clockIn/clockOut/getTodayAttendance, which already
// compute clock_in/clock_out from the server's own `new Date()` and return it as `server_time`).
//
// Uses performance.now() — a monotonic clock unaffected by the OS wall clock being changed —
// to measure elapsed time since the last sync, rather than diffing two Date.now() readings.
// So even if the employee edits their system clock mid-session, only the window between the
// last sync and the next one is affected, and every attendance-related response the app
// already makes (today's status poll, clock-in, clock-out) carries a fresh `server_time` to
// re-anchor from — see the axios response interceptor in config/axios.js.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

let serverMsAtSync = null;
let perfAtSync = null;

/** Record a trusted server timestamp (ISO string, or ms epoch) as of "right now". */
export const syncServerTime = (serverTimeInput) => {
  if (!serverTimeInput) return;
  const serverMs = typeof serverTimeInput === 'number'
    ? serverTimeInput
    : new Date(serverTimeInput).getTime();
  if (isNaN(serverMs)) return;
  serverMsAtSync = serverMs;
  perfAtSync = performance.now();
};

/** Best-known current server time, in epoch ms. Falls back to the device clock until the
 *  first sync arrives (e.g. before any API call has completed on a fresh page load). */
export const getTrustedNowMs = () => {
  if (serverMsAtSync == null) return Date.now();
  return serverMsAtSync + (performance.now() - perfAtSync);
};

/** Best-known current server time, as a Date. */
export const getTrustedNow = () => new Date(getTrustedNowMs());

/** Whether at least one trusted server timestamp has been recorded. */
export const hasSyncedServerTime = () => serverMsAtSync != null;

/** Best-known current IST time, formatted "YYYY-MM-DD HH:MM:SS" — same shape as the
 *  nowIST() helpers already duplicated across attendanceController.js/Attendance.jsx. */
export const getTrustedNowIST = () => {
  const ist = new Date(getTrustedNowMs() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const mi = String(ist.getUTCMinutes()).padStart(2, '0');
  const s = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
};
