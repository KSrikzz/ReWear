import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PRODUCT_IMAGES } from '../data/garments'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { apiRequest } from '../lib/api'
import { storageBucket, supabase } from '../lib/supabase'
import GarmentPassportModal from '../components/GarmentPassportModal'
import AIFitPreviewModal from '../components/AIFitPreviewModal'
import { MapPin, ChevronRight, ShieldCheck, Send, ThumbsUp, Calendar, CreditCard, QrCode, ArrowRight, Sparkles } from 'lucide-react'

function inputDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00`)
  date.setDate(date.getDate() + days)
  return inputDate(date)
}

function displayDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[month - 1]} ${year}`
}

export default function ProductDetail() {
  const { id } = useParams()
  const { account, allGarments, requestRental } = useMarketplace()
  const navigate = useNavigate()
  const garment = allGarments.find((item) => item.id === id) || allGarments[0]
  const availableSizes = useMemo(() => String(garment.size || '').split(',').map((size) => size.trim()).filter(Boolean), [garment.size])
  const productDraftKey = `rewear:${account?.id || 'guest'}:product:${id}`
  const [garmentReviews, setGarmentReviews] = useState([])
  const [reviewRating, setReviewRating] = useSessionDraft(`${productDraftKey}:review-rating`, '')
  const [reviewSort, setReviewSort] = useSessionDraft(`${productDraftKey}:review-sort`, 'recent')
  const [reviewsWithImages, setReviewsWithImages] = useSessionDraft(`${productDraftKey}:reviews-with-images`, false)
  const [reviewActionError, setReviewActionError] = useState('')
  const [today] = useState(() => inputDate(new Date()))
  const providerName = garment.ownerName || garment.designer || 'Clothing provider'
  const [fulfilment, setFulfilment] = useSessionDraft(`${productDraftKey}:fulfilment`, () => garment.pickupAvailable === false ? 'delivery' : 'pickup')
  const [deliveryPostcode, setDeliveryPostcode] = useSessionDraft(`${productDraftKey}:postcode`, '')
  const [duration, setDuration] = useSessionDraft(`${productDraftKey}:duration`, 1)
  const [selectedSize, setSelectedSize] = useSessionDraft(`${productDraftKey}:size`, '')
  const [requestError, setRequestError] = useState('')
  const [rentalProtection, setRentalProtection] = useSessionDraft(`${productDraftKey}:protection`, false)
    const [protectionTerms, setProtectionTerms] = useState(null)
  const [passportOpen, setPassportOpen] = useState(false)
  const [aiFitOpen, setAiFitOpen] = useState(false)
  const [pickupDate, setPickupDate] = useSessionDraft(`${productDraftKey}:pickup-date`, today)

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ sort: reviewSort, withImages: String(reviewsWithImages) })
    if (reviewRating) query.set('rating', reviewRating)
    apiRequest(`/api/garments/${id}/reviews?${query.toString()}`)
      .then((result) => {
        if (!active) return
        setGarmentReviews(result.map((review) => ({
          ...review,
          imageUrls: (review.imagePaths || []).map((path) => supabase?.storage.from(storageBucket).getPublicUrl(path).data.publicUrl).filter(Boolean),
        })))
      })
      .catch(() => { if (active) setGarmentReviews([]) })
    return () => { active = false }
  }, [id, reviewRating, reviewSort, reviewsWithImages])

  async function toggleReviewHelpful(reviewId) {
    setReviewActionError('')
    try {
      const response = await apiRequest(`/api/reviews/${reviewId}/helpful`, { method: 'POST' })
      setGarmentReviews((current) => current.map((review) => review.id === reviewId ? {
        ...review, helpfulByMe: response.helpful, helpfulCount: response.helpfulCount,
      } : review))
    } catch (error) {
      setReviewActionError(error.message || 'Your vote could not be saved.')
    }
  }

  const returnDate = addDays(pickupDate, duration)
  const rentalFee = Math.ceil(Number(garment.price) * duration)
  const total = rentalFee
  const isOwnListing = String(garment.ownerId || '') === String(account?.id || '')
  const canProcessRequest = Boolean(garment.ownerId)
  const dateIsValid = Boolean(pickupDate && pickupDate >= today)
  const fulfilmentOptions = useMemo(() => [
    ...(garment.pickupAvailable === false ? [] : [{ key: 'pickup', icon: '🏢', label: 'In-person pickup', sub: garment.distance || 'Coordinate with the clothing provider' }]),
    ...(garment.deliveryAvailable ? [{ key: 'delivery', icon: '⚡', label: 'Local delivery', sub: 'Delivery coverage is checked for your PIN code' }] : []),
  ], [garment.deliveryAvailable, garment.distance, garment.pickupAvailable])
  const deliveryPinIsValid = /^[A-Za-z0-9 -]{4,12}$/.test(deliveryPostcode.trim())

  useEffect(() => {
    apiRequest('/api/protection/terms').then(setProtectionTerms).catch(() => setProtectionTerms(null))
  }, [])

  useEffect(() => {
    if (selectedSize && !availableSizes.includes(selectedSize)) setSelectedSize('')
  }, [availableSizes, selectedSize, setSelectedSize])

  useEffect(() => {
    if (!pickupDate || pickupDate < today) setPickupDate(today)
  }, [pickupDate, setPickupDate, today])

  useEffect(() => {
    if (fulfilmentOptions.length && !fulfilmentOptions.some((option) => option.key === fulfilment)) {
      setFulfilment(fulfilmentOptions[0].key)
    }
  }, [fulfilment, fulfilmentOptions, setFulfilment])

  async function reserveOutfit() {
    if (!canProcessRequest || isOwnListing || garment.available === false || !selectedSize || !dateIsValid || !fulfilmentOptions.length || (fulfilment === 'delivery' && !deliveryPinIsValid)) return
    setRequestError('')
    try {
      await requestRental(garment, { rentalPrice: rentalFee, estimatedTotal: total, pickupDate, returnDate, duration, fulfilment, deliveryPostcode, selectedSize, rentalProtection })
      clearSessionDraft(`${productDraftKey}:fulfilment`); clearSessionDraft(`${productDraftKey}:postcode`); clearSessionDraft(`${productDraftKey}:duration`); clearSessionDraft(`${productDraftKey}:size`); clearSessionDraft(`${productDraftKey}:pickup-date`); clearSessionDraft(`${productDraftKey}:protection`)
      navigate(account?.role === 'business' ? '/business' : '/my-closet')
    } catch (error) {
      setRequestError(error.message || 'This rental request could not be saved.')
    }
  }

  const inputClass = "w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition"

  return (
    <div className="bg-[#FFF9F1] min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#6F747A] mb-8">
          <span className="cursor-pointer hover:text-[#781F37] transition">Occasionwear</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#18212B] font-semibold">{garment.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* LEFT: Product info (2 cols) */}
          <div className="lg:col-span-2 space-y-10">

            {/* Title & Category */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="px-3 py-1 rounded-lg bg-[#781F37]/10 text-[#781F37] text-xs font-bold uppercase tracking-wider">{garment.category || 'Occasion wear'}</span>
                <span className="text-[#6F747A]">•</span>
                <span className="text-[#197B5B] font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {garment.distance || 'Local pickup'}</span>
              </div>
              <h1 className="font-serif-couture text-4xl md:text-5xl font-black text-[#18212B]">{garment.name}</h1>

              {/* Seller Card */}
              <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-white rounded-2xl border border-[#E8E1D8] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#781F37] text-white flex items-center justify-center font-bold text-lg shrink-0">{providerName.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#18212B]">{providerName}</span>
                      <span className="px-2 py-0.5 bg-stone-100 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] rounded">{garment.ownerType === 'business' ? 'Business wardrobe' : garment.ownerType === 'personal' ? 'Community closet' : 'Sample listing'}</span>
                    </div>
                    <p className="text-sm text-[#6F747A]">{garment.distance || 'Local pickup'}{garment.rating ? ` · ${garment.rating} ★ from ${garment.reviewCount} review${garment.reviewCount === 1 ? '' : 's'}` : ' · No customer reviews yet'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Gallery */}
            <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden aspect-[3/4] sm:aspect-square md:aspect-[4/5] relative shadow-lg border border-[#E8E1D8]">
              <img src={garment.image || PRODUCT_IMAGES.main} alt={garment.name} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#197B5B]" /> {garment.condition || 'Excellent condition'}
                </span>
                <span className="bg-[#781F37] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <MapPin className="w-3 h-3" /> {garment.distance || 'Nearby'}
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#6F747A]">Retail Value</p>
                  <p className="text-lg font-bold text-[#18212B] line-through">₹{Number(garment.mrp || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#197B5B]">{duration}-Day Rental</p>
                  <p className="text-2xl font-black text-[#781F37]">₹{rentalFee.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Available sizes', value: availableSizes.join(', ') || 'Ask provider', sub: garment.fitMatch || 'Choose a size when requesting', color: 'text-[#197B5B]' },
                { label: 'Clothing type', value: garment.category || 'Occasion wear', sub: garment.condition || 'Condition details in listing', color: '' },
                { label: 'Rental price', value: `₹${Number(garment.price).toLocaleString('en-IN')} / day`, sub: `${duration}-day estimate ₹${rentalFee.toLocaleString('en-IN')}`, color: 'text-[#781F37]' },
                { label: 'Pickup area', value: garment.distance || 'Nearby', sub: garment.ownerName || garment.designer, color: 'text-[#197B5B]' },
              ].map((s) => (
                <div key={s.label} className="bg-white p-4 rounded-2xl border border-[#E8E1D8] shadow-sm flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block">{s.label}</span>
                  <span className={`text-lg font-bold block mt-1 ${s.color || 'text-[#18212B]'}`}>{s.value}</span>
                  <span className={`text-xs block mt-1 line-clamp-2 ${s.color ? s.color + ' font-semibold' : 'text-[#6F747A]'}`} title={s.sub}>{s.sub}</span>
                </div>
              ))}
            </div>

            {/* Care and Handover */}
            <div className="bg-white p-6 rounded-2xl border border-[#E8E1D8] shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#197B5B] mb-2 flex items-center gap-2">
                Care and handover
              </div>
              <p className="text-sm text-[#18212B] leading-relaxed">{garment.careInstructions || 'The provider has not added care or handover notes for this piece yet.'}</p>
            </div>

            {garment.description && (
              <div className="bg-white p-6 rounded-2xl border border-[#E8E1D8] shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89228] mb-2">From the wardrobe</div>
                <p className="text-sm text-[#18212B] leading-relaxed">{garment.description}</p>
              </div>
            )}

            {/* Product Activity */}
            <section aria-labelledby="product-activity-title">
              <div className="mb-6">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#197B5B] mb-2">Listing history</div>
                <h2 className="font-serif-couture text-2xl font-black text-[#18212B]" id="product-activity-title">Product activity</h2>
                <p className="text-sm text-[#6F747A] mt-1">Booked days use the requested rental length. Days out use handover and renter-return timestamps when available.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Completed rentals', value: garment.completedRentals || 0 },
                  { label: 'Booked rental days', value: garment.totalRentalDays || 0 },
                  { label: 'Recorded days out', value: garment.recordedCustodyDays || 0 },
                  { label: 'Last completed rental', value: garment.lastRentedAt ? new Date(garment.lastRentedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white p-4 rounded-2xl border border-[#E8E1D8] shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block">{stat.label}</span>
                    <strong className="text-xl text-[#18212B] block mt-1">{stat.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            {/* Reviews Section */}
            <section aria-labelledby="product-reviews-title">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89228] mb-2">Renter feedback</div>
                  <h2 className="font-serif-couture text-2xl font-black text-[#18212B]" id="product-reviews-title">Customer reviews</h2>
                </div>
                {garment.rating && <div className="text-2xl font-black text-[#C89228]">★ {garment.rating} <span className="text-sm font-medium text-[#6F747A]">({garment.reviewCount})</span></div>}
              </div>

              {/* Review Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1">Rating</label>
                  <select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#781F37]">
                    <option value="">All ratings</option>
                    {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1">Sort</label>
                  <select value={reviewSort} onChange={(e) => setReviewSort(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#781F37]">
                    <option value="recent">Most recent</option>
                    <option value="helpful">Most helpful</option>
                    <option value="highest-rated">Highest rated</option>
                    <option value="lowest-rated">Lowest rated</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#18212B] cursor-pointer self-end pb-1">
                  <input type="checkbox" checked={reviewsWithImages} onChange={(e) => setReviewsWithImages(e.target.checked)} className="accent-[#781F37] w-4 h-4 rounded" />With photos
                </label>
              </div>

              {reviewActionError && <p className="text-sm text-[#C93B3B] font-medium mb-4 p-3 bg-red-50 rounded-xl border border-red-100" role="alert">{reviewActionError}</p>}

              {garmentReviews.length ? (
                <div className="space-y-4">
                  {garmentReviews.map((review) => (
                    <article key={review.id} className="bg-white p-5 rounded-2xl border border-[#E8E1D8] shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <strong className="text-[#18212B]">{review.customerName}</strong>
                        <span className="text-xs text-[#6F747A]">★ {review.rating} · Verified renter · {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {(review.fit || review.condition) && <p className="text-xs text-[#197B5B] font-medium mb-2">{[review.fit && `Fit: ${review.fit}`, review.condition && `Condition: ${review.condition}`].filter(Boolean).join(' · ')}</p>}
                      {review.comment && <p className="text-sm text-[#18212B] leading-relaxed">{review.comment}</p>}
                      {review.imageUrls?.length > 0 && (
                        <div className="flex gap-3 mt-3">
                          {review.imageUrls.map((url, index) => <img key={url} src={url} alt={`Customer review photo ${index + 1}`} loading="lazy" className="w-20 h-20 rounded-xl object-cover border border-[#E8E1D8]" />)}
                        </div>
                      )}
                      <button type="button" onClick={() => toggleReviewHelpful(review.id)} aria-pressed={Boolean(review.helpfulByMe)} className={`mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${review.helpfulByMe ? 'bg-[#197B5B]/10 text-[#197B5B]' : 'bg-stone-100 text-[#6F747A] hover:bg-stone-200'}`}>
                        <ThumbsUp className="w-3.5 h-3.5" /> Helpful · {review.helpfulCount || 0}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6F747A] p-6 bg-white rounded-2xl border border-[#E8E1D8] text-center">No reviews match these filters yet. A renter can review this piece after the rental is completed.</p>
              )}
            </section>
          </div>

          {/* RIGHT: Checkout Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white p-6 rounded-3xl border border-[#E8E1D8] shadow-xl space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="font-serif-couture text-xl font-black text-[#18212B]">Rental request</h2>
                <span className="px-2.5 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] rounded-lg">checkout</span>
              </div>
              {!canProcessRequest && <p className="text-sm text-[#D89022] bg-[#D89022]/10 p-3 rounded-xl border border-[#D89022]/20">This sample listing has no connected seller account, so requests cannot be accepted. Choose a seller-owned listing to book.</p>}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block">Choose a size</label>
                  <button type="button" onClick={() => setAiFitOpen(true)} className="text-[10px] font-bold uppercase tracking-wider text-[#781F37] hover:underline flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Try with AI Fit Preview
                  </button>
                </div>
                <select required value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={inputClass}>
                  <option value="">Select your size</option>
                  {availableSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>

              {/* Fulfilment */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block">Choose Fulfilment Method</label>
                {fulfilmentOptions.map((opt) => (
                  <label key={opt.key} className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${fulfilment === opt.key ? 'border-[#197B5B] bg-[#197B5B]/5 ring-1 ring-[#197B5B]' : 'border-stone-200 bg-stone-50 hover:border-[#197B5B]/30'}`}>
                    <input type="radio" name="fulfilment" checked={fulfilment === opt.key} onChange={() => setFulfilment(opt.key)} className="accent-[#197B5B] w-4 h-4" />
                    <div>
                      <div className={`text-sm ${fulfilment === opt.key ? 'font-bold text-[#18212B]' : 'font-medium text-[#18212B]'}`}>{opt.icon} {opt.label}</div>
                      <p className="text-xs text-[#6F747A]">{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
              {fulfilment === 'delivery' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1.5">Delivery PIN code</label>
                  <input required maxLength={12} value={deliveryPostcode} onChange={(e) => setDeliveryPostcode(e.target.value)} placeholder="600040" className={inputClass} />
                  <small className="text-xs text-[#6F747A] mt-1 block">Your PIN code is shared with the owner only to coordinate this rental request.</small>
                </div>
              )}

              {/* Dates */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1.5">Pickup date</label>
                  <input type="date" min={today} required value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1.5">Return date</label>
                  <input type="date" required min={pickupDate ? addDays(pickupDate, 1) : today} value={returnDate} onChange={(e) => { const next = e.target.value; const days = Math.round((Date.parse(`${next}T12:00:00Z`) - Date.parse(`${pickupDate}T12:00:00Z`)) / 86400000); if (days >= 1 && days <= 30) setDuration(days) }} className={inputClass} />
                </div>
                <p className="text-xs text-[#6F747A] font-medium">{duration} day{duration === 1 ? '' : 's'} · ISO dates</p>

                <button type="button" onClick={() => setPassportOpen(true)} className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E8E1D8] bg-white hover:bg-stone-50 text-sm font-semibold text-[#18212B] transition group">
                  <span className="flex items-center gap-2"><QrCode className="w-4 h-4 text-[#197B5B]" /> View digital clothing passport</span>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#781F37] transition" />
                </button>
              </div>

              {/* Protection */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89228] mb-1">Optional order protection</div>
                <h3 className="font-bold text-[#18212B]">Rental Protection</h3>
                <p className="text-xs text-[#6F747A]">Helps with eligible accidental damage during this rental. This is a ReWear platform protection plan, not insurance.</p>
                <label className="flex items-center gap-2 text-sm font-medium text-[#18212B] cursor-pointer">
                  <input type="checkbox" checked={rentalProtection || Boolean(protectionTerms?.highValueProtectionRequired && Number(garment.mrp || 0) >= Number(protectionTerms?.highValueThreshold || Infinity))} disabled={Boolean(protectionTerms?.highValueProtectionRequired && Number(garment.mrp || 0) >= Number(protectionTerms?.highValueThreshold || Infinity))} onChange={(e) => setRentalProtection(e.target.checked)} className="accent-[#781F37] w-4 h-4 rounded" />
                  {protectionTerms?.highValueProtectionRequired && Number(garment.mrp || 0) >= Number(protectionTerms?.highValueThreshold || Infinity) ? 'Required for this high-value piece' : 'Add Rental Protection'}
                </label>
                {protectionTerms && (
                  <details className="text-xs text-[#6F747A]">
                    <summary className="cursor-pointer font-semibold text-[#781F37] hover:underline">View coverage and exclusions</summary>
                    <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-white rounded-xl border border-stone-100">
                      <div><strong className="block mb-1 text-[#18212B]">Covered</strong>{protectionTerms.covered.map((item) => <p key={item} className="text-[#197B5B]">✓ {item}</p>)}</div>
                      <div><strong className="block mb-1 text-[#18212B]">Not covered</strong>{protectionTerms.excluded.map((item) => <p key={item} className="text-[#C93B3B]">× {item}</p>)}</div>
                    </div>
                    <small className="block mt-2">Claims must be submitted within {protectionTerms.standardClaimWindowHours} hours of return.</small>
                  </details>
                )}
              </div>

              {/* Total */}
              <div className="pt-4 border-t border-[#E8E1D8]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-2">Rental estimate · {duration} days</p>
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-[#18212B]">Rental price</span>
                    <span className="text-xs text-[#6F747A] block">Other terms are confirmed with the provider</span>
                  </div>
                  <span className="font-serif-couture text-4xl font-black text-[#781F37]">₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* CTA */}
              <button type="button" disabled={!canProcessRequest || isOwnListing || garment.available === false || !selectedSize || !dateIsValid || !fulfilmentOptions.length || (fulfilment === 'delivery' && !deliveryPinIsValid)} onClick={reserveOutfit} className="w-full bg-[#781F37] hover:bg-[#5E182B] disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                {!canProcessRequest ? 'Seller account unavailable' : isOwnListing ? 'This is your listing' : garment.available === false ? 'Currently unavailable' : !selectedSize ? 'Choose a size' : !fulfilmentOptions.length ? 'No handover method available' : 'Continue to checkout'}
              </button>
              {requestError && <p className="text-sm text-[#C93B3B] font-medium p-3 bg-red-50 rounded-xl border border-red-100" role="alert">{requestError}</p>}
              <p className="text-xs text-[#6F747A] text-center">Checkout uses a simulated payment. No real money is moved.</p>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-3 text-center pt-4 border-t border-[#E8E1D8]">
                {[
                  { icon: ShieldCheck, label: 'Provider confirms' },
                  { icon: CreditCard, label: 'Payment' },
                  { icon: Calendar, label: 'Dates requested' },
                ].map((b) => (
                  <div key={b.label} className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">
                    <b.icon className="w-5 h-5 text-[#197B5B]" />
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {passportOpen && <GarmentPassportModal garment={garment} onClose={() => setPassportOpen(false)} />}
      {aiFitOpen && <AIFitPreviewModal garment={garment} onClose={() => setAiFitOpen(false)} onConfirmSize={(size) => { setSelectedSize(size); setAiFitOpen(false); }} />}
    </div>
  )
}

