const CHAT_RETENTION_DAYS = 15;
const CHAT_RETENTION_MS = CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CLOSED_GIG_STATUSES = new Set(["pending-admin-approval", "payout-processing", "completed", "cancelled"]);

const getChatAccess = (gig, now = new Date()) => {
  const isClosed = CLOSED_GIG_STATUSES.has(gig.status);
  if (!isClosed) return { available: true, expiresAt: null, retentionDays: CHAT_RETENTION_DAYS };

  // Keep the same 15-day window from client closure through admin approval and payout.
  const closedAt = gig.clientClosedAt || gig.closedAt || gig.completedAt || gig.updatedAt;
  if (!closedAt) return { available: false, expiresAt: null, retentionDays: CHAT_RETENTION_DAYS };

  const expiresAt = new Date(new Date(closedAt).getTime() + CHAT_RETENTION_MS);
  return {
    available: expiresAt.getTime() > now.getTime(),
    expiresAt: expiresAt.toISOString(),
    retentionDays: CHAT_RETENTION_DAYS
  };
};

module.exports = { CHAT_RETENTION_DAYS, getChatAccess };
