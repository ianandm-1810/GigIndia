const statusLabels = {
  open: 'Open',
  'in-progress': 'In progress',
  submitted: 'Submitted',
  completed: 'Completed',
  disputed: 'In review',
  cancelled: 'Cancelled',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Declined',
  escrowed: 'Payment recorded',
  released: 'Release marked',
}

export default function Badge({ status = 'open' }) {
  return <span className={'status-badge status-' + status}>{statusLabels[status] || status}</span>
}
