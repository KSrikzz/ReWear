import { useEffect, useMemo, useState } from 'react'
import { Camera, Upload, Shirt } from 'lucide-react'
import { GARMENTS } from '../data/garments'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { apiRequest } from '../lib/api'

const initialForm = {
  name: '',
  designer: '',
  category: 'Gown',
  condition: 'Excellent',
  price: '',
  mrp: '',
  depositAmount: '0',
  quantity: '1',
  size: [],
  distance: '',
  description: '',
  careInstructions: '',
  style: '',
  colour: '',
  occasions: [],
  pickupAvailable: true,
  deliveryAvailable: false,
  deliveryPostcodes: '',
  heightCm: '',
  chestCm: '',
  waistCm: '',
  hipCm: '',
  shoulderCm: '',
  inseamCm: '',
}

function formFromListing(listing) {
  return listing ? {
    name: listing.name || '', designer: listing.designer || '', category: listing.category || 'Gown',
    condition: listing.condition || 'Excellent', price: String(listing.price || ''), mrp: String(listing.mrp || ''),
    depositAmount: String(listing.depositAmount || 0),
    quantity: String(listing.quantity || 1),
    size: (listing.size || '').split(',').map((item) => item.trim()).filter(Boolean),
    distance: listing.distance || '', description: listing.description || '',
    careInstructions: listing.careInstructions || '',
    style: listing.style || '', colour: listing.colour || '', occasions: listing.occasions || [],
    pickupAvailable: listing.pickupAvailable !== false, deliveryAvailable: Boolean(listing.deliveryAvailable),
    deliveryPostcodes: (listing.deliveryPostcodes || []).join(', '),
    heightCm: listing.heightCm || '', chestCm: listing.chestCm || '', waistCm: listing.waistCm || '',
    hipCm: listing.hipCm || '', shoulderCm: listing.shoulderCm || '', inseamCm: listing.inseamCm || '',
  } : initialForm
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bitmap) => {
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('We could not prepare that image. Please choose another one.'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('We could not read that image. Please try again.'))
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.82)
    }).catch(() => reject(new Error('Choose a valid image file to continue.')))
  })
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size']

