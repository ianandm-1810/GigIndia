import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  async function installApp() {
    if (!installEvent) return
    await installEvent.prompt()
    setInstallEvent(null)
  }

  if (!installEvent || dismissed) return null

  return (
    <aside className="install-prompt" aria-label="Install GigIndia">
      <span><Download size={18} /> Add GigIndia to your home screen for quicker access.</span>
      <button type="button" className="button button-primary button-small" onClick={installApp}>Install</button>
      <button type="button" className="icon-button" onClick={() => setDismissed(true)} aria-label="Dismiss install suggestion"><X size={16} /></button>
    </aside>
  )
}
