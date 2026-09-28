import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { User, Store, CheckCircle2, ArrowRight } from 'lucide-react'

const roles = [
  {
    id: 'personal',
    icon: User,
    title: 'Personal wardrobe',
    description: 'Find outfits to rent, and share pieces from your own closet.',
    action: 'I’m here to wear and share',
  },
  {
    id: 'business',
    icon: Store,
    title: 'Business wardrobe',
    description: 'Set up your clothing business and publish inventory for rent.',
    action: 'I’m here to manage a business',
  },
]

export default function Register() {
  const { account, isLoading, registerAccount, authError } = useMarketplace()
  const navigate = useNavigate()
  const [role, setRole] = useSessionDraft('rewear:register-role', '')
  const [form, setForm] = useSessionDraft('rewear:register-form', { name: '', businessName: '', email: '', phone: '', location: '' })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-[#6F747A] font-medium" role="status">Restoring your ReWear session…</div>
  if (account) return <Navigate to={account.role === 'admin' ? '/admin' : account.role === 'business' ? '/business' : '/'} replace />

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!role) {
      setError('Choose the kind of wardrobe you want to create.')
      return
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    const profile = {
      role,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      ...(role === 'business' ? { businessName: form.businessName.trim() } : {}),
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await registerAccount(profile, password)
      if (result.requiresConfirmation) {
        setNotice('Check your email to confirm your account. After confirming, sign in to finish setting up your ReWear space.')
        return
      }
      clearSessionDraft('rewear:register-role')
      clearSessionDraft('rewear:register-form')
      navigate(result.account?.role === 'admin' ? '/admin' : role === 'business' ? '/business' : '/', { replace: true })
    } catch (registrationError) {
      setError(registrationError.message || 'Your account could not be created. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col md:flex-row bg-[#FFF9F1]">
      {/* Left Hero Section */}
      <section className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[#18212B] text-white">
        <div className="max-w-md mx-auto md:mx-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#197B5B] mb-4">
            Circular occasionwear · Chennai collection
          </div>
          <h1 className="font-serif-couture text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            Make room for <span className="text-[#197B5B]">more moments.</span>
          </h1>
          <p className="text-stone-300 text-sm md:text-base leading-relaxed mb-10">
            A beautiful outfit deserves more than one night out. Create your ReWear space to find, rent, and share occasionwear.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-[#C89228]" />
              <span>Access hyperlocal wardrobes</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-[#C89228]" />
              <span>More wears, less waste</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Form Section */}
      <section className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 overflow-y-auto">
        <div className="max-w-xl w-full mx-auto">
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#6F747A] mb-2">Get started</div>
            <h2 className="font-serif-couture text-3xl font-black text-[#18212B]">Choose your ReWear space</h2>
            <p className="text-sm text-[#6F747A] mt-2">You can set up one kind of account here. Pick the option that fits you.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8" role="radiogroup" aria-label="Choose an account type">
            {roles.map((option) => {
              const isSelected = role === option.id;
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => { setRole(option.id); setError('') }}
                  className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                    isSelected 
                      ? 'border-[#197B5B] bg-[#197B5B]/5' 
                      : 'border-stone-200 hover:border-[#197B5B]/30 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-[#197B5B] text-white' : 'bg-stone-100 text-[#18212B]'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#197B5B]' : 'border-stone-300'}`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#197B5B]" />}
                    </div>
                  </div>
                  <h3 className={`font-bold mb-1 ${isSelected ? 'text-[#197B5B]' : 'text-[#18212B]'}`}>{option.title}</h3>
                  <p className="text-xs text-[#6F747A] leading-relaxed mb-3">{option.description}</p>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[#18212B]">{option.action}</div>
                </button>
              )
            })}
          </div>

          {role ? (
            <form onSubmit={submit} className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {role === 'business' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">Business or store name</label>
                    <input required maxLength={80} value={form.businessName} onChange={(event) => update('businessName', event.target.value)} placeholder="Your clothing studio" autoComplete="organization" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">{role === 'business' ? 'Your name' : 'Full name'}</label>
                  <input required maxLength={80} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Name" autoComplete="name" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">Email address</label>
                  <input required type="email" maxLength={120} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" autoComplete="email" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">Password</label>
                  <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">Phone <span className="text-stone-400 font-normal normal-case">(optional)</span></label>
                  <input type="tel" maxLength={24} value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91" autoComplete="tel" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">{role === 'business' ? 'Store area' : 'Your area'}</label>
                  <input required maxLength={80} value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Adyar, Chennai" autoComplete="address-level2" className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition" />
                </div>
              </div>

              {(error || authError) && (
                <div className="p-4 bg-red-50 text-[#C93B3B] text-sm rounded-xl border border-red-100 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p>{error || authError}</p>
                </div>
              )}
              {notice && (
                <div className="p-4 bg-emerald-50 text-[#197B5B] text-sm rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p>{notice}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#781F37] hover:bg-[#5E182B] disabled:bg-stone-300 disabled:cursor-not-allowed text-white p-3.5 rounded-xl text-sm font-semibold shadow-sm transition mt-6"
              >
                {saving ? 'Creating account…' : role === 'business' ? 'Create business space' : 'Create personal space'}
                {!saving && <ArrowRight className="w-4 h-4" />}
              </button>
              
              <p className="text-xs text-stone-500 text-center mt-4">
                Your account details can be updated from your ReWear space.
              </p>
            </form>
          ) : (
            <p className="text-sm text-stone-500 text-center py-8">Select an option to continue with registration.</p>
          )}

          <p className="text-sm text-[#18212B] text-center mt-10">
            Already have an account?{' '}
            <Link to="/login" className="text-[#781F37] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
