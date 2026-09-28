import { Link } from 'react-router-dom'
import { MapPin, Ruler, Check } from 'lucide-react'

export default function DiscoveryResultCard({ item, isBestMatch = false }) {
  const garment = item.garment
  const fit = item.fitConfidence || { level: 'unavailable', explanation: 'Fit confidence unavailable.' }
  const fitLabels = { high: 'High fit confidence', medium: 'Medium fit confidence', low: 'Low fit confidence', unavailable: 'Fit details unavailable' }

  return (
    <article className={`bg-white rounded-2xl border ${isBestMatch ? 'border-[#C89228] shadow-md ring-1 ring-[#C89228]' : 'border-[#E8E1D8] shadow-sm'} overflow-hidden flex flex-col h-full transition-all hover:shadow-md`}>
      <Link to={`/product/${garment.id}`} className="relative aspect-[3/4] block overflow-hidden bg-stone-100 group" aria-label={`View ${garment.name}`}>
        <img src={garment.image} alt={garment.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-[#18212B] text-xs font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
          {item.matchPercent}% <small className="text-[10px] font-normal uppercase tracking-wider text-[#6F747A]">Match</small>
        </span>
        {isBestMatch && (
          <span className="absolute top-3 right-3 bg-[#C89228] text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
            Best match
          </span>
        )}
      </Link>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div>
            <p className="text-xs text-[#6F747A] font-medium mb-1">{garment.designer || garment.ownerName}</p>
            <h3 className="text-lg font-serif-couture text-[#18212B] leading-tight line-clamp-2">
              <Link to={`/product/${garment.id}`} className="hover:text-[#781F37] transition-colors">{garment.name}</Link>
            </h3>
          </div>
          <span className="shrink-0 bg-[#FFF9F1] border border-[#E8E1D8] text-[#18212B] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
            {garment.condition || 'Condition listed'}
          </span>
        </div>
        
        <div className="space-y-2 mb-4 text-sm text-[#18212B]">
          <div className="flex justify-between items-center">
            <span className="font-medium">Est. ₹{Number(item.estimatedRentalPrice ?? Number(garment.price) * Number(item.estimatedDays || 1)).toLocaleString('en-IN')} / {item.estimatedDays || 1} days</span>
            {garment.rating ? (
              <span className="flex items-center gap-1 text-[#C89228] font-medium">
                ★ {garment.rating} <span className="text-[#6F747A] font-normal text-xs ml-1">({garment.reviewCount})</span>
              </span>
            ) : (
              <span className="text-xs text-[#6F747A]">No reviews yet</span>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-[#6F747A]">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> 
              {item.distanceKm != null ? `About ${Number(item.distanceKm).toFixed(1)} km away` : garment.distance || 'Area not listed'}
            </span>
            <span className={item.availableForDates === true ? 'text-[#197B5B] font-medium' : ''}>
              {item.availableForDates === true ? 'Available for your dates' : 'Choose dates to check availability'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {garment.pickupAvailable && <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-[#6F747A] px-2 py-1 rounded-md">Pickup</span>}
          {garment.deliveryAvailable && <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-[#6F747A] px-2 py-1 rounded-md">Delivery</span>}
        </div>
        
        <div className="mt-auto pt-4 border-t border-[#E8E1D8]">
          <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${
            fit.level === 'high' ? 'text-[#197B5B]' : 
            fit.level === 'medium' ? 'text-[#C89228]' : 
            fit.level === 'low' ? 'text-[#781F37]' : 'text-[#6F747A]'
          }`} title={fit.explanation}>
            <Ruler className="w-3.5 h-3.5" />
            {fitLabels[fit.level] || fitLabels.unavailable}
          </div>
          {fit.level !== 'unavailable' && <p className="text-xs text-[#6F747A] line-clamp-2 mb-3">{fit.explanation}</p>}
          
          {!!item.reasons?.length && (
            <div className="mb-4 bg-[#FFF9F1] p-3 rounded-xl border border-[#E8E1D8]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#18212B] mb-2">Why this is recommended</p>
              <ul className="space-y-1.5">
                {item.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-1.5 text-xs text-[#6F747A]">
                    <Check className="w-3.5 h-3.5 text-[#197B5B] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <Link className="block w-full py-2.5 px-4 bg-[#781F37] hover:bg-[#5E182B] text-white text-sm font-medium text-center rounded-xl transition-colors mt-4" to={`/product/${garment.id}`}>
            View rental details
          </Link>
        </div>
      </div>
    </article>
  )
}
