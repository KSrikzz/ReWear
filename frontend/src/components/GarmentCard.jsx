import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplace } from '../context/useMarketplace'
import { Heart, Sparkles, MapPin, ShieldCheck, Shirt } from 'lucide-react'

export default function GarmentCard({ garment, matchReasons = [] }) {
  const { savedGarmentIds = [], toggleSavedGarment } = useMarketplace()
  const [saveError, setSaveError] = useState('')
  const isSaved = savedGarmentIds.includes(String(garment.id))

  const handleSave = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setSaveError('')
    try {
      await toggleSavedGarment(garment.id)
    } catch (error) {
      setSaveError(error.message || 'This piece could not be saved.')
    }
  }

  return (
    <article className="group bg-white rounded-2xl border border-[#E8E1D8] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col animate-fade-in">
      {/* Image Container with 4:5 Portrait Ratio */}
      <Link 
        to={`/product/${garment.id}`} 
        className="relative aspect-[4/5] bg-stone-100 overflow-hidden block" 
        aria-label={`View ${garment.name}`}
      >
        <img
          src={garment.image}
          alt={garment.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Top Badges / Indicators */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          <div className="flex flex-col gap-1.5">
            {garment.badgeColor === 'gold' ? (
              <div className="bg-[#C89228]/95 backdrop-blur-xs text-[#18212B] px-2.5 py-1 rounded-md text-xs font-bold shadow-sm tracking-wide">
                {garment.condition || 'Premium'}
              </div>
            ) : garment.badgeColor === 'primary' ? (
              <div className="bg-[#197B5B]/95 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-sm tracking-wide">
                {garment.condition || 'Verified'}
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur-xs text-[#18212B] px-2.5 py-1 rounded-md text-xs font-medium shadow-xs">
                Size {garment.size || 'Ask provider'}
              </div>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={handleSave}
            className="p-2 rounded-full bg-white/90 hover:bg-white text-stone-700 hover:text-[#781F37] shadow-sm pointer-events-auto transition cursor-pointer"
            title="Save to Wardrobe"
            aria-label={isSaved ? `Remove ${garment.name} from saved outfits` : `Save ${garment.name}`}
            aria-pressed={isSaved}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-[#781F37] text-[#781F37]' : ''}`} />
          </button>
        </div>

        {/* Bottom Image Overlay: Proximity & Verification */}
        <div className="absolute bottom-2 left-2 right-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 rounded-lg text-white text-xs flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-[#C89228]" />
            <span className="truncate">{garment.distance || 'Local pickup'}</span>
          </div>
          {garment.completedRentals > 5 && (
            <div className="flex items-center gap-1 text-[#197B5B] bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3 text-[#197B5B]" />
              <span>Trusted</span>
            </div>
          )}
        </div>
      </Link>

      {/* Card Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Brand Metadata */}
          <div className="flex items-center gap-1.5 text-xs text-[#6F747A] mb-1 font-medium">
            <span className="truncate">{garment.designer || garment.ownerName}</span>
            <span aria-hidden="true">·</span>
            <span>{garment.rating ? `★ ${garment.rating}` : 'No rating'}</span>
            <span aria-hidden="true">·</span>
            <span>{garment.reviewCount || 0} reviews</span>
          </div>

          {/* Product Title */}
          <Link to={`/product/${garment.id}`}>
            <h3 className="font-medium text-[#18212B] hover:text-[#781F37] transition-colors text-base line-clamp-1 cursor-pointer" title={garment.name}>
              {garment.name}
            </h3>
          </Link>

          {/* Match Reason Banner if provided */}
          {matchReasons.length > 0 && (
            <p className="text-xs text-[#197B5B] font-medium mt-1 line-clamp-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {matchReasons.join(' · ')}
            </p>
          )}

          {saveError && <p className="text-[10px] text-[#C93B3B] mt-1 font-medium" role="status">{saveError}</p>}

          {/* Pricing and Deposit Line */}
          <div className="mt-3 pt-3 border-t border-[#E8E1D8]">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-lg font-bold text-[#18212B]">
                  ₹{Number(garment.price).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#6F747A] ml-1">/ day</span>
              </div>
              
              {Number(garment.depositAmount) > 0 && (
                <div className="text-right">
                  <span className="text-xs text-[#6F747A]">Deposit: </span>
                  <span className="text-xs font-semibold text-[#197B5B]">
                    ₹{Number(garment.depositAmount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-stone-400 block leading-none">100% Refundable</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Link
            to={`/product/${garment.id}?action=passport`}
            className="px-2.5 py-2 text-xs font-semibold text-[#18212B] hover:text-[#781F37] bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Inspect Digital Clothing Passport"
          >
            <Shirt className="w-3.5 h-3.5 text-[#197B5B]" />
          </Link>

          <Link
            to={`/product/${garment.id}`}
            className="flex-1 py-2 px-3 bg-[#781F37] hover:bg-[#5E182B] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer text-center"
          >
            View & rent
          </Link>
        </div>
      </div>
    </article>
  )
}
