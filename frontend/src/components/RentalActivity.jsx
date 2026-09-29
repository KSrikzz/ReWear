import { useState } from 'react'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { storageBucket, supabase } from '../lib/supabase'
import { ShoppingBag } from 'lucide-react'
import { useMarketplace } from '../context/useMarketplace'
import PaymentModal from './PaymentModal'
import RentalChat from './RentalChat'

const STATUS_LABELS = {
  requested: 'Requested',
  approved: 'Approved',
  confirmed: 'Confirmed',
  handover_pending: 'Handover pending',
  in_use: 'In use',
  return_pending: 'Return pending',
  disputed: 'Disputed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

const ACTIONS = {
  requested: {
    owner: [{ status: 'approved', label: 'Approve request' }, { status: 'declined', label: 'Decline' }],
    customer: [{ status: 'cancelled', label: 'Withdraw request' }],
  },
  approved: {
    owner: [{ status: 'cancelled', label: 'Cancel request' }],
    customer: [{ status: 'cancelled', label: 'Cancel request' }],
  },
  confirmed: {
    owner: [{ status: 'handover_pending', label: 'Hand over' }, { status: 'cancelled', label: 'Cancel request' }],
    customer: [{ status: 'cancelled', label: 'Cancel request' }],
  },
  handover_pending: {
    customer: [{ status: 'in_use', label: 'Confirm receipt' }],
  },
  in_use: {
    customer: [{ status: 'return_pending', label: 'Mark returned' }],
  },
  return_pending: {
    owner: [{ status: 'completed', label: 'Confirm return' }, { status: 'disputed', label: 'Report Damage' }],
  },
}

function formatDate(dateValue) {
  if (!dateValue) return ''
  const dateOnly = toDateOnly(dateValue)
  const date = dateOnly ? new Date(`${dateOnly}T12:00:00`) : new Date(dateValue)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toDateOnly(value) {
  if (!value) return ''
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function formatDateRange(start, end) {
  const startDate = toDateOnly(start)
  const endDate = toDateOnly(end)
  if (!startDate || !endDate) return 'Dates unavailable'
  const options = { day: 'numeric', month: 'short' }
  const startLabel = new Date(`${startDate}T12:00:00`).toLocaleDateString('en-IN', options)
  const endLabel = new Date(`${endDate}T12:00:00`).toLocaleDateString('en-IN', options)
  return `${startLabel} – ${endLabel}`
}

function todayInputValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function RentalActivity({ booking, account, onStatusChange, hasReviewForBooking = false, onReviewSubmit, existingClaim, onProtectionClaim, onClaimResponse }) {
  const { payRental } = useMarketplace()
  const reviewDraftKey = `rewear:${account.id}:review:${booking.id}`
  const [review, setReview] = useSessionDraft(reviewDraftKey, { rating: '5', fit: '', condition: '', comment: '' })
  const [reviewImages, setReviewImages] = useState([])
  const [reviewError, setReviewError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [claimReason, setClaimReason] = useState('')
  const [claimAmount, setClaimAmount] = useState('')
  const [claimFiles, setClaimFiles] = useState([])
  const [claimMessage, setClaimMessage] = useState('')
  const [paying, setPaying] = useState(false)
  const [claimBusy, setClaimBusy] = useState(false)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [ownerResponse, setOwnerResponse] = useState('')
  const [conditionPhotos, setConditionPhotos] = useState([])
  const isOwner = String(booking.ownerId || '') === String(account.id)
  const perspective = isOwner ? 'owner' : 'customer'
  const actions = ACTIONS[booking.status]?.[perspective] || []
  const pickupDate = toDateOnly(booking.pickupDate)
  const handoverIsReady = Boolean(pickupDate && pickupDate <= todayInputValue())
  const otherParty = isOwner
    ? `Requested by ${booking.customerName || 'a renter'}`
    : `From ${booking.ownerName || 'clothing provider'}`
  const progress = [
    booking.confirmedAt && `Confirmed ${formatDate(booking.confirmedAt)}`,
    booking.pickedUpAt && `Handed over ${formatDate(booking.pickedUpAt)}`,
    booking.returnedAt && `Renter marked returned ${formatDate(booking.returnedAt)}`,
    booking.completedAt && `Return confirmed ${formatDate(booking.completedAt)}`,
  ].filter(Boolean)

  async function submitReview(event) {
    event.preventDefault()
    setReviewError('')
    const paths = []
    try {
      if (reviewImages.length && !supabase) throw new Error('Photo upload is not configured.')
      for (const file of reviewImages) {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${account.id}/reviews/${globalThis.crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from(storageBucket).upload(path, file, {
          contentType: file.type, cacheControl: '3600', upsert: false,
        })
        if (uploadError) throw new Error(uploadError.message || 'A review photo could not be uploaded.')
        paths.push(path)
      }
      const error = await onReviewSubmit?.(booking.id, { ...review, rating: Number(review.rating), imagePaths: paths })
      if (error) throw new Error(error)
      clearSessionDraft(reviewDraftKey)
      setReviewImages([])
    } catch (error) {
      if (paths.length && supabase) await supabase.storage.from(storageBucket).remove(paths).catch(() => {})
      setReviewError(error.message || 'Feedback could not be submitted.')
    }
  }

  async function changeStatus(status) {
    setSavingAction(true)
    setActionError('')
    try {
      const needsPhotos = booking.highValueProtectionRequired && ['handover_pending', 'return_pending'].includes(status)
      if (needsPhotos && !conditionPhotos.length) throw new Error(status === 'handover_pending' ? 'Add a handover photo before continuing.' : 'Add a return photo before continuing.')
      const photoPaths = []
      for (const file of needsPhotos ? conditionPhotos : []) {
        if (!supabase) throw new Error('Photo upload is not configured.')
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${account.id}/rental-evidence/${globalThis.crypto.randomUUID()}.${extension}`
        const { error } = await supabase.storage.from(storageBucket).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (error) throw new Error(error.message || 'Rental evidence photo could not be uploaded.')
        photoPaths.push(path)
      }
      await onStatusChange(booking.id, status, photoPaths)
      setConditionPhotos([])
    } catch (error) {
      setActionError(error.message || 'That rental update could not be saved.')
    } finally {
      setSavingAction(false)
    }
  }

  async function submitClaim(event) {
    event.preventDefault()
    setClaimBusy(true); setClaimMessage('')
    const paths = []
    try {
      if (claimFiles.length && !supabase) throw new Error('Photo upload is not configured.')
      for (const file of claimFiles) {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${account.id}/claims/${globalThis.crypto.randomUUID()}.${extension}`
        const { error } = await supabase.storage.from(storageBucket).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (error) throw new Error(error.message || 'A claim photo could not be uploaded.')
        paths.push(path)
      }
      await onProtectionClaim(booking.id, { reason: claimReason.trim(), requestedAmount: Number(claimAmount), evidencePaths: paths })
      setClaimReason(''); setClaimAmount(''); setClaimFiles([]); setClaimMessage('Claim sent to the provider for response and platform review.')
    } catch (error) {
      if (paths.length && supabase) await supabase.storage.from(storageBucket).remove(paths).catch(() => {})
      setClaimMessage(error.message || 'Claim could not be submitted.')
    } finally { setClaimBusy(false) }
  }

  async function respondToClaim(event) {
    event.preventDefault(); setClaimBusy(true); setClaimMessage('')
    try { await onClaimResponse(existingClaim.id, ownerResponse.trim()); setOwnerResponse(''); setClaimMessage('Your response was recorded.') }
    catch (error) { setClaimMessage(error.message || 'Response could not be saved.') }
    finally { setClaimBusy(false) }
  }

  return (
    <article className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-6 flex flex-col md:flex-row gap-6">
      {booking.garmentImage ? (
        <img className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-xl shrink-0" src={booking.garmentImage} alt="" />
      ) : (
        <div className="w-24 h-24 md:w-32 md:h-32 bg-[#FFF9F1] rounded-xl flex items-center justify-center shrink-0">
          <ShoppingBag className="w-8 h-8 text-[#6F747A]" aria-hidden="true" />
        </div>
      )}
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
          <h2 className="font-serif-couture text-2xl text-[#18212B]">{booking.garmentName}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF9F1] text-[#18212B] border border-[#E8E1D8] whitespace-nowrap self-start">
            {STATUS_LABELS[booking.status] || 'Requested'}
          </span>
        </div>
        <p className="text-sm text-[#18212B] font-medium">{otherParty} · Size {booking.selectedSize} · ₹{Number(booking.rentalPrice).toLocaleString('en-IN')} rental · {booking.duration} day{booking.duration === 1 ? '' : 's'}</p>
        <p className="text-sm text-[#6F747A] mt-1">{formatDateRange(booking.pickupDate, booking.returnDate)} · {booking.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}</p>
        {isOwner && booking.fulfilment === 'delivery' && booking.customerPostcode && <p className="text-xs text-[#18212B] bg-[#FFF9F1] px-2 py-1 rounded mt-2 inline-block">Delivery PIN: {booking.customerPostcode}</p>}
        <p className="text-xs text-[#6F747A] mt-2">Rental price estimate: ₹{Number(booking.estimatedTotal).toLocaleString('en-IN')} · Requested {formatDate(booking.requestedAt)}</p>
        <p className="text-xs text-[#6F747A] mt-1">Payment {booking.paymentStatus || 'pending'} · platform fee ₹{Number(booking.platformFee || 0).toLocaleString('en-IN')}{booking.protectionEnabled ? ` · Rental Protection ₹${Number(booking.protectionPremium || 0).toLocaleString('en-IN')}` : ''}{Number(booking.deposit || 0) ? ` · refundable deposit ₹${Number(booking.deposit).toLocaleString('en-IN')}` : ''}</p>
        {progress.length > 0 && <p className="text-xs text-[#6F747A] mt-2 italic">{progress.join(' · ')}</p>}
        {isOwner && booking.status === 'completed' && (
          <p className="text-xs font-medium text-[#197B5B] mt-2">Estimated payout (simulated) ₹{Number(booking.estimatedOwnerPayout || 0).toLocaleString('en-IN')} · platform fee ₹{Number(booking.commissionAmount || 0).toLocaleString('en-IN')} on rental price</p>
        )}
        {booking.status === 'requested' && !booking.ownerId && !isOwner && (
          <p className="text-sm text-[#C89228] bg-yellow-50 p-2 rounded mt-3 border border-yellow-100">This listing has no linked provider account and cannot be confirmed.</p>
        )}
        {isOwner && booking.status === 'confirmed' && !handoverIsReady && (
          <p className="text-sm text-[#6F747A] bg-[#FFF9F1] p-2 rounded mt-3">Handover can be recorded from {formatDate(pickupDate)}.</p>
        )}
        {booking.highValueProtectionRequired && ((isOwner && booking.status === 'confirmed' && handoverIsReady) || (!isOwner && booking.status === 'in_use')) && (
          <label className="block mt-4">
            <span className="block text-sm font-medium text-[#18212B] mb-1">{isOwner ? 'Handover photos required' : 'Return photos required'}</span>
            <input required type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm text-[#6F747A] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#FFF9F1] file:text-[#18212B] hover:file:bg-[#E8E1D8] transition-colors" onChange={(event) => { const files=Array.from(event.target.files||[]); event.target.value=''; if(files.length>5 || files.some((file)=>file.size>12*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))){setActionError('Choose up to 5 JPG, PNG, or WebP photos under 12 MB each.');return} setActionError(''); setConditionPhotos(files) }} />
            <small className="block text-xs text-[#6F747A] mt-1">{conditionPhotos.length ? `${conditionPhotos.length} photo${conditionPhotos.length === 1 ? '' : 's'} selected` : 'Required to continue this high-value rental.'}</small>
          </label>
        )}
        {(actions.length > 0 || (!isOwner && booking.status === 'approved' && booking.paymentStatus !== 'successful')) && (
          <div className="flex flex-wrap gap-3 mt-4">
            {!isOwner && booking.status === 'approved' && booking.paymentStatus !== 'successful' && (
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-[#197B5B] hover:bg-[#136147] text-white"
                type="button"
                onClick={() => setPaying(true)}
              >
                Pay now
              </button>
            )}
            {actions.map((action, index) => (
              <button
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${index === 0 && (!(!isOwner && booking.status === 'approved')) ? 'bg-[#781F37] hover:bg-[#5E182B] text-white' : 'bg-white border border-[#E8E1D8] hover:bg-[#FFF9F1] text-[#18212B]'}`}
                key={action.status}
                type="button"
                disabled={savingAction || (action.status === 'handover_pending' && !handoverIsReady)}
                onClick={() => changeStatus(action.status)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {paying && (
          <PaymentModal
            title="Complete rental payment"
            amount={booking.estimatedTotal}
            summary={[
              { label: `${booking.garmentName} • ${booking.duration} day${booking.duration === 1 ? '' : 's'}`, value: `₹${Number(booking.rentalPrice).toLocaleString('en-IN')}` },
              { label: 'Platform fee', value: `₹${Number(booking.platformFee || 0).toLocaleString('en-IN')}` },
              ...(Number(booking.protectionPremium || 0) ? [{ label: 'Rental Protection', value: `₹${Number(booking.protectionPremium).toLocaleString('en-IN')}` }] : []),
              ...(Number(booking.deposit || 0) ? [{ label: 'Refundable deposit', value: `₹${Number(booking.deposit).toLocaleString('en-IN')}` }] : []),
              { label: `${formatDate(booking.pickupDate)} - ${formatDate(booking.returnDate)}`, value: '' }
            ]}
            onPay={async (method, succeed) => {
              const payment = await payRental(booking.id, method, succeed)
              return payment
            }}
            onClose={() => setPaying(false)}
          />
        )}
        {actionError && <p className="text-sm text-red-600 mt-2" role="alert">{actionError}</p>}

        {['confirmed', 'handover_pending', 'in_use', 'return_pending'].includes(booking.status) && (
          <RentalChat bookingId={booking.id} currentUserId={account.id} />
        )}

        {!isOwner && booking.protectionEnabled && ['return_pending', 'disputed'].includes(booking.status) && onProtectionClaim && (
          existingClaim ? (
            <p className="text-sm mt-4 p-3 bg-[#FFF9F1] rounded-xl border border-[#E8E1D8]">Protection claim: <strong className="text-[#18212B]">{existingClaim.status}</strong></p>
          ) : !showClaimForm ? (
            <div className="mt-6 border-t border-[#E8E1D8] pt-4">
              <button type="button" className="text-sm text-[#781F37] font-semibold hover:underline" onClick={() => setShowClaimForm(true)}>
                Report accidental damage
              </button>
            </div>
          ) : (
            <form className="mt-6 p-4 border border-[#E8E1D8] rounded-xl bg-white" onSubmit={submitClaim}>
              <h3 className="font-serif-couture text-xl text-[#18212B] mb-1">Report eligible accidental damage</h3>
              <p className="text-sm text-[#6F747A] mb-4">Submit within the protection claim window. The provider can respond and ReWear admin will review the claim.</p>
              
              <label className="block mb-3">
                <span className="block text-sm font-medium text-[#18212B] mb-1">What happened?</span>
                <textarea required maxLength="1200" rows="3" className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={claimReason} onChange={(event) => setClaimReason(event.target.value)} />
              </label>
              
              <label className="block mb-3">
                <span className="block text-sm font-medium text-[#18212B] mb-1">Requested amount · ₹</span>
                <input required type="number" min="1" max="100000" className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={claimAmount} onChange={(event) => setClaimAmount(event.target.value)} />
              </label>
              
              <label className="block mb-4">
                <span className="block text-sm font-medium text-[#18212B] mb-1">Evidence photos <small className="text-[#6F747A] font-normal">(optional · up to 3)</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm text-[#6F747A] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#FFF9F1] file:text-[#18212B] hover:file:bg-[#E8E1D8] transition-colors" onChange={(event) => { const files=Array.from(event.target.files||[]); event.target.value=''; if(files.length>3 || files.some((file)=>file.size>12*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))){setClaimMessage('Choose up to 3 JPG, PNG, or WebP photos under 12 MB each.');return} setClaimFiles(files); setClaimMessage('') }} />
              </label>
              
              {claimMessage && <p className="text-sm text-[#18212B] mb-3" role="status">{claimMessage}</p>}
              <button className="bg-white border border-[#E8E1D8] hover:bg-[#FFF9F1] text-[#18212B] px-4 py-2 rounded-xl text-sm font-medium transition-colors" disabled={claimBusy} type="submit">{claimBusy ? 'Sending...' : 'Submit protection claim'}</button>
              <button type="button" onClick={() => setShowClaimForm(false)} className="ml-3 px-4 py-2 text-sm font-medium text-stone-600 hover:text-[#18212B] hover:bg-stone-50 rounded-xl transition-colors" disabled={claimBusy}>Cancel</button>
            </form>
          )
        )}
        
        {isOwner && existingClaim?.status === 'pending' && onClaimResponse && (
          <form className="mt-6 p-4 border border-[#E8E1D8] rounded-xl bg-white" onSubmit={respondToClaim}>
            <h3 className="font-serif-couture text-xl text-[#18212B] mb-2">Respond to protection claim</h3>
            <p className="text-sm text-[#18212B] mb-4 bg-[#FFF9F1] p-3 rounded-xl">{existingClaim.reason}</p>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-[#18212B] mb-1">Your response</span>
              <textarea required maxLength="1000" rows="3" className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={ownerResponse} onChange={(event) => setOwnerResponse(event.target.value)} />
            </label>
            {claimMessage && <p className="text-sm text-[#18212B] mb-3" role="status">{claimMessage}</p>}
            <button className="bg-white border border-[#E8E1D8] hover:bg-[#FFF9F1] text-[#18212B] px-4 py-2 rounded-xl text-sm font-medium transition-colors" type="submit" disabled={claimBusy}>Send response</button>
          </form>
        )}
        
        {claimMessage && !(!isOwner && booking.protectionEnabled && ['return_pending', 'disputed'].includes(booking.status) && !existingClaim) && <p className="text-sm text-[#18212B] mt-4" role="status">{claimMessage}</p>}
        
        {!isOwner && ['return_pending', 'completed'].includes(booking.status) && onReviewSubmit && (
          hasReviewForBooking ? (
            <p className="text-sm text-[#197B5B] bg-emerald-50 px-3 py-2 rounded-xl mt-4 inline-block">Feedback submitted for this rental.</p>
          ) : (
            <form className="mt-6 p-4 border border-[#E8E1D8] rounded-xl bg-white" onSubmit={submitReview}>
              <h3 className="font-serif-couture text-xl text-[#18212B] mb-4">How was this piece?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <label className="block">
                  <span className="block text-sm font-medium text-[#18212B] mb-1">Rating</span>
                  <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={review.rating} onChange={(event) => setReview((current) => ({ ...current, rating: event.target.value }))}>
                    {[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} {rating === 1 ? 'star' : 'stars'}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-[#18212B] mb-1">Fit</span>
                  <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={review.fit} onChange={(event) => setReview((current) => ({ ...current, fit: event.target.value }))}>
                    <option value="">Not rated</option><option>As expected</option><option>Runs small</option><option>Runs large</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-sm font-medium text-[#18212B] mb-1">Condition on arrival</span>
                  <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={review.condition} onChange={(event) => setReview((current) => ({ ...current, condition: event.target.value }))}>
                    <option value="">Not rated</option><option>As described</option><option>Better than expected</option><option>Needs attention</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-sm font-medium text-[#18212B] mb-1">Feedback <small className="text-[#6F747A] font-normal">(optional)</small></span>
                  <textarea rows="2" maxLength="600" className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:ring-1 focus:ring-[#781F37] outline-none" value={review.comment} onChange={(event) => setReview((current) => ({ ...current, comment: event.target.value }))} placeholder="Share a helpful note for the next renter." />
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-sm font-medium text-[#18212B] mb-1">Review photos <small className="text-[#6F747A] font-normal">(optional · up to 3)</small></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm text-[#6F747A] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#FFF9F1] file:text-[#18212B] hover:file:bg-[#E8E1D8] transition-colors" onChange={(event) => {
                    const files = Array.from(event.target.files || [])
                    event.target.value = ''
                    if (files.length > 3) { setReviewError('Choose up to three photos.'); return }
                    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024)) {
                      setReviewError('Choose JPG, PNG, or WebP photos smaller than 12 MB each.')
                      return
                    }
                    setReviewError('')
                    setReviewImages(files)
                  }} />
                  {reviewImages.length > 0 && <small className="block text-xs text-[#6F747A] mt-1">{reviewImages.map((file) => file.name).join(', ')}</small>}
                </label>
              </div>
              {reviewError && <p className="text-sm text-red-600 mb-3" role="alert">{reviewError}</p>}
              <button className="bg-white border border-[#E8E1D8] hover:bg-[#FFF9F1] text-[#18212B] px-4 py-2 rounded-xl text-sm font-medium transition-colors" type="submit">Submit feedback</button>
            </form>
          )
        )}
      </div>
    </article>
  )
}







