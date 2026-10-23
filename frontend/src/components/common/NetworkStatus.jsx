import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  if (isOnline) return null
  return <div className="network-banner" role="status"><WifiOff size={16} /> You are offline. Live account actions need a connection.</div>
}
