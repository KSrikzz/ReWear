import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import PaymentModal from './PaymentModal'

export default function BusinessMembership({ planId = 'silver', membershipStatus = 'pending', onSelectPlan }) {
  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState('')
  const currentPlan = plans.find((plan) => plan.id === planId) || plans[0] || { name: 'Silver', description: 'Business membership', priceLabel: 'Loading…' }
  useEffect(() => { apiRequest('/api/memberships/plans').then(setPlans).catch((loadError) => setError(loadError.message || 'Membership plans could not be loaded.')) }, [])

  async function select(plan, method, succeed) {
    setSelecting(true)
    setError('')
    try {
      return await onSelectPlan(plan, method, succeed)
    } catch (selectionError) {
      setError(selectionError.message || 'The membership choice could not be saved.')
    } finally {
      setSelecting(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-6" aria-labelledby="membership-title">
      <div className="flex justify-between items-start mb-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-2">Business membership</span>
          <h2 className="font-serif-couture text-3xl text-[#18212B]" id="membership-title">{currentPlan.name} plan</h2>
          <p className="text-sm text-[#6F747A] mt-1">{currentPlan.description}</p>
        </div>
        <span className="font-serif-couture text-xl text-[#18212B]">{currentPlan.priceLabel}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <article className={`bg-[#FFF9F1] rounded-2xl border ${plan.id === planId ? 'border-[#781F37] ring-1 ring-[#781F37]' : 'border-[#E8E1D8]'} p-6 flex flex-col`} key={plan.id}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-xl font-serif-couture text-[#18212B]">{plan.name}</h3>
                <p className="text-xs text-[#6F747A] mt-1">{plan.priceLabel} · {plan.listingFeePercent}% fee</p>
              </div>
              {plan.id === planId && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#197B5B] text-white">Current</span>}
            </div>
            <p className="text-sm text-[#18212B] mt-4 mb-6 flex-grow">{plan.description}</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="text-sm text-[#6F747A] flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#18212B] mr-2"></span>
                  {feature}
                </li>
              ))}
            </ul>
            {(plan.id !== planId || membershipStatus !== 'active') && (
              <button 
                className="w-full bg-white border border-[#E8E1D8] hover:bg-[#FFF9F1] text-[#18212B] rounded-xl px-4 py-2 text-sm font-medium transition-colors" 
                type="button" 
                disabled={selecting} 
                onClick={() => setSelectedPlan(plan)}
              >
                {selecting ? 'Processing…' : plan.id === planId ? `Subscribe to ${plan.name}` : `Choose ${plan.name}`}
              </button>
            )}
          </article>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>}
      <p className="text-xs text-[#6F747A] mt-8 text-center max-w-2xl mx-auto">Membership lasts 30 days. Personal accounts do not have memberships.</p>
      {selectedPlan && (
        <PaymentModal 
          title={`${selectedPlan.name} membership`} 
          amount={selectedPlan.monthlyPrice} 
          summary={[{ label: `${selectedPlan.name} · one month`, value: `₹${Number(selectedPlan.monthlyPrice).toLocaleString('en-IN')}` }, { label: 'Platform fee on rentals', value: `${selectedPlan.listingFeePercent}%` }]} 
          onPay={(method, succeed) => select(selectedPlan.id, method, succeed)} 
          onClose={() => setSelectedPlan(null)} 
        />
      )}
    </section>
  )
}
