import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const dismissToast = useCallback(() => setToast(null), [])
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={'toast toast-' + toast.type} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.type === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button className="icon-button toast-close" type="button" onClick={dismissToast} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
