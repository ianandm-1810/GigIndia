import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import apiClient from '../../services/apiClient.js'
import { getErrorMessage } from '../../utils/errors.js'
import Button from '../common/Button.jsx'
import { useToast } from '../../context/ToastContext.jsx'

function loadCheckoutScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PaymentCheckout({ gig, onPaymentVerified }) {
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  async function startCheckout() {
    setLoading(true)
    try {
      const ready = await loadCheckoutScript()
      if (!ready) throw new Error('Razorpay Checkout could not load. Check your internet connection.')

      const { data: order } = await apiClient.post('/payments/create-order', { gigId: gig._id })
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'GIG INDIA',
        description: 'Payment for ' + gig.title,
        order_id: order.orderId,
        prefill: {
          name: gig.client?.name || '',
          email: gig.client?.email || '',
        },
        theme: { color: '#5b5cff' },
        handler: async (response) => {
          try {
            await apiClient.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            showToast('Payment verified. The backend recorded its status; student payout is not connected yet.')
            onPaymentVerified?.()
          } catch (error) {
            showToast(getErrorMessage(error, 'We could not verify this payment. Contact support before retrying.'), 'error')
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      })
      checkout.on('payment.failed', (event) => {
        showToast(event.error?.description || 'Payment did not complete.', 'error')
        setLoading(false)
      })
      checkout.open()
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not start checkout.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="payment-checkout">
      <p className="payment-note"><LockKeyhole size={16} /> Payment status is recorded after verification. Student payouts are not connected yet.</p>
      <Button type="button" onClick={startCheckout} loading={loading}>Continue to secure checkout</Button>
    </div>
  )
}
