import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LOGO_URL } from '../data/garments'
import { useMarketplace } from '../context/useMarketplace'
import LocationPicker from './LocationPicker'
import { MapPin, Heart, Menu, X, ChevronDown, LogOut, User as UserIcon, Sparkles } from 'lucide-react'

export default function Header() {
  const { 
    account, 
    signOut, 
    allGarments, 
    savedGarmentIds = [], 
    selectedArea, 
    setSelectedArea 
  } = useMarketplace()
  
  const location = useLocation()
  const navigate = useNavigate()
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  
  const business = account?.role === 'business'
  const admin = account?.role === 'admin'
  const homePath = admin ? '/admin' : business ? '/business' : account ? '/' : '/login'
  
  const navItems = business
    ? [
        { to: '/business', label: 'Business studio' }
      ]
    : admin 
      ? [
          { to: '/admin', label: 'Admin panel' }
        ]
      : account
        ? [
            { to: '/', label: 'Explore' },
            { to: '/ai-outfit-discovery', label: 'AI Outfit Discovery', icon: Sparkles, highlight: true },
            { to: '/my-closet', label: 'My closet' },
          ]
        : []

  function leaveAccount() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FFF9F1]/95 backdrop-blur-md border-b border-[#E8E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo & Location */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link
                to={homePath}
                className="flex flex-col text-left group cursor-pointer"
                aria-label="ReWear home"
              >
                <div className="flex items-center gap-2">
                  <img src="/logo-r.png" alt="ReWear Logo" className="h-8 sm:h-10 object-contain" />
                  <img src="/brand-text.png" alt="ReWear" className="h-6 sm:h-8 object-contain" />
                  {business && <span className="ml-2 text-[10px] bg-stone-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Business</span>}
                </div>
                <span className="text-[10px] tracking-wider uppercase font-semibold text-[#6F747A] hidden sm:block mt-1">
                  Wear the moment. Not the price tag.
                </span>
              </Link>

              {['personal', 'business'].includes(account?.role) && (
                <button
                  onClick={() => setLocationPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100/80 hover:bg-stone-200/80 text-xs font-medium text-[#18212B] border border-[#E8E1D8] transition cursor-pointer"
                  title="Change your hyperlocal delivery & pickup area"
                  aria-label={`Pickup area: ${selectedArea || 'Any neighborhood'}`}
                >
                  <MapPin className="w-3.5 h-3.5 text-[#781F37]" />
                  <span className="font-semibold">{selectedArea || 'Any area'}</span>
                </button>
              )}
            </div>

            {/* Desktop Nav Items */}
            {navItems.length > 0 && (
              <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to || (item.to === '/my-closet' && location.pathname === '/seller-hub');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`relative text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 py-1 ${
                        isActive
                          ? 'text-[#781F37] font-semibold'
                          : 'text-[#18212B] hover:text-[#781F37]'
                      } ${item.highlight ? 'text-[#6D4AFF] hover:text-[#5535db]' : ''}`}
                    >
                      {Icon && <Icon className="w-4 h-4 text-[#6D4AFF]" />}
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#781F37] rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* User Account & Actions */}
            <div className="flex items-center gap-3">
              {account ? (
                <>
                  {['personal', 'business'].includes(account.role) && (
                    <Link
                      to="/browse?filter=saved"
                      className="relative p-2 rounded-full hover:bg-stone-200/60 text-[#18212B] transition cursor-pointer"
                      title="View saved outfits"
                      aria-label={`Saved outfits: ${savedGarmentIds.length}`}
                    >
                      <Heart className={`w-5 h-5 ${savedGarmentIds.length > 0 ? 'text-[#781F37] fill-[#781F37]' : ''}`} />
                      {savedGarmentIds.length > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-[#781F37] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {savedGarmentIds.length}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Profile Dropdown Pill */}
                  <div className="relative">
                    <button
                      onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E8E1D8] shadow-sm hover:border-[#781F37]/40 transition text-xs font-semibold cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#197B5B]/10 flex items-center justify-center text-[#197B5B]">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left hidden sm:block">
                        <div className="font-bold text-[#18212B] leading-none">
                          {admin ? 'Admin' : business ? account.businessName : account.name}
                        </div>
                        <div className="text-[10px] text-[#781F37] leading-none mt-0.5 uppercase tracking-wider font-semibold">
                          {account.role}
                        </div>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                    </button>

                    {roleDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-[#E8E1D8] py-2 z-50 animate-fade-in">
                        <div className="px-3 py-1.5 border-b border-stone-100 text-[11px] text-stone-500 truncate" title={account.email}>
                          {account.email}
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setRoleDropdownOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 transition cursor-pointer ${location.pathname === '/profile' ? 'text-[#781F37] font-semibold bg-[#FFF9F1]' : 'text-[#18212B]'}`}
                        >
                          <UserIcon className="w-4 h-4" />
                          Profile Settings
                        </Link>
                        <div className="border-t border-stone-100 mt-1 pt-1">
                          <button
                            onClick={leaveAccount}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#C93B3B] hover:bg-red-50 transition cursor-pointer text-left"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : location.pathname === '/register' ? (
                <Link to="/login" className="bg-stone-100 hover:bg-stone-200 text-[#18212B] px-4 py-2 rounded-lg text-xs font-semibold transition">
                  Sign in
                </Link>
              ) : (
                <Link to="/register" className="bg-[#781F37] hover:bg-[#5E182B] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition">
                  Create account
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              {navItems.length > 0 && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 md:hidden rounded-lg hover:bg-stone-100 text-[#18212B]"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && navItems.length > 0 && (
          <div className="md:hidden bg-[#FFF9F1] border-b border-[#E8E1D8] px-4 pt-2 pb-6 space-y-3 animate-fade-in">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-between text-left py-2.5 text-base font-medium text-[#18212B] hover:text-[#781F37] border-b border-stone-200/50"
              >
                <span>{item.label}</span>
                {item.highlight && <span className="text-xs text-[#6D4AFF] font-bold">AI Powered</span>}
              </Link>
            ))}
          </div>
        )}
      </header>
      
      {locationPickerOpen && (
        <LocationPicker 
          selectedArea={selectedArea || ''} 
          garments={allGarments} 
          onSelect={setSelectedArea} 
          onClose={() => setLocationPickerOpen(false)} 
        />
      )}
    </>
  )
}

