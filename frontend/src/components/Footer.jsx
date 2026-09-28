import { Link } from 'react-router-dom'
import { ShieldCheck, RefreshCw, Sparkles, HeartHandshake } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-[#18212B] text-[#FFF9F1] pt-16 pb-24 border-t border-[#E8E1D8]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Circular Impact Strip (Matching ReWear's styling) */}
        <div className="bg-white/5 rounded-2xl p-6 sm:p-8 border border-white/10 mb-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="font-serif-couture text-2xl sm:text-3xl font-bold text-[#C89228]">12,480 kg</div>
            <div className="text-xs text-stone-300 mt-1 uppercase tracking-wider font-semibold">CO₂ Emissions Avoided</div>
          </div>
          <div>
            <div className="font-serif-couture text-2xl sm:text-3xl font-bold text-[#197B5B]">9.4 Lakh L</div>
            <div className="text-xs text-stone-300 mt-1 uppercase tracking-wider font-semibold">Textile Water Saved</div>
          </div>
          <div>
            <div className="font-serif-couture text-2xl sm:text-3xl font-bold text-[#FFF9F1]">3,420+</div>
            <div className="text-xs text-stone-300 mt-1 uppercase tracking-wider font-semibold">Moments Celebrated</div>
          </div>
          <div>
            <div className="font-serif-couture text-2xl sm:text-3xl font-bold text-[#6D4AFF]">100%</div>
            <div className="text-xs text-stone-300 mt-1 uppercase tracking-wider font-semibold">Escrow Deposit Refund Rate</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Link to="/" className="font-serif-couture text-2xl font-black text-white hover:text-[#C89228] transition-colors">
                ReWear
              </Link>
              <span className="w-2 h-2 rounded-full bg-[#197B5B]" />
            </div>
            <p className="text-xs text-stone-300 leading-relaxed mb-4">
              Browse occasionwear, request a rental, or share a piece from your wardrobe.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#C89228]">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold italic">“Wear the moment. Not the price tag.”</span>
            </div>
          </div>

          {/* Quick Links: Explore */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#C89228] mb-4">Explore</h4>
            <nav className="flex flex-col space-y-2 text-xs text-stone-300" aria-label="Marketplace">
              <Link to="/" className="hover:text-white transition">Browse clothing</Link>
              <Link to="/ai-outfit-discovery" className="hover:text-white text-[#6D4AFF] font-medium transition">AI Outfit Discovery</Link>
              <Link to="/how-it-works" className="hover:text-white transition">How rentals work</Link>
            </nav>
          </div>

          {/* Quick Links: Your Wardrobe */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#197B5B] mb-4">Your Wardrobe</h4>
            <nav className="flex flex-col space-y-2 text-xs text-stone-300" aria-label="Your wardrobe">
              <Link to="/my-closet" className="hover:text-white transition">My rentals</Link>
              <Link to="/my-closet" className="hover:text-white transition">My listings</Link>
              <Link to="/register" className="hover:text-white transition">Create an account</Link>
            </nav>
          </div>

          {/* Trust & Deposit Protection */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#FFF9F1] mb-4">Trust & Security</h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#197B5B]" />
                <span>Segregated Escrow Deposit Vault</span>
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#197B5B]" />
                <span>Dual QR & OTP Handover Verification</span>
              </li>
              <li className="flex items-center gap-2">
                <HeartHandshake className="w-3.5 h-3.5 text-[#197B5B]" />
                <span>Photographic Condition Inspection</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-400 gap-4">
          <div>
            © 2026 ReWear · Clothing rental and sharing
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> · </span>
            Listing details are provided by clothing owners.
          </div>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <span>Refundable Deposit Guarantee</span>
            <span className="hidden sm:inline">·</span>
            <span>Digital Clothing Passport</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
