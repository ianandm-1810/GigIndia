const statusLabels = {
  open: 'Open',
  'in-progress': 'In progress',
  submitted: 'Submitted',
  'pending-admin-approval': 'Awaiting admin payout approval',
  'payout-processing': 'Payout processing',
  completed: 'Completed',
  disputed: 'In review',
  cancelled: 'Cancelled',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Declined',
  blocked: 'Blocked',
  withdrawn: 'Withdrawn',
  escrowed: 'Payment held',
  paid: 'Payment received',
  releasing: 'Payout processing',
  released: 'Paid out',
}

export default function Badge({ status = 'open' }) {
  return <span className={'status-badge status-' + status}>{statusLabels[status] || status}</span>
}
