import { useEffect, useMemo, useState, useRef } from 'react'
import { Sparkles, ShieldCheck, MapPin, Ruler, SlidersHorizontal, Locate, ImagePlus, Shirt, Map as MapIcon, X } from 'lucide-react'
import DiscoveryResultCard from '../components/DiscoveryResultCard'
import LocalityMap from '../components/LocalityMap'
import { useMarketplace } from '../context/useMarketplace'
import { hasSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { useSearchParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'

const INITIAL_FORM = {
  query: '', occasion: '', eventDate: '', rentalStartDate: '', rentalEndDate: '', category: '', size: '',
  style: '', colour: '', budgetMin: '', budgetMax: '', area: '', postcode: '', distanceKm: '', customDistanceKm: '',
  fulfilment: '', condition: '', minimumRating: '', premiumOnly: false, transactionType: 'rental', sort: 'best-match',
}

const OCCASIONS = ['Wedding', 'Reception', 'Party', 'College event', 'Business/formal event', 'Interview', 'Festival', 'Date night', 'Casual outing', 'Photoshoot', 'Other']
const CATEGORIES = ['Dresses', 'Blazers', 'Suits', 'Sarees', 'Kurtas', 'Shirts', 'Trousers', 'Jackets', 'Ethnic wear', 'Formal wear', 'Accessories']
const STYLES = ['Classic', 'Minimal', 'Traditional', 'Modern', 'Streetwear', 'Luxury', 'Formal', 'Casual', 'Trendy', 'Vintage']
const COLOURS = ['Burgundy', 'Red', 'Black', 'White', 'Ivory', 'Cream', 'Green', 'Blue', 'Pink', 'Purple', 'Yellow', 'Gold', 'Silver', 'Brown', 'Beige']
const MEASURE_FIELDS = [
  ['heightCm', 'Height'], ['chestCm', 'Chest'], ['waistCm', 'Waist'],
  ['hipCm', 'Hip'], ['shoulderCm', 'Shoulder'], ['inseamCm', 'Inseam'],
]

function prepareImage(file) {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bitmap) => {
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('This image could not be prepared.')); return }
        if (blob.size > 2 * 1024 * 1024) { reject(new Error('Choose a smaller inspiration image (under 2 MB after compression).')); return }
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('This image could not be read.'))
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.78)
    }).catch(() => reject(new Error('Choose a valid JPG, PNG, or WebP image.')))
  })
}

function numeric(value) {
  return value === '' || value == null ? null : Number(value)
}

function localTodayValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function AIStyleMatch() {
  const {
    account,
    discoverOutfits,
    getDiscoveryPreferences,
    saveDiscoveryPreferences,
    clearDiscoveryPreferences,
  } = useMarketplace()
  const discoveryDraftKey = `rewear:${account.id}:outfit-discovery`
  const formDraftKey = `${discoveryDraftKey}:form`
  const [form, setForm] = useSessionDraft(formDraftKey, INITIAL_FORM)
  const [draftRestored] = useState(() => hasSessionDraft(formDraftKey))
  const [measurements, setMeasurements] = useSessionDraft(`${discoveryDraftKey}:measurements`, () => Object.fromEntries(MEASURE_FIELDS.map(([key]) => [key, ''])))
  const [imageData, setImageData] = useSessionDraft(`${discoveryDraftKey}:image`, '')
  const [imageError, setImageError] = useState('')
  const [imageConsent, setImageConsent] = useSessionDraft(`${discoveryDraftKey}:image-consent`, false)
  const [imageAnalysisRequested, setImageAnalysisRequested] = useSessionDraft(`${discoveryDraftKey}:image-analysis`, false)
  const [approximateLocation, setApproximateLocation] = useSessionDraft(`${discoveryDraftKey}:location`, null)
  const [locationMessage, setLocationMessage] = useState('')
  const [result, setResult] = useSessionDraft(`${discoveryDraftKey}:result`, null)
  const [hubs, setHubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preferencesError, setPreferencesError] = useState('')
  const [savePreferences, setSavePreferences] = useSessionDraft(`${discoveryDraftKey}:save-preferences`, false)
  const [savedPreferences, setSavedPreferences] = useState(false)
  const [activeSection, setActiveSection] = useSessionDraft(`${discoveryDraftKey}:active-section`, 'all')
  const [mapView, setMapView] = useSessionDraft(`${discoveryDraftKey}:map-view`, false)
  const [selectedMapItem, setSelectedMapItem] = useSessionDraft(`${discoveryDraftKey}:selected-map-item`, '')
  const today = localTodayValue()

  const [lastInterpretedQuery, setLastInterpretedQuery] = useState('')
  const [searchParams] = useSearchParams();
  useEffect(() => {
    let changed = false;
    let nextForm = { ...form };
    const q = searchParams.get('query');
    if (q && form.query !== q) { nextForm.query = q; changed = true; }
    const occ = searchParams.get('occasion');
    if (occ && form.occasion !== occ) { nextForm.occasion = occ; changed = true; }
    const area = searchParams.get('area');
    if (area && form.area !== area) { nextForm.area = area; changed = true; }
    if (changed) {
      setForm(nextForm);
    }
  }, [searchParams]);

  const searchRef = useRef(null)

  useEffect(() => {
    let active = true
    getDiscoveryPreferences().then((preferences) => {
      if (!active || !preferences.saved) return
      setSavedPreferences(true)
      if (draftRestored) return
      setForm((current) => ({
        ...current,
        category: preferences.preferredCategories?.[0] || current.category,
        style: preferences.preferredStyles?.[0] || current.style,
        colour: preferences.preferredColours?.[0] || current.colour,
        size: preferences.preferredSize || current.size,
        budgetMin: preferences.budgetMin ?? current.budgetMin,
        budgetMax: preferences.budgetMax ?? current.budgetMax,
        area: preferences.preferredArea || current.area,
        postcode: preferences.preferredPostcode || current.postcode,
        fulfilment: preferences.fulfilment || current.fulfilment,
      }))
    }).catch(() => {})
    apiRequest('/api/locations/hubs').then((data) => { if (active) setHubs(data) }).catch(() => {})
    return () => { active = false }
  }, [draftRestored, getDiscoveryPreferences, setForm])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError('Choose an image smaller than 12 MB.')
      return
    }
    try {
      setImageData(await prepareImage(file))
      setImageError('')
      setImageConsent(false)
      setImageAnalysisRequested(false)
    } catch (imageProblem) {
      setImageError(imageProblem.message)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. Enter a locality or PIN code instead.')
      return
    }
    setLocationMessage('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const nextLocation = { latitude: Number(coords.latitude.toFixed(2)), longitude: Number(coords.longitude.toFixed(2)) }
      setApproximateLocation(nextLocation)
      setLocationMessage('Using a broad search area (rounded to about 1 km). This location is not saved to your profile.')
      setForm((current) => ({ ...current, distanceKm: current.distanceKm || '5' }))
    }, () => setLocationMessage('Location permission was not granted. You can still search by locality, city, landmark, or PIN code.'), {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    })
  }

  function buildPayload() {
    const { customDistanceKm, ...searchFields } = form
    const presentMeasurements = Object.fromEntries(MEASURE_FIELDS.map(([key]) => [key, numeric(measurements[key])]))
    const hasMeasurements = Object.values(presentMeasurements).some((value) => value != null)
    return {
      ...searchFields,
      eventDate: form.eventDate || null,
      rentalStartDate: form.rentalStartDate || null,
      rentalEndDate: form.rentalEndDate || null,
      budgetMin: numeric(form.budgetMin),
      budgetMax: numeric(form.budgetMax),
      distanceKm: form.distanceKm === 'custom' ? numeric(customDistanceKm) : numeric(form.distanceKm),
      minimumRating: numeric(form.minimumRating),
      premiumOnly: Boolean(form.premiumOnly),
      latitude: approximateLocation?.latitude ?? null,
      longitude: approximateLocation?.longitude ?? null,
      measurements: hasMeasurements ? presentMeasurements : null,
      inspirationImageData: imageAnalysisRequested ? imageData : null,
      imageAnalysisConsent: imageAnalysisRequested && imageConsent,
      limit: 24,
      offset: 0,
    }
  }

  function applyInterpretedFilters(filters) {
    if (!filters) return
    setForm((current) => ({
      ...current,
      occasion: filters.occasion || current.occasion,
      eventDate: filters.eventDate || current.eventDate,
      rentalStartDate: filters.rentalStartDate || current.rentalStartDate,
      rentalEndDate: filters.rentalEndDate || current.rentalEndDate,
      category: filters.category || current.category,
      size: filters.size || current.size,
      style: filters.style || current.style,
      colour: filters.colour || current.colour,
      budgetMin: filters.budgetMin ?? current.budgetMin,
      budgetMax: filters.budgetMax ?? current.budgetMax,
      area: filters.area || current.area,
      postcode: filters.postcode || current.postcode,
      distanceKm: filters.distanceKm ?? current.distanceKm,
      fulfilment: filters.fulfilment || current.fulfilment,
      condition: filters.condition || current.condition,
      minimumRating: filters.minimumRating ?? current.minimumRating,
      premiumOnly: filters.premiumOnly ?? current.premiumOnly,
      transactionType: filters.transactionType || current.transactionType,
      sort: filters.sort || current.sort,
    }))
  }

  async function search(event) {
    if (event && event.preventDefault) event.preventDefault()
    if (form.distanceKm === 'custom' && (numeric(form.customDistanceKm) == null || numeric(form.customDistanceKm) < 1 || numeric(form.customDistanceKm) > 100)) {
      setError('Enter a custom radius from 1 to 100 km, or choose a preset radius.')
      return
    }
    setLoading(true)
    setError('')
    setPreferencesError('')
    setActiveSection('all')
    try {
      const payload = buildPayload()
      const nextResult = await discoverOutfits(payload)
      setResult(nextResult)
      applyInterpretedFilters(nextResult.filters)
      if (savePreferences) {
        try {
          const preferences = await saveDiscoveryPreferences({
            preferredCategories: form.category ? [form.category] : [],
            preferredStyles: form.style ? [form.style] : [],
            preferredColours: form.colour ? [form.colour] : [],
            preferredSize: form.size || null,
            budgetMin: numeric(form.budgetMin),
            budgetMax: numeric(form.budgetMax),
            preferredArea: form.area || null,
            preferredPostcode: form.postcode || null,
            fulfilment: form.fulfilment || null,
          })
          setSavedPreferences(Boolean(preferences.saved))
        } catch (preferenceError) {
          setPreferencesError(preferenceError.message || 'Search completed, but your preferences could not be saved.')
        }
      }
    } catch (searchError) {
      setError(searchError.message || 'Outfit discovery could not be completed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchRef.current = search
  }, [search])

  useEffect(() => {
    if (!form.query || form.query === lastInterpretedQuery || form.query.trim() === '') return
    const timeout = setTimeout(() => {
      setLastInterpretedQuery(form.query)
      if (searchRef.current) {
        searchRef.current(new Event('submit'))
      }
    }, 1500)
    return () => clearTimeout(timeout)
  }, [form.query, lastInterpretedQuery])

  async function clearSavedPreferences() {
    setPreferencesError('')
    try {
      await clearDiscoveryPreferences()
      setSavedPreferences(false)
      setSavePreferences(false)
      setPreferencesError('Saved discovery preferences were cleared.')
    } catch (preferenceError) {
      setPreferencesError(preferenceError.message || 'Saved preferences could not be cleared.')
    }
  }

  const allItems = result?.items || []
  const visibleItems = useMemo(() => {
    if (activeSection === 'nearby') return allItems.filter((item) => item.distanceKm != null)
    if (activeSection === 'rated') return allItems.filter((item) => Number(item.garment.rating || 0) >= 4 && Number(item.garment.reviewCount || 0) >= 3)
    if (activeSection === 'new') {
      const ids = new Set(result?.sections?.newArrivals || [])
      return allItems.filter((item) => ids.has(String(item.garment.id)))
    }
    if (activeSection === 'budget') {
      const min = numeric(form.budgetMin)
      const max = numeric(form.budgetMax)
      return allItems.filter((item) => {
        const price = Number(item.estimatedRentalPrice ?? item.garment.price ?? 0)
        return (min == null || price >= min) && (max == null || price <= max)
      })
    }
    return allItems
  }, [activeSection, allItems, form.budgetMax, result?.sections?.newArrivals])
    const cityForHubs = form.area.split(',').at(-1)?.trim()
  const filteredHubs = hubs.filter((hub) => !cityForHubs || String(hub.city).toLowerCase().includes(cityForHubs.toLowerCase()))

  const inputClass = "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition-colors"
  const labelClass = "block text-xs font-medium text-[#18212B] mb-1.5"
  
  return (
    <div className="min-h-screen bg-[#FFF9F1] pb-24">
      <section className="bg-[#18212B] text-white py-16 px-4 sm:px-6 lg:px-8 border-b-4 border-[#C89228]">
        <div className="max-w-7xl mx-auto flex flex-col items-start gap-4">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#C89228] bg-white/10 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> ReWear personal stylist
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif-couture leading-tight">
            AI Outfit <span className="text-[#C89228]">Discovery</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-300 max-w-2xl">
            Describe the occasion, choose your dates and preferences, and find available clothing nearby. ReWear explains each recommendation.
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium text-stone-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Availability checked against rental bookings</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Seller map points are approximate</span>
            <span className="flex items-center gap-1.5"><Ruler className="w-4 h-4" /> Fit estimates never guarantee fit</span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <form className="lg:col-span-5 space-y-10" onSubmit={search}>
          <div className="flex items-center justify-between border-b border-[#E8E1D8] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1">Tell your stylist</span>
              <h2 className="text-2xl font-serif-couture text-[#18212B]">What do you need?</h2>
            </div>
            <SlidersHorizontal className="w-6 h-6 text-[#781F37]" />
          </div>

          <div className="block relative">
            <span className={labelClass}>Describe your outfit in your own words</span>
            <div className="relative">
              <textarea 
                className={`${inputClass} resize-y min-h-[100px] pb-12`} 
                rows="3" 
                maxLength="1000" 
                value={form.query} 
                onChange={(event) => update('query', event.target.value)} 
                placeholder="I need a burgundy blazer for a wedding reception next Saturday, under ₹2,500." 
              />
              <button 
                type="button"
                onClick={() => { setLastInterpretedQuery(form.query); search(); }}
                className="absolute right-3 bottom-3 bg-[#18212B] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#2A3441] transition shadow-sm z-10"
              >
                Interpret
              </button>
            </div>
            <small className="block text-xs text-[#6F747A] mt-2">AI can turn your request into editable filters. If unavailable, ReWear uses built-in search interpretation.</small>
          </div>

          {result?.filters && Object.keys(result.filters).filter(k => result.filters[k] != null && result.filters[k] !== '' && k !== 'sort').length > 0 && (
            <div className="bg-[#197B5B]/5 border border-[#197B5B]/20 p-4 rounded-xl mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#197B5B] block mb-3">AI understood your request</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.filters).map(([key, value]) => {
                  if (value == null || value === '' || key === 'sort') return null;
                  return (
                    <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#197B5B]/30 rounded-full text-xs font-medium text-[#18212B] shadow-sm">
                      <span className="text-[#6F747A] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {String(value)}
                      <button 
                        type="button" 
                        onClick={() => {
                          update(key, '');
                          setResult(curr => curr ? { ...curr, filters: { ...curr.filters, [key]: '' } } : curr);
                        }} 
                        className="ml-1 text-[#6F747A] hover:text-[#781F37] transition"
                        title={`Remove ${key} filter`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block"><span className={labelClass}>Occasion</span><select className={inputClass} value={form.occasion} onChange={(event) => update('occasion', event.target.value)}><option value="">Any occasion</option>{OCCASIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Event date</span><input className={inputClass} type="date" min={today} value={form.eventDate} onChange={(event) => update('eventDate', event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Rental start date</span><input className={inputClass} type="date" min={today} value={form.rentalStartDate} onChange={(event) => update('rentalStartDate', event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Rental end date</span><input className={inputClass} type="date" min={form.rentalStartDate || today} value={form.rentalEndDate} onChange={(event) => update('rentalEndDate', event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Category</span><select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">Any category</option>{CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Size</span><input className={inputClass} maxLength="64" value={form.size} onChange={(event) => update('size', event.target.value)} placeholder="XS, M, 38R, or custom" /></label>
            <label className="block"><span className={labelClass}>Style</span><select className={inputClass} value={form.style} onChange={(event) => update('style', event.target.value)}><option value="">Any style</option>{STYLES.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Preferred colour</span><select className={inputClass} value={form.colour} onChange={(event) => update('colour', event.target.value)}><option value="">Any colour</option>{COLOURS.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Minimum price · ₹</span><input className={inputClass} type="number" min="0" max="1000000" value={form.budgetMin} onChange={(event) => update('budgetMin', event.target.value)} placeholder="No minimum" /></label>
            <label className="block"><span className={labelClass}>Maximum price · ₹</span><input className={inputClass} type="number" min="1" max="1000000" value={form.budgetMax} onChange={(event) => update('budgetMax', event.target.value)} placeholder="Any budget" /></label>
            <label className="block"><span className={labelClass}>Area or landmark</span><input className={inputClass} maxLength="100" value={form.area} onChange={(event) => update('area', event.target.value)} placeholder="Anna Nagar, Chennai" /></label>
            <label className="block"><span className={labelClass}>PIN code</span><input className={inputClass} maxLength="12" value={form.postcode} onChange={(event) => update('postcode', event.target.value)} placeholder="600040" /></label>
            <label className="block"><span className={labelClass}>Distance</span><select className={inputClass} value={['', '1', '5', '10', '25'].includes(form.distanceKm) ? form.distanceKm : 'custom'} onChange={(event) => update('distanceKm', event.target.value)}><option value="">Any distance</option>{['1', '5', '10', '25'].map((distance) => <option key={distance} value={distance}>Within {distance} km</option>)}<option value="custom">Custom radius</option></select>{form.distanceKm === 'custom' && <input className={`${inputClass} mt-2`} aria-label="Custom search radius in kilometres" type="number" min="1" max="100" value={form.customDistanceKm} onChange={(event) => update('customDistanceKm', event.target.value)} placeholder="Enter 1–100 km" />}</label>
            <label className="block"><span className={labelClass}>Pickup or delivery</span><select className={inputClass} value={form.fulfilment} onChange={(event) => update('fulfilment', event.target.value)}><option value="">Either option</option><option value="pickup">Pickup available</option><option value="delivery">Delivery available</option></select></label>
            <label className="block"><span className={labelClass}>Condition</span><select className={inputClass} value={form.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Any condition</option>{['New', 'Like new', 'Excellent', 'Very good', 'Good', 'Fair'].map((condition) => <option key={condition}>{condition}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Customer rating</span><select className={inputClass} value={form.minimumRating} onChange={(event) => update('minimumRating', event.target.value)}><option value="">Any rating</option><option value="4">4★ and above</option><option value="4.5">4.5★ and above</option><option value="5">5★</option></select></label>
            <label className="block"><span className={labelClass}>Transaction type</span><select className={inputClass} value={form.transactionType} onChange={(event) => update('transactionType', event.target.value)}><option value="rental">Rental</option><option value="purchase">Purchase (not available yet)</option></select></label>
            <label className="block"><span className={labelClass}>Sort results</span><select className={inputClass} value={form.sort} onChange={(event) => update('sort', event.target.value)}><option value="best-match">Best match</option><option value="nearest">Nearest</option><option value="lowest-price">Lowest price</option><option value="highest-rated">Highest rated</option><option value="available-today">Available today</option><option value="new-arrivals">New arrivals</option></select></label>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-[#18212B] cursor-pointer">
              <input type="checkbox" className="rounded border-stone-300 text-[#781F37] focus:ring-[#781F37]" checked={form.premiumOnly} onChange={(event) => update('premiumOnly', event.target.checked)} />
              Premium pieces
            </label>
            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E1D8] rounded-xl text-sm font-medium text-[#18212B] hover:bg-stone-50 transition-colors" onClick={useMyLocation}>
              <Locate className="w-4 h-4 text-[#781F37]" /> Use approximate location
            </button>
            {approximateLocation && <button type="button" className="text-sm font-medium text-[#781F37] hover:underline" onClick={() => { setApproximateLocation(null); setLocationMessage('Approximate location cleared. Search by area or PIN code instead.') }}>Clear location</button>}
          </div>
          {locationMessage && <p className="text-sm text-[#197B5B] bg-[#197B5B]/10 p-3 rounded-xl" role="status">{locationMessage}</p>}
          <p className="text-xs text-[#6F747A]">Location access is optional. Enter a city, locality, landmark, or PIN code if you prefer not to share device location.</p>

          <details className="bg-white border border-[#E8E1D8] rounded-2xl p-6 group">
            <summary className="text-sm font-bold uppercase tracking-wider text-[#18212B] cursor-pointer outline-none list-none flex justify-between items-center">
              Optional body measurements for fit confidence
              <span className="text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <div className="mt-4 pt-4 border-t border-[#E8E1D8]">
              <p className="text-xs text-[#6F747A] mb-4">Measurements are used only for this search and are not saved with your preferences or sent to the AI provider.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {MEASURE_FIELDS.map(([key, label]) => (
                  <label className="block" key={key}>
                    <span className={labelClass}>{label} · cm</span>
                    <input className={inputClass} type="number" min="1" max="300" step="0.5" value={measurements[key]} onChange={(event) => setMeasurements((current) => ({ ...current, [key]: event.target.value }))} />
                  </label>
                ))}
              </div>
            </div>
          </details>

          <div className="bg-white border border-[#E8E1D8] rounded-2xl p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1">Optional visual search</span>
              <h3 className="text-lg font-serif-couture text-[#18212B]">Add an inspiration image</h3>
              <p className="text-xs text-[#6F747A] mt-1">ReWear looks for broad clothing, colour, and style similarities. It will not claim an exact match.</p>
            </div>
            
            {imageData ? (
              <div className="flex items-start gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <img src={imageData} alt="Your outfit inspiration" className="w-24 h-24 object-cover rounded-lg shadow-sm" />
                <div>
                  <button type="button" className="text-sm font-medium text-[#781F37] hover:underline flex items-center gap-1 mb-2" onClick={() => { setImageData(''); setImageConsent(false); setImageAnalysisRequested(false); setImageError('') }}>
                    <X className="w-4 h-4" /> Remove image
                  </button>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E1D8] rounded-xl text-sm font-medium text-[#18212B] hover:bg-stone-50 cursor-pointer transition-colors">
                <ImagePlus className="w-4 h-4 text-[#781F37]" /> Choose image
                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
              </label>
            )}
            
            {imageData && <>
              <label className="flex items-start gap-3 text-sm text-[#18212B] cursor-pointer mt-4">
                <input type="checkbox" className="mt-1 rounded border-stone-300 text-[#781F37] focus:ring-[#781F37]" checked={imageAnalysisRequested} onChange={(event) => setImageAnalysisRequested(event.target.checked)} />
                Include this image in outfit analysis
              </label>
              {imageAnalysisRequested && (
                <label className="flex items-start gap-3 text-sm text-[#6F747A] cursor-pointer bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <input type="checkbox" className="mt-1 rounded border-stone-300 text-[#781F37] focus:ring-[#781F37]" checked={imageConsent} onChange={(event) => setImageConsent(event.target.checked)} />
                  I agree to send this image to ReWear’s configured AI provider for attribute analysis. The image is sent only when I search and is not stored by ReWear.
                </label>
              )}
            </>}
            {imageError && <p className="text-sm text-[#781F37]" role="alert">{imageError}</p>}
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E8E1D8]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <label className="flex items-start gap-3 text-sm text-[#18212B] cursor-pointer max-w-sm">
                <input type="checkbox" className="mt-1 rounded border-stone-300 text-[#781F37] focus:ring-[#781F37]" checked={savePreferences} onChange={(event) => setSavePreferences(event.target.checked)} />
                Save my style, size, budget, and locality preferences for future recommendations
              </label>
              {savedPreferences && (
                <button type="button" className="shrink-0 text-sm font-medium text-[#781F37] hover:underline" onClick={clearSavedPreferences}>
                  Clear saved preferences
                </button>
              )}
            </div>
            <p className="text-xs text-[#6F747A]">Search text, event and rental dates, body measurements, and precise location are not saved as personalization history.</p>
            {preferencesError && <p className="text-sm text-[#18212B]" role="status">{preferencesError}</p>}
            
            <button 
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-[#781F37] hover:bg-[#5E182B] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              type="submit" 
              disabled={loading || (imageAnalysisRequested && !imageConsent)}
            >
              <Sparkles className="w-5 h-5" />
              {loading ? 'Finding available outfits…' : 'Discover outfits'}
            </button>
          </div>
        </form>

        <section className="lg:col-span-7 space-y-6" aria-live="polite">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E8E1D8] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block mb-1">Available wardrobe pieces</span>
              <h2 className="text-2xl font-serif-couture text-[#18212B]">{result?.summary || 'Your recommendations will appear here'}</h2>
            </div>
            {result && (
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${result.aiAssisted ? 'bg-[#6D4AFF]/10 text-[#6D4AFF]' : 'bg-stone-100 text-[#6F747A]'}`}>
                {result.aiAssisted ? 'AI interpreted' : 'Preference ranking'}
              </span>
            )}
          </div>
          
          {result?.notice && <p className="text-sm text-[#C89228] bg-[#FFF9F1] border border-[#C89228]/30 p-4 rounded-xl" role="status">{result.notice}</p>}
          
          {result?.aiAssisted && (
            <p className="text-sm text-[#6F747A] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#6D4AFF] shrink-0 mt-0.5" />
              AI helps interpret your request and optional inspiration image. ReWear’s service checks availability and computes match scores from listing data.
            </p>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-100 p-8 rounded-2xl flex flex-col items-center text-center">
              <p className="text-[#781F37]" role="alert">{error}</p>
            </div>
          )}
          
          {loading && (
            <div className="bg-white border border-[#E8E1D8] shadow-sm p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-4" role="status">
              <div className="w-8 h-8 border-4 border-[#E8E1D8] border-t-[#781F37] rounded-full animate-spin" />
              <p className="text-[#6F747A]">Checking dates, listings, and your preferences…</p>
            </div>
          )}
          
          {!result && !loading && !error && (
            <div className="bg-white border border-[#E8E1D8] shadow-sm p-12 rounded-2xl flex flex-col items-center text-center h-[500px] justify-center">
              <Shirt className="w-16 h-16 text-stone-200 mb-6" />
              <h3 className="text-xl font-serif-couture text-[#18212B] mb-2">Start with an occasion or a free-text request</h3>
              <p className="text-sm text-[#6F747A] max-w-sm">Your results will be checked against rental dates before they are ranked.</p>
            </div>
          )}
          
          {result && !loading && (
            <>
              {result.suggestions?.length > 0 && (
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl text-sm">
                  <strong className="block text-[#18212B] mb-2">No exact matches found.</strong>
                  <ul className="space-y-1 text-[#6F747A] list-disc pl-5">
                    {result.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
                  </ul>
                </div>
              )}
              
              {allItems.length > 0 && <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                  <div className="flex overflow-x-auto pb-2 sm:pb-0 hide-scrollbar gap-2" role="tablist" aria-label="Recommendation groups">
                    {[
                      ['all', 'Best matches'], ['nearby', 'Near you'], ['budget', 'Within budget'],
                      ['rated', 'Highly rated'], ['new', 'New arrivals'],
                    ].map(([id, label]) => (
                      <button 
                        key={id} 
                        type="button" 
                        role="tab" 
                        aria-selected={activeSection === id} 
                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          activeSection === id 
                            ? 'bg-[#18212B] text-white' 
                            : 'bg-white border border-[#E8E1D8] text-[#6F747A] hover:bg-stone-50 hover:text-[#18212B]'
                        }`} 
                        onClick={() => { setActiveSection(id); setMapView(false) }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      mapView 
                        ? 'bg-[#781F37] border-[#781F37] text-white' 
                        : 'bg-white border-[#E8E1D8] text-[#18212B] hover:bg-stone-50'
                    }`} 
                    onClick={() => setMapView((visible) => !visible)}
                  >
                    <MapIcon className="w-4 h-4" />
                    {mapView ? 'List view' : 'Map view'}
                  </button>
                </div>
                
                {mapView ? (
                  <LocalityMap items={allItems} hubs={filteredHubs} searchLocation={approximateLocation} onSelectItem={setSelectedMapItem} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {visibleItems.map((item, index) => (
                      <DiscoveryResultCard 
                        key={item.garment.id} 
                        item={item} 
                        isBestMatch={result.sort === 'best-match' && activeSection === 'all' && index === 0} 
                      />
                    ))}
                    {visibleItems.length === 0 && (
                      <div className="col-span-full bg-stone-50 border border-stone-200 border-dashed rounded-2xl p-12 text-center">
                        <p className="text-[#6F747A]">No products are in this group on the current result page.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {selectedMapItem && (
                  <p className="text-sm text-[#197B5B] bg-[#197B5B]/10 p-3 rounded-xl mt-4">
                    Selected map listing: {allItems.find((item) => String(item.garment.id) === String(selectedMapItem))?.garment.name}
                  </p>
                )}
                {result.hasMore && (
                  <p className="text-center text-sm text-[#6F747A] mt-8">
                    Showing the first {allItems.length} results. Refine a filter to narrow the list.
                  </p>
                )}
              </>}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
