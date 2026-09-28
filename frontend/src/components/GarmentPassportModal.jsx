import { useEffect } from 'react'
import { X, Shirt } from 'lucide-react'

function valueOrPending(value) {
  return value === null || value === undefined || String(value).trim() === '' ? 'Not provided' : value
}

export default function GarmentPassportModal({ garment, onClose }) {
  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const fields = [
    ['Listed by', garment.ownerName || garment.designer],
    ['Category', garment.category],
    ['Size options', garment.size],
    ['Condition', garment.condition],
    ['Pieces listed', garment.quantity],
    ['Rental price', `₹${Number(garment.price || 0).toLocaleString('en-IN')} / day`],
    ['Refundable deposit', Number(garment.depositAmount) > 0 ? `₹${Number(garment.depositAmount).toLocaleString('en-IN')}` : 'None listed'],
    ['Pickup area', garment.distance],
    ['Style', garment.style],
    ['Colour', garment.colour],
    ['Completed rentals', garment.completedRentals ?? 0],
    ['Renter rating', garment.rating ? `${garment.rating} / 5 (${garment.reviewCount} reviews)` : 'No reviews yet'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="bg-white rounded-3xl border border-[#E8E1D8] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="passport-title">
        <div className="relative">
          <div className="h-48 overflow-hidden"><img src={garment.image} alt={garment.name} className="w-full h-full object-cover" /></div>
          <button className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white transition-colors" type="button" onClick={onClose} aria-label="Close clothing passport">
            <X className="w-5 h-5 text-[#18212B]" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#781F37] mb-2"><Shirt className="w-4 h-4" /> Listing details</span>
            <h2 className="font-serif-couture text-2xl text-[#18212B] mb-1" id="passport-title">Digital clothing passport</h2>
            <p className="text-sm text-[#6F747A] mb-3">A snapshot of the provider's listing and rental history.</p>
            <strong className="text-lg text-[#18212B]">{garment.name}</strong>
          </div>
          <dl className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6">
            {fields.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-[#6F747A] uppercase tracking-wider mb-1">{label}</dt>
                <dd className="text-sm text-[#18212B] font-medium">{valueOrPending(value)}</dd>
              </div>
            ))}
          </dl>
          {garment.careInstructions && (
            <div className="mb-6 p-4 bg-[#FFF9F1] rounded-2xl border border-[#E8E1D8]">
              <strong className="block text-sm text-[#18212B] mb-1">Care and handover</strong>
              <p className="text-sm text-[#6F747A]">{garment.careInstructions}</p>
            </div>
          )}
          <p className="text-xs text-[#6F747A] mb-6 text-center">Listing details are supplied by the provider. Rental history and ratings are derived from ReWear records.</p>
          <button className="w-full py-3 px-4 bg-[#781F37] text-white rounded-xl font-medium hover:bg-[#5a1729] transition-colors" type="button" onClick={onClose}>Close passport</button>
        </div>
      </section>
    </div>
  )
}
