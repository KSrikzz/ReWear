import { useState } from 'react'
import { QrCode, CreditCard, Landmark, Wallet, ShoppingBag, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'

const METHODS = [
  ['upi', 'UPI', QrCode],
  ['card', 'Card', CreditCard],
  ['net_banking', 'Net banking', Landmark],
  ['wallet', 'Wallet', Wallet],
]

export default function PaymentModal({ title = 'Secure checkout', amount, summary = [], onPay, onClose }) {
  const [method, setMethod] = useState('upi')
  const [state, setState] = useState('ready')
    const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')

  async function pay() {
    setState('processing')
    setError('')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 550))
      const result = await onPay(method, !failureMode)
      setPayment(result)
      setState(result.status === 'successful' ? 'successful' : 'failed')
    } catch (payError) {
      setError(payError.message || 'The payment could not be completed.')
      setState('ready')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
      <section className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-xl" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <header className="px-6 py-4 border-b border-[#E8E1D8] flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-[#18212B]">
            <ShoppingBag className="w-5 h-5 text-[#C89228]" /> 
            ReWear Pay
          </span>
          {state !== 'processing' && state !== 'successful' && (
            <button className="text-sm font-medium text-[#6F747A] hover:text-[#18212B] transition-colors" type="button" onClick={onClose}>Close</button>
          )}
        </header>
        <div className="p-6 overflow-y-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-2">Secure encrypted payment</span>
          <h2 className="text-2xl font-serif-couture text-[#18212B] mb-6" id="payment-title">
            {state === 'successful' ? 'Payment complete' : state === 'failed' ? 'Payment failed' : title}
          </h2>
          
          {state === 'processing' ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-[#6F747A]" role="status">
              <div className="w-8 h-8 border-4 border-[#E8E1D8] border-t-[#781F37] rounded-full animate-spin" />
              Processing your payment…
            </div>
          ) : null}
          
          {state === 'ready' && <>
            <div className="bg-[#FFF9F1] p-4 rounded-2xl mb-6 border border-[#E8E1D8]">
              {summary.map((row) => (
                <div key={row.label} className="flex justify-between items-center mb-2 text-sm text-[#18212B]">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-[#E8E1D8] text-base text-[#18212B]">
                <span>Total payable</span>
                <strong>₹{Number(amount || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
            
            <div className="space-y-3 mb-6" role="radiogroup" aria-label="Payment method">
              {METHODS.map(([id, label, Icon]) => (
                <button 
                  type="button" 
                  key={id} 
                  role="radio" 
                  aria-checked={method === id} 
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    method === id 
                      ? 'border-[#781F37] bg-stone-50 ring-1 ring-[#781F37]' 
                      : 'border-[#E8E1D8] bg-white hover:border-stone-300'
                  }`}
                  onClick={() => setMethod(id)}
                >
                  <Icon className={`w-5 h-5 ${method === id ? 'text-[#781F37]' : 'text-[#6F747A]'}`} />
                  <span className={`font-medium ${method === id ? 'text-[#18212B]' : 'text-[#6F747A]'}`}>{label}</span>
                </button>
              ))}
            </div>
            
            {error && <p className="text-[#781F37] bg-red-50 p-3 rounded-xl text-sm mb-6" role="alert">{error}</p>}
            
            <button className="w-full py-4 px-6 bg-[#781F37] hover:bg-[#5E182B] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2" type="button" onClick={pay}>
              Pay ₹{Number(amount || 0).toLocaleString('en-IN')} <ArrowRight className="w-5 h-5" />
            </button>
          </>}
          
          {state === 'successful' && (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle className="w-16 h-16 text-[#197B5B] mb-4" />
              <p className="text-[#18212B] font-medium mb-1">Your payment was successful.</p>
              <strong className="text-sm bg-stone-100 px-3 py-1 rounded mb-4 text-[#6F747A]">{payment?.transactionId}</strong>
              <small className="text-xs text-[#6F747A] mb-8 block">Your transaction has been securely processed.</small>
              <button className="w-full py-3 px-6 bg-[#781F37] hover:bg-[#5E182B] text-white rounded-xl font-medium transition-colors" type="button" onClick={onClose}>Continue</button>
            </div>
          )}
          
          {state === 'failed' && (
            <div className="flex flex-col items-center text-center py-8">
              <AlertCircle className="w-16 h-16 text-[#781F37] mb-4" />
              <p className="text-[#18212B] font-medium mb-1">The payment was declined.</p>
              <p className="text-sm text-[#6F747A] mb-4">Please try another payment method.</p>
              <strong className="text-sm bg-stone-100 px-3 py-1 rounded mb-4 text-[#6F747A]">{payment?.transactionId}</strong>
              <small className="text-xs text-[#6F747A] mb-8 block">Your account was not charged.</small>
              <button className="w-full py-3 px-6 bg-white border border-[#E8E1D8] text-[#18212B] hover:bg-stone-50 rounded-xl font-medium transition-colors" type="button" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
        <footer className="px-6 py-3 bg-stone-50 text-xs text-center text-[#6F747A] border-t border-[#E8E1D8]">
          REWEAR_SECURE_CHECKOUT · Powered by ReWear
        </footer>
      </section>
    </div>
  )
}
