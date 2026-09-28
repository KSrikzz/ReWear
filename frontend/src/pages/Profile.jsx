import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { Store, User } from 'lucide-react'

export default function Profile() {
  const { account, updateAccount, payments = [], commissionLedger = [] } = useMarketplace()
  const profileDraftKey = `rewear:${account.id}:profile`
  const [form, setForm] = useSessionDraft(profileDraftKey, () => ({
    businessName: account.businessName || '',
    name: account.name || '',
    email: account.email || '',
    phone: account.phone || '',
    location: account.location || '',
    about: account.about || '',
  }))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const business = account.role === 'business'
  const administrator = account.role === 'admin'

  function update(field, value) {
    setMessage('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await updateAccount({ ...form, email: form.email.trim().toLowerCase() })
      clearSessionDraft(profileDraftKey)
      setMessage(result.emailChangePending ? 'Profile saved. Confirm your email change using the message Supabase sent you.' : result.emailChangeError ? `Profile saved. Email was not changed: ${result.emailChangeError}` : 'Your profile has been saved.')
    } catch (saveError) {
      setError(saveError.message || 'Your profile could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-[#18212B] focus:outline-none focus:ring-2 focus:ring-[#781F37] focus:border-transparent transition-all"
  const labelClass = "block text-sm font-medium text-[#18212B] mb-1.5"

  return (
    <section className="max-w-4xl mx-auto px-4 py-12 bg-[#FFF9F1] min-h-screen animate-fade-in">
      <form className="bg-white p-8 rounded-3xl border border-[#E8E1D8] shadow-sm mb-12" onSubmit={save}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#781F37] mb-2 block">Account settings</span>
            <h1 className="font-serif-couture text-3xl text-[#18212B] mb-2">{administrator ? 'Administrator profile' : business ? 'Business profile' : 'Personal profile'}</h1>
            <p className="text-sm text-[#6F747A]">Update the details people see when they rent from you.</p>
          </div>
          <div className="p-4 bg-[#FFF9F1] rounded-full text-[#781F37]">
            {business ? <Store className="w-8 h-8" /> : <User className="w-8 h-8" />}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {business && (
            <label className="col-span-1 md:col-span-2 block">
              <span className={labelClass}>Business or store name</span>
              <input required maxLength={80} className={inputClass} value={form.businessName} onChange={(event) => update('businessName', event.target.value)} />
            </label>
          )}
          <label className="block">
            <span className={labelClass}>{business ? 'Contact person' : 'Name'}</span>
            <input required maxLength={80} className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input required type="email" maxLength={120} className={inputClass} value={form.email} onChange={(event) => update('email', event.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input type="tel" maxLength={24} className={inputClass} value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Add a contact number" />
          </label>
          <label className="block">
            <span className={labelClass}>{business ? 'Pickup area' : 'Location'}</span>
            <input required maxLength={80} className={inputClass} value={form.location} onChange={(event) => update('location', event.target.value)} />
          </label>
          {business && (
            <label className="col-span-1 md:col-span-2 block">
              <span className={labelClass}>About your wardrobe <small className="text-[#6F747A] font-normal">(optional)</small></span>
              <textarea rows="4" maxLength={500} className={`${inputClass} resize-none`} value={form.about} onChange={(event) => update('about', event.target.value)} placeholder="Tell renters about your collection, designers, or pickup arrangements." />
            </label>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <button className="w-full sm:w-auto px-6 py-3 bg-[#781F37] text-white rounded-xl font-medium hover:bg-[#5a1729] transition-colors disabled:opacity-70" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          {message && <span className="text-sm font-medium text-[#197B5B]" role="status">{message}</span>}
          {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        </div>
        <Link className="text-sm text-[#781F37] hover:underline font-medium" to={administrator ? '/admin' : business ? '/business' : '/my-closet'}>Back to {administrator ? 'admin panel' : business ? 'business studio' : 'my closet'}</Link>
      </form>

      <section className="bg-white p-8 rounded-3xl border border-[#E8E1D8] shadow-sm mb-12" aria-labelledby="payments-title">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#781F37] mb-2 block">Account activity</span>
          <h2 className="font-serif-couture text-2xl text-[#18212B] mb-2" id="payments-title">Payment history</h2>
          <p className="text-sm text-[#6F747A]">ReWear payment gateway records.</p>
        </div>
        {payments.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[#E8E1D8]">
            <table className="w-full text-left text-sm text-[#18212B]">
              <thead className="bg-[#FFF9F1] border-b border-[#E8E1D8] text-xs uppercase text-[#6F747A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Transaction</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D8]">
                {payments.map((payment) => (
                  <tr key={payment.transactionId} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium">{payment.transactionId}</td><td className="px-4 py-3">{payment.paymentType}</td><td className="px-4 py-3">{payment.currency} {Number(payment.amount).toLocaleString('en-IN')}</td><td className="px-4 py-3">{String(payment.paymentMethod).replaceAll('_',' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${payment.status === 'success' ? 'bg-[#197B5B]/10 text-[#197B5B]' : 'bg-stone-100 text-[#6F747A]'}`}>{payment.status}</span>
                    </td>
                    <td className="px-4 py-3">{new Date(payment.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-[#6F747A] p-4 bg-[#FFF9F1] rounded-2xl border border-[#E8E1D8]">No transactions yet.</p>}
      </section>

      {!administrator && (
        <section className="bg-white p-8 rounded-3xl border border-[#E8E1D8] shadow-sm" aria-labelledby="fees-title">
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#781F37] mb-2 block">Provider activity</span>
            <h2 className="font-serif-couture text-2xl text-[#18212B]" id="fees-title">Platform fees and commissions</h2>
          </div>
          {commissionLedger.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#E8E1D8]">
              <table className="w-full text-left text-sm text-[#18212B]">
                <thead className="bg-[#FFF9F1] border-b border-[#E8E1D8] text-xs uppercase text-[#6F747A]">
                  <tr><th className="px-4 py-3 font-medium">Rental</th><th className="px-4 py-3 font-medium">Gross</th><th className="px-4 py-3 font-medium">Fee rate</th><th className="px-4 py-3 font-medium">Platform fee</th><th className="px-4 py-3 font-medium">Provider net</th><th className="px-4 py-3 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D8]">
                  {commissionLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium">{item.bookingId}</td><td className="px-4 py-3">₹{Number(item.gross).toLocaleString('en-IN')}</td><td className="px-4 py-3">{Number(item.commissionRate * 100).toFixed(1)}%</td><td className="px-4 py-3 text-red-600">₹{Number(item.fee).toLocaleString('en-IN')}</td><td className="px-4 py-3 font-medium text-[#197B5B]">₹{Number(item.ownerNet).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#197B5B]/10 text-[#197B5B]">{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-[#6F747A] p-4 bg-[#FFF9F1] rounded-2xl border border-[#E8E1D8]">Fees and commissions appear after completed rentals.</p>}
        </section>
      )}
    </section>
  )
}
