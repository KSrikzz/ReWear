import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react'

export default function Login() {
  const { account, isLoading, loginAccount, authError } = useMarketplace()
  const navigate = useNavigate()
  const [email, setEmail] = useSessionDraft('rewear:login-email', '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-[#6F747A] font-medium" role="status">Restoring your ReWear session…</div>
  if (account) return <Navigate to={account.role === 'admin' ? '/admin' : account.role === 'business' ? '/business' : '/'} replace />

  async function submit(event) {
    event.preventDefault()
    setNotice('')
    setSaving(true)
    try {
      const signedInAccount = await loginAccount(email, password)
      clearSessionDraft('rewear:login-email')
      navigate(signedInAccount.role === 'admin' ? '/admin' : signedInAccount.role === 'business' ? '/business' : '/', { replace: true })
    } catch (loginError) {
      setNotice(loginError.message || 'We could not sign you in. Check your details and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col md:flex-row bg-[#FFF9F1]">
      {/* Left Hero Section */}
      <section className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[#18212B] text-white">
        <div className="max-w-md mx-auto md:mx-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#C89228] mb-4">
            ReWear · Chennai collection
          </div>
          <h1 className="font-serif-couture text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            Good to have <span className="text-[#C89228]">you back.</span>
          </h1>
          <p className="text-stone-300 text-sm md:text-base leading-relaxed mb-10">
            Sign in to find your next favourite look, manage your rentals, or keep your wardrobe moving.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-[#197B5B]" />
              <span>Explore verified occasionwear</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-[#197B5B]" />
              <span>Zero-waste circular fashion</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Form Section */}
      <section className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-white shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#6F747A] mb-2">Welcome back</div>
            <h2 className="font-serif-couture text-3xl font-black text-[#18212B]">Sign in to ReWear</h2>
            <p className="text-sm text-[#6F747A] mt-2">Use the email address connected to your account.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">
                Email address
              </label>
              <input
                required
                type="email"
                maxLength={120}
                autoComplete="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setNotice('') }}
                placeholder="you@example.com"
                className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#18212B] uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setNotice('') }}
                  placeholder="Enter your password"
                  className="w-full text-sm p-3 pr-12 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-[#18212B] transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {(notice || authError) && (
              <div className="p-4 bg-red-50 text-[#C93B3B] text-sm rounded-xl border border-red-100 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p>{notice || authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-[#781F37] hover:bg-[#5E182B] disabled:bg-stone-300 disabled:cursor-not-allowed text-white p-3.5 rounded-xl text-sm font-semibold shadow-sm transition mt-6"
            >
              {saving ? 'Signing in…' : 'Sign in'} 
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
            
            <p className="text-xs text-stone-500 text-center mt-4">
              Password recovery will be available when account authentication is connected.
            </p>
          </form>

          <p className="text-sm text-[#18212B] text-center mt-10">
            New to ReWear?{' '}
            <Link to="/register" className="text-[#781F37] font-semibold hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 pt-8 border-t border-stone-200">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#6F747A] mb-4">Demo Credentials (Hackathon)</h3>
            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={() => { setEmail('admin@rewear.com'); setPassword('hackathon2026'); setNotice('') }} className="flex items-center justify-between p-3 border border-stone-200 rounded-xl hover:border-[#781F37] hover:bg-stone-50 transition text-left">
                <div><span className="block text-sm font-bold text-[#18212B]">System Admin</span><span className="block text-xs text-stone-500">admin@rewear.com</span></div>
                <ArrowRight className="w-4 h-4 text-stone-400" />
              </button>
              <button type="button" onClick={() => { setEmail('customer@rewear.com'); setPassword('hackathon2026'); setNotice('') }} className="flex items-center justify-between p-3 border border-stone-200 rounded-xl hover:border-[#781F37] hover:bg-stone-50 transition text-left">
                <div><span className="block text-sm font-bold text-[#18212B]">Personal (Customer)</span><span className="block text-xs text-stone-500">customer@rewear.com</span></div>
                <ArrowRight className="w-4 h-4 text-stone-400" />
              </button>
              <button type="button" onClick={() => { setEmail('seller@rewear.com'); setPassword('hackathon2026'); setNotice('') }} className="flex items-center justify-between p-3 border border-stone-200 rounded-xl hover:border-[#781F37] hover:bg-stone-50 transition text-left">
                <div><span className="block text-sm font-bold text-[#18212B]">Business (Seller)</span><span className="block text-xs text-stone-500">seller@rewear.com</span></div>
                <ArrowRight className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <p className="text-[10px] text-stone-400 text-center mt-3">Click any account above to autofill credentials.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