export default function GarmentListingForm({ onSave, ownerLabel, initialListing, onCancel }) {
  const { account, allGarments } = useMarketplace()
  const formDraftKey = `rewear:${account?.id || 'guest'}:listing:${initialListing?.id || 'new'}`
  const [form, setForm] = useSessionDraft(`${formDraftKey}:form`, () => {
    const savedForm = formFromListing(initialListing)
    return account?.role === 'personal' ? { ...savedForm, size: savedForm.size.slice(0, 1) } : savedForm
  })
  const [approximateLocation, setApproximateLocation] = useSessionDraft(`${formDraftKey}:location`, () => ({
    latitude: initialListing?.approximateLatitude ?? null,
    longitude: initialListing?.approximateLongitude ?? null,
  }))
  const [image, setImage] = useSessionDraft(`${formDraftKey}:image`, () => initialListing?.image || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pickupHubs, setPickupHubs] = useState([])
  const rentalPrice = Number(form.price) || 0
  const commissionRate = Number(account?.commissionRate ?? 0)
  const estimatedCommission = Math.round(rentalPrice * commissionRate)
  const availableSizeOptions = [...new Set([...SIZE_OPTIONS, ...form.size])]
  const selectedSizes = account?.role === 'personal' ? form.size.slice(0, 1) : form.size
  
  const locationSuggestions = useMemo(() => {
    const locations = new Map()
    const add = (value, details = {}) => {
      const normalized = String(value || '').trim()
      if (!normalized) return
      const key = normalized.toLocaleLowerCase()
      locations.set(key, { value: normalized, ...details })
    }
    GARMENTS.forEach((garment) => add(garment.distance, { label: 'Nearby ReWear area' }))
    allGarments.forEach((garment) => add(garment.distance, { label: 'Nearby ReWear area' }))
    pickupHubs.forEach((hub) => add(`${hub.area}, ${hub.city}`, {
      label: `${hub.name}${hub.postcode ? ` · PIN ${hub.postcode}` : ''}`,
      postcode: hub.postcode || '',
    }))
    return [...locations.values()].sort((left, right) => left.value.localeCompare(right.value))
  }, [allGarments, pickupHubs])
  
  const pickupAreaListId = `pickup-area-options-${account?.id || 'guest'}`
  const occasionOptions = ['Wedding', 'Reception', 'Party', 'College event', 'Business/formal event', 'Interview', 'Festival', 'Date night', 'Casual outing', 'Photoshoot']

  useEffect(() => {
    let active = true
    apiRequest('/api/locations/hubs').then((hubs) => { if (active) setPickupHubs(hubs) }).catch(() => {})
    return () => { active = false }
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleSize(size) {
    setForm((current) => ({ ...current, size: current.size.includes(size) ? current.size.filter((item) => item !== size) : [...current.size, size] }))
  }

  function updatePickupArea(value) {
    const matchedLocation = locationSuggestions.find((location) => location.value.toLocaleLowerCase() === value.trim().toLocaleLowerCase())
    setForm((current) => ({
      ...current,
      distance: value,
      deliveryPostcodes: matchedLocation?.postcode || '',
    }))
  }

  function toggleOccasion(occasion) {
    setForm((current) => ({ ...current, occasions: current.occasions.includes(occasion)
      ? current.occasions.filter((item) => item !== occasion)
      : [...current.occasions, occasion] }))
  }

  function useApproximateLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Your area text will still be shown.');
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setApproximateLocation({
        latitude: Number(coords.latitude.toFixed(2)),
        longitude: Number(coords.longitude.toFixed(2)),
      });
      setError('');
    }, () => setError('Location permission was not granted. Add just your neighborhood or pickup hub as the public area.'), {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    });
  }

  async function handleImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Choose an image smaller than 12 MB.')
      return
    }
    setError('')
    try {
      setImage(await compressImage(file))
    } catch (imageError) {
      setError(imageError.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!image) {
      setError('Add a clothing photo before publishing your listing.')
      return
    }
    if (!selectedSizes.length) {
      setError(account?.role === 'personal' ? 'Choose the available size.' : 'Choose at least one available size.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        designer: form.designer.trim() || ownerLabel,
        name: form.name.trim(),
        price: Number(form.price),
        mrp: Number(form.mrp || form.price),
        depositAmount: Number(form.depositAmount || 0),
        quantity: Math.max(1, Math.floor(Number(form.quantity) || 1)),
        size: selectedSizes.join(', '),
        fitMatch: `Sizes ${selectedSizes.join(', ')}`,
        rating: null,
        reviews: null,
        badgeColor: 'secondary',
        image,
        description: form.description.trim(),
        careInstructions: form.careInstructions.trim(),
        style: form.style,
        colour: form.colour,
        occasions: form.occasions,
        pickupAvailable: form.pickupAvailable,
        deliveryAvailable: form.deliveryAvailable,
        deliveryPostcodes: form.deliveryPostcodes.split(',').map((item) => item.trim()).filter(Boolean),
        ...Object.fromEntries(['heightCm', 'chestCm', 'waistCm', 'hipCm', 'shoulderCm', 'inseamCm'].map((field) => [field, form[field] ? Number(form[field]) : null])),
        approximateLatitude: approximateLocation.latitude,
        approximateLongitude: approximateLocation.longitude,
      })
      clearSessionDraft(`${formDraftKey}:form`)
      clearSessionDraft(`${formDraftKey}:location`)
      clearSessionDraft(`${formDraftKey}:image`)
      if (!initialListing) {
        setForm(initialForm)
        setImage('')
        setApproximateLocation({ latitude: null, longitude: null })
      }
    } catch (saveError) {
      setError(saveError.message || 'This listing could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <div className="flex justify-between items-end border-b border-[#E8E1D8] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">{initialListing ? 'Edit your inventory' : 'Create a listing'}</span>
          <h2 className="text-2xl font-serif-couture font-bold mt-1">{initialListing ? 'Update clothing details' : 'Add a piece to your wardrobe'}</h2>
        </div>
        <Camera className="w-8 h-8 text-[#781F37]" aria-hidden="true" />
      </div>

      <label className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-[#E8E1D8] rounded-2xl bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer overflow-hidden group">
        {image ? (
          <img src={image} alt="Preview of your clothing listing" className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center text-center p-6">
            <Upload className="w-10 h-10 text-[#6F747A] mb-3 group-hover:text-[#781F37] transition-colors" aria-hidden="true" />
            <strong className="text-sm font-bold text-[#18212B] mb-1">Upload a clothing photo</strong>
            <span className="text-xs text-[#6F747A]">JPG, PNG, or WebP · up to 12 MB</span>
          </div>
        )}
        <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImage} aria-label="Upload a clothing photo" />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-bold text-[#18212B]">Clothing name</span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" required maxLength={80} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Hand-embroidered festive lehenga" />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Category</span>
          <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" value={form.category} onChange={(event) => update('category', event.target.value)}>
            {['Gown', 'Lehenga', 'Suit & Sherwani', 'Saree', 'Other'].map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Designer or label <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" maxLength={60} value={form.designer} onChange={(event) => update('designer', event.target.value)} placeholder={ownerLabel} />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Rental price per day · ₹</span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" required type="number" min="1" max="1000000" value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="850" />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Original value · ₹</span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" type="number" min="0" max="10000000" value={form.mrp} onChange={(event) => update('mrp', event.target.value)} placeholder="Optional" />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Pieces in stock</span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" required type="number" min="1" max="10000" step="1" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} />
          <small className="text-xs text-[#6F747A]">Available pieces across the sizes on this listing.</small>
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Refundable deposit · ₹ <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" type="number" min="0" max="1000000" value={form.depositAmount} onChange={(event) => update('depositAmount', event.target.value)} />
        </label>
        
        {account?.role === 'personal' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-[#18212B]">Available size</span>
            <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" required value={selectedSizes[0] || ''} onChange={(event) => update('size', event.target.value ? [event.target.value] : [])}>
              <option value="">Choose one size</option>
              {availableSizeOptions.map((size) => <option key={size}>{size}</option>)}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-[#18212B]">Available sizes</span>
            <details className="group border border-stone-200 bg-stone-50 rounded-xl">
              <summary className="px-4 py-2.5 text-sm cursor-pointer list-none select-none flex justify-between items-center">
                {form.size.length ? form.size.join(', ') : 'Choose sizes'}
                <span className="text-xs text-[#781F37] font-bold group-open:hidden">Expand</span>
                <span className="text-xs text-[#781F37] font-bold hidden group-open:inline">Close</span>
              </summary>
              <div className="px-4 pb-3 pt-1 border-t border-stone-200 grid grid-cols-2 gap-2 mt-1">
                {availableSizeOptions.map((size) => (
                  <label key={size} className="flex items-center gap-2 text-sm text-[#18212B] cursor-pointer">
                    <input className="w-4 h-4 text-[#781F37] rounded border-stone-300 focus:ring-[#781F37]" type="checkbox" checked={form.size.includes(size)} onChange={() => toggleSize(size)} />
                    {size}
                  </label>
                ))}
              </div>
            </details>
          </label>
        )}
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Condition</span>
          <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" value={form.condition} onChange={(event) => update('condition', event.target.value)}>
            {['Like new', 'Excellent', 'Very good', 'Good'].map((condition) => <option key={condition}>{condition}</option>)}
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-bold text-[#18212B]">Public pickup area</span>
          <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" required maxLength={80} list={pickupAreaListId} value={form.distance} onChange={(event) => updatePickupArea(event.target.value)} placeholder="Start typing a neighborhood" autoComplete="address-level3" />
          <datalist id={pickupAreaListId}>
            {locationSuggestions.map((location) => <option key={location.value} value={location.value} label={location.label} />)}
          </datalist>
          <small className="text-xs text-[#6F747A]">Choose a suggested neighborhood or public pickup point. Never enter a home address.</small>
        </label>
        
        <fieldset className="flex flex-col gap-3 md:col-span-2">
          <legend className="text-sm font-bold text-[#18212B]">Suitable occasions</legend>
          <div className="flex flex-wrap gap-3">
            {occasionOptions.map((occasion) => (
              <label key={occasion} className={`px-4 py-2 rounded-full border text-sm font-medium cursor-pointer transition-colors ${form.occasions.includes(occasion) ? 'bg-[#781F37] border-[#781F37] text-white' : 'bg-stone-50 border-stone-200 text-[#18212B] hover:bg-stone-100'}`}>
                <input className="sr-only" type="checkbox" checked={form.occasions.includes(occasion)} onChange={() => toggleOccasion(occasion)} />
                {occasion}
              </label>
            ))}
          </div>
        </fieldset>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Style <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" value={form.style} onChange={(event) => update('style', event.target.value)}>
            <option value="">Choose a style</option>
            {['Classic', 'Minimal', 'Traditional', 'Modern', 'Streetwear', 'Luxury', 'Formal', 'Casual', 'Trendy', 'Vintage'].map((style) => <option key={style}>{style}</option>)}
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#18212B]">Primary colour <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <select className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" value={form.colour} onChange={(event) => update('colour', event.target.value)}>
            <option value="">Choose a colour</option>
            {['Burgundy', 'Red', 'Black', 'White', 'Ivory', 'Cream', 'Green', 'Blue', 'Pink', 'Purple', 'Yellow', 'Gold', 'Silver', 'Brown', 'Beige'].map((colour) => <option key={colour}>{colour}</option>)}
          </select>
        </label>
        
        <fieldset className="flex flex-col gap-2 md:col-span-2">
          <legend className="text-sm font-bold text-[#18212B]">Handover options</legend>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-[#18212B] cursor-pointer">
              <input className="w-4 h-4 text-[#781F37] rounded border-stone-300 focus:ring-[#781F37]" type="checkbox" checked={form.pickupAvailable} onChange={(event) => update('pickupAvailable', event.target.checked)} />
              Pickup available
            </label>
            <label className="flex items-center gap-2 text-sm text-[#18212B] cursor-pointer">
              <input className="w-4 h-4 text-[#781F37] rounded border-stone-300 focus:ring-[#781F37]" type="checkbox" checked={form.deliveryAvailable} onChange={(event) => update('deliveryAvailable', event.target.checked)} />
              Delivery available
            </label>
          </div>
          {form.deliveryAvailable && <small className="text-xs text-[#6F747A] mt-1">{form.deliveryPostcodes ? `Delivery requests will be checked against PIN ${form.deliveryPostcodes}.` : 'Delivery coverage can be confirmed directly with renters.'}</small>}
        </fieldset>
        
        <div className="flex flex-col gap-2 md:col-span-2 p-5 bg-stone-50 rounded-2xl border border-[#E8E1D8]">
          <span className="text-sm font-bold text-[#18212B]">Approximate map location <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <p className="text-xs text-[#6F747A]">For nearby discovery, ReWear rounds map points to a broad area before saving. Your exact device location is not stored or shown.</p>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <button className="px-4 py-2 bg-white border border-[#E8E1D8] text-[#18212B] rounded-xl text-xs font-bold hover:bg-stone-100 transition-colors shadow-sm" type="button" onClick={useApproximateLocation}>Set approximate location</button>
            {approximateLocation.latitude != null && (
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-[#197B5B]/10 text-[#197B5B] rounded-full text-xs font-bold">Approximate point added</span>
                <button className="text-xs font-bold text-[#781F37] hover:underline" type="button" onClick={() => setApproximateLocation({ latitude: null, longitude: null })}>Remove</button>
              </div>
            )}
          </div>
        </div>
        
        <details className="group md:col-span-2 border border-stone-200 bg-white rounded-2xl overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer list-none select-none flex justify-between items-center font-bold text-sm text-[#18212B] bg-stone-50 group-open:border-b border-stone-200">
            Optional garment measurements
            <span className="text-xs text-[#781F37] font-bold group-open:hidden">Expand</span>
            <span className="text-xs text-[#781F37] font-bold hidden group-open:inline">Close</span>
          </summary>
          <div className="p-5">
            <p className="text-xs text-[#6F747A] mb-4">Measurements help renters compare fit. Enter clothing measurements, in centimetres.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ['heightCm', 'Length / height'], ['chestCm', 'Chest'], ['waistCm', 'Waist'],
                ['hipCm', 'Hip'], ['shoulderCm', 'Shoulder'], ['inseamCm', 'Inseam'],
              ].map(([field, label]) => (
                <label className="flex flex-col gap-1.5" key={field}>
                  <span className="text-xs font-bold text-[#18212B]">{label} · cm</span>
                  <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37]" type="number" min="1" max="300" step="0.5" value={form[field]} onChange={(event) => update(field, event.target.value)} />
                </label>
              ))}
            </div>
          </div>
        </details>
        
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-bold text-[#18212B]">Details <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <textarea className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37] resize-y" rows="3" maxLength={500} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Share fit notes, fabric details, and what makes this piece special." />
        </label>
        
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-bold text-[#18212B]">Care and handover notes <small className="font-normal text-[#6F747A]">(optional)</small></span>
          <textarea className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#781F37] resize-y" rows="3" maxLength={500} value={form.careInstructions} onChange={(event) => update('careInstructions', event.target.value)} placeholder="For example: dry clean only; meet at the east entrance; return in the garment cover." />
          <small className="text-xs text-[#6F747A]">Renters see these notes before they request the piece.</small>
        </label>
      </div>

      {selectedSizes.length === 0 && <p className="text-sm text-[#781F37] font-semibold">{account?.role === 'personal' ? 'Select one available size.' : 'Select one or more available sizes.'}</p>}
      {error && <p className="text-sm text-[#781F37] bg-[#781F37]/10 p-4 rounded-xl font-medium" role="alert">{error}</p>}
      
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between border-t border-[#E8E1D8] pt-6">
        <div className="flex-1 max-w-lg">
          <p className="text-sm font-bold text-[#18212B] mb-1">Your listing will appear in the marketplace for renters.</p>
          {account?.role === 'personal' && rentalPrice > 0 && (
            <p className="text-sm text-[#6F747A] mb-2" aria-live="polite">
              For a one-day rental: estimated fee ₹{estimatedCommission.toLocaleString('en-IN')} ({Math.round(commissionRate * 100)}%) · you receive about <strong className="text-[#18212B]">₹{(rentalPrice - estimatedCommission).toLocaleString('en-IN')}</strong> before payment processing.
            </p>
          )}
          <p className="text-xs text-[#6F747A] leading-relaxed bg-[#FFF9F1] p-3 rounded-xl border border-[#E8E1D8]">Use only a neighborhood or verified pickup point here. Never enter a home address. Rental payments use a clearly labelled simulated checkout.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {initialListing && (
            <button className="px-6 py-3 bg-white border border-[#E8E1D8] text-[#18212B] rounded-xl font-bold text-sm hover:bg-stone-50 transition-colors shadow-sm flex-1 md:flex-none" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          )}
          <button className="px-6 py-3 bg-[#781F37] text-white rounded-xl font-bold text-sm hover:bg-[#5E182B] transition-colors shadow-sm flex items-center justify-center gap-2 flex-1 md:flex-none disabled:opacity-70 disabled:cursor-not-allowed" type="submit" disabled={saving}>
            <Shirt className="w-5 h-5" aria-hidden="true" />
            {saving ? 'Saving…' : initialListing ? 'Save changes' : 'Publish listing'}
          </button>
        </div>
      </div>
    </form>
  )
}
