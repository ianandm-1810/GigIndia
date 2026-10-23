import { ShieldCheck } from 'lucide-react'
import PageHeading from '../components/common/PageHeading.jsx'
import { EmptyState } from '../components/common/StateMessage.jsx'

export default function AdminDashboardPage() {
  return (
    <div className="content-page">
      <PageHeading eyebrow="Platform operations" title="Admin tools are not connected yet." description="Your account is recognized as an admin, but the backend does not currently expose admin or dispute-management endpoints." />
      <EmptyState title="No admin actions available" message="Dispute resolution and platform moderation will appear here once their protected backend routes are implemented." />
      <p className="subtle-note"><ShieldCheck size={16} /> This route is restricted to accounts whose backend profile role is admin.</p>
    </div>
  )
}
