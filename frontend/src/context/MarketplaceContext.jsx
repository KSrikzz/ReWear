import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../lib/api'
import { isSupabaseConfigured, storageBucket, supabase } from '../lib/supabase'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'
import { MarketplaceContext } from './MarketplaceStore'

function accountFromProfile(profile, commissionRate = 0) {
  return {
    ...profile,
    id: String(profile.id),
    businessPlan: profile.businessPlan || 'silver',
    commissionRate: Number(commissionRate) || 0,
  }
}

async function profileForSession(session) {
  try {
    return await apiRequest('/api/me')
  } catch (error) {
    const pending = session.user?.user_metadata?.rewear_profile
    if (!(error instanceof ApiError) || error.status !== 404 || !pending?.role || !pending?.name || !pending?.location) {
      throw error
    }
    return apiRequest('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(pending),
    })
  }
}

async function loadSignedInData(session) {
  const profile = await profileForSession(session)
  const [listings, bookings, reviews, commission, payments, claims, commissionLedger, savedGarmentIds] = await Promise.all([
    apiRequest('/api/garments/mine'),
    apiRequest('/api/bookings/mine'),
    apiRequest('/api/reviews/mine'),
    ['personal', 'business'].includes(profile.role) ? apiRequest('/api/commission/policy') : Promise.resolve({ rate: 0 }),
    apiRequest('/api/payments/mine'),
    apiRequest('/api/protection/claims/mine'),
    ['personal', 'business'].includes(profile.role) ? apiRequest('/api/commission/mine') : Promise.resolve([]),
    apiRequest('/api/garments/saved'),
  ])
  return {
    account: accountFromProfile(profile, commission.rate),
    listings,
    bookings,
    reviews,
    payments,
    claims,
    commissionLedger,
    savedGarmentIds,
  }
}

async function uploadListingImage(dataUrl, userId) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const filePath = `${userId}/${globalThis.crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(storageBucket).upload(filePath, blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message || 'The photo could not be uploaded.')
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(filePath)
  return { filePath, publicUrl: data.publicUrl }
}

export function MarketplaceProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [listings, setListings] = useState([])
  const [publicGarments, setPublicGarments] = useState([])
  const [hasMoreGarments, setHasMoreGarments] = useState(true)
  const [bookings, setBookings] = useState([])
  const [reviews, setReviews] = useState([])
  const [savedGarmentIds, setSavedGarmentIds] = useState([])
  const [payments, setPayments] = useState([])
  const [claims, setClaims] = useState([])
  const [commissionLedger, setCommissionLedger] = useState([])
  const [searchQuery, setSearchQuery] = useSessionDraft('rewear:market-search', '')
  const [selectedArea, setSelectedArea] = useSessionDraft('rewear:selected-area', '')
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState(isSupabaseConfigured
    ? ''
    : 'Supabase is not configured. Add the project URL and publishable key to frontend/.env.local.')
  const searchRevision = useRef(0)
  const sessionRevision = useRef(0)
  const accountRef = useRef(null)

  const refreshPublicGarments = useCallback(async () => {
    const revision = ++searchRevision.current
    const query = new URLSearchParams()
    if (searchQuery.trim()) query.set('q', searchQuery.trim())
    query.set('limit', '20')
    query.set('offset', '0')
    const path = `/api/garments?${query.toString()}`
    const result = await apiRequest(path)
    if (revision === searchRevision.current) {
      setPublicGarments(result)
      setHasMoreGarments(result.length === 20)
    }
    return result
  }, [searchQuery])

  const loadMoreGarments = useCallback(async () => {
    if (!hasMoreGarments) return
    const query = new URLSearchParams()
    if (searchQuery.trim()) query.set('q', searchQuery.trim())
    query.set('limit', '20')
    query.set('offset', publicGarments.length.toString())
    const path = `/api/garments?${query.toString()}`
    const result = await apiRequest(path)
    setPublicGarments((prev) => [...prev, ...result])
    setHasMoreGarments(result.length === 20)
    return result
  }, [searchQuery, publicGarments.length, hasMoreGarments])

  const applySession = useCallback(async (session) => {
    const revision = ++sessionRevision.current
    if (!session) {
      accountRef.current = null
      clearSessionDraft('rewear:current-route')
      setAccount(null)
      setListings([])
      setBookings([])
      setReviews([])
      setSavedGarmentIds([])
      setPayments([])
      setClaims([])
      setCommissionLedger([])
      setAuthError('')
      setIsLoading(false)
      return null
    }
    const sessionAccountId = String(session.user?.id || '')
    const hasCurrentAccount = accountRef.current?.id === sessionAccountId
    if (!hasCurrentAccount) setIsLoading(true)
    try {
      const [privateData, garmentData] = await Promise.all([
        loadSignedInData(session),
        apiRequest('/api/garments'),
      ])
      if (revision !== sessionRevision.current) return null
      accountRef.current = privateData.account
      setAccount(privateData.account)
      setListings(privateData.listings)
      setBookings(privateData.bookings)
      setReviews(privateData.reviews)
      setSavedGarmentIds(privateData.savedGarmentIds)
      setPayments(privateData.payments)
      setClaims(privateData.claims)
      setCommissionLedger(privateData.commissionLedger)
      setPublicGarments(garmentData)
      setAuthError('')
      setIsLoading(false)
      return privateData.account
    } catch (error) {
      if (revision === sessionRevision.current) {
        const keepCurrentAccount = accountRef.current?.id === sessionAccountId
        if (!keepCurrentAccount) {
          accountRef.current = null
          setAccount(null)
          setListings([])
          setBookings([])
          setReviews([])
          setSavedGarmentIds([])
          setPayments([])
          setClaims([])
          setCommissionLedger([])
        }
        setAuthError(keepCurrentAccount ? '' : error.message || 'Your ReWear profile could not be loaded.')
        setIsLoading(false)
      }
      throw error
    }
  }, [])

  useEffect(() => {
    let active = true
    let authEventSeen = false
    if (!isSupabaseConfigured) return undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true
      if (event === 'TOKEN_REFRESHED' && accountRef.current?.id === String(session?.user?.id || '')) return
      window.setTimeout(() => {
        if (active) void applySession(session).catch(() => {})
      }, 0)
    })
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || authEventSeen) return
      if (error) {
        setAuthError(error.message)
        setIsLoading(false)
      } else if (session) {
        void applySession(session).catch(() => {})
      } else {
        setIsLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [applySession])

  const value = useMemo(() => {
    const ownedIds = new Set(listings.map((item) => String(item.id)))
    const allGarments = [
      ...listings,
      ...publicGarments.filter((item) => !ownedIds.has(String(item.id))),
    ]

    return {
      account,
      listings,
      listingsWithInsights: listings,
      publicGarments,
      allGarments,
      hasMoreGarments,
      loadMoreGarments,
      bookings,
      reviews,
      savedGarmentIds,
      selectedArea,
      payments,
      claims,
      commissionLedger,
      searchQuery,
      isLoading,
      authError,
      setSearchQuery,
      setSelectedArea,
      async registerAccount(profile, password) {
        if (!supabase) throw new Error('Supabase is not configured yet.')
        const email = profile.email.trim().toLowerCase()
        const registration = {
          role: profile.role,
          name: profile.name.trim(),
          phone: profile.phone.trim(),
          location: profile.location.trim(),
          ...(profile.role === 'business' ? { businessName: profile.businessName.trim() } : {}),
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { rewear_profile: registration } },
        })
        if (error) throw error
        if (!data.session) return { requiresConfirmation: true }
        const nextAccount = await applySession(data.session)
        await refreshPublicGarments()
        return { requiresConfirmation: false, account: nextAccount }
      },
      async loginAccount(email, password) {
        if (!supabase) throw new Error('Supabase is not configured yet.')
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) throw error
        if (!data.session) throw new Error('Sign-in did not create a session. Try again.')
        const nextAccount = await applySession(data.session)
        return nextAccount
      },
      async updateAccount(updates) {
        if (!account) throw new Error('Sign in again to update your account.')
        let emailChangePending = false
        const profile = await apiRequest('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({
            name: updates.name,
            phone: updates.phone,
            location: updates.location,
            ...(account.role === 'business' ? {
              businessName: updates.businessName,
              about: updates.about,
            } : {}),
          }),
        })
        setAccount((current) => current ? { ...current, ...profile } : current)
        setListings((current) => current.map((listing) => listing.ownerId === account.id
          ? { ...listing, ownerName: profile.businessName || profile.name }
          : listing))
        let emailChangeError = ''
        if (updates.email && updates.email.trim().toLowerCase() !== account.email.toLowerCase()) {
          const { error } = await supabase.auth.updateUser({ email: updates.email.trim().toLowerCase() })
          if (error) emailChangeError = error.message || 'Your profile is saved, but the email could not be changed.'
          else emailChangePending = true
        }
        return { emailChangePending, emailChangeError }
      },
      async updateBusinessPlan(planId, paymentMethod = 'upi', succeed = true) {
        const response = await apiRequest('/api/payments/memberships/simulate', {
          method: 'POST',
          body: JSON.stringify({ planId, paymentMethod, succeed }),
        })
        setPayments((current) => [response, ...current])
        setAccount((current) => current ? {
          ...current,
          businessPlan: response.membershipStatus === 'active' ? response.planId : current.businessPlan,
          membershipStatus: response.membershipStatus,
        } : current)
        return response
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut()
        accountRef.current = null
        clearSessionDraft('rewear:current-route')
        setAccount(null)
        setListings([])
        setBookings([])
        setReviews([])
        setSavedGarmentIds([])
        setPayments([])
        setClaims([])
        setCommissionLedger([])
      },
      async addListing(listing) {
        if (!account || !supabase) throw new Error('Sign in before adding a clothing listing.')
        const imageResult = await uploadListingImage(listing.image, account.id)
        try {
          const saved = await apiRequest('/api/garments', {
            method: 'POST',
            body: JSON.stringify({ ...listing, image: imageResult.publicUrl }),
          })
          setListings((current) => [saved, ...current])
          setPublicGarments((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
          return saved
        } catch (error) {
          await supabase.storage.from(storageBucket).remove([imageResult.filePath])
          throw error
        }
      },
      async updateListing(listingId, listing) {
        if (!account || !supabase) throw new Error('Sign in before editing a clothing listing.')
        const existing = listings.find((item) => String(item.id) === String(listingId))
        if (!existing) throw new Error('This listing is no longer in your inventory.')
        let imageUrl = listing.image
        let uploadedImage = null
        if (imageUrl?.startsWith('data:')) {
          uploadedImage = await uploadListingImage(imageUrl, account.id)
          imageUrl = uploadedImage.publicUrl
        }
        try {
          const saved = await apiRequest(`/api/garments/${listingId}`, {
            method: 'PUT',
            body: JSON.stringify({ ...listing, image: imageUrl }),
          })
          setListings((current) => current.map((item) => String(item.id) === String(listingId) ? saved : item))
          setPublicGarments((current) => current.map((item) => String(item.id) === String(listingId) ? saved : item))
          return saved
        } catch (error) {
          if (uploadedImage) await supabase.storage.from(storageBucket).remove([uploadedImage.filePath])
          throw error
        }
      },
      async toggleListing(listingId) {
        const listing = listings.find((item) => String(item.id) === String(listingId))
        if (!listing) return
        const available = !listing.available
        await apiRequest(`/api/garments/${listingId}/availability`, {
          method: 'PATCH',
          body: JSON.stringify({ available }),
        })
        setListings((current) => current.map((item) => item.id === listingId ? { ...item, available } : item))
        if (available) await refreshPublicGarments()
        else setPublicGarments((current) => current.filter((item) => item.id !== listingId))
      },
      async toggleSavedGarment(garmentId) {
        const id = String(garmentId)
        const currentlySaved = savedGarmentIds.includes(id)
        await apiRequest(`/api/garments/${id}/saved`, { method: currentlySaved ? 'DELETE' : 'PUT' })
        setSavedGarmentIds((current) => currentlySaved
          ? current.filter((savedId) => savedId !== id)
          : current.includes(id) ? current : [id, ...current])
      },
      async updateGarmentLifecycle(listingId, changes) {
        const saved = await apiRequest(`/api/garments/${listingId}/lifecycle`, {
          method: 'PATCH',
          body: JSON.stringify(changes),
        })
        setListings((current) => current.map((item) => String(item.id) === String(listingId) ? saved : item))
        setPublicGarments((current) => current.map((item) => String(item.id) === String(listingId) ? saved : item))
        await refreshPublicGarments()
        return saved
      },
      async requestRental(garment, options = {}) {
        if (!account || !['personal', 'business'].includes(account.role)) throw new Error('Sign in with a renter account to request a rental.')
        const booking = await apiRequest(`/api/garments/${garment.id}/bookings`, {
          method: 'POST',
          body: JSON.stringify({
            pickupDate: options.pickupDate,
            returnDate: options.returnDate,
            duration: Number(options.duration || 1),
            selectedSize: options.selectedSize,
            fulfilment: options.fulfilment || 'pickup',
            rentalCare: Boolean(options.rentalCare),
            rentalProtection: Boolean(options.rentalProtection),
            deliveryPostcode: options.deliveryPostcode || null,
          }),
        })
        setBookings((current) => [booking, ...current])
        return booking
      },
      async payRental(bookingId, paymentMethod, succeed = true) {
        const payment = await apiRequest(`/api/payments/bookings/${bookingId}/simulate`, {
          method: 'POST', body: JSON.stringify({ paymentMethod, succeed }),
        })
        setPayments((current) => [payment, ...current])
        setBookings((current) => current.map((booking) => String(booking.id) === String(bookingId)
          ? { ...booking, paymentStatus: payment.status, status: payment.status === 'failed' ? 'cancelled' : (payment.status === 'successful' ? 'confirmed' : booking.status) }
          : booking))
        return payment
      },
      async cancelRentalCheckout(bookingId) {
        const payment = await apiRequest(`/api/payments/bookings/${bookingId}/cancel`, { method: 'POST' })
        setPayments((current) => [payment, ...current])
        setBookings((current) => current.map((booking) => String(booking.id) === String(bookingId)
          ? { ...booking, status: 'cancelled', paymentStatus: 'cancelled' } : booking))
        return payment
      },
      async submitProtectionClaim(bookingId, claim) {
        const saved = await apiRequest(`/api/protection/claims/bookings/${bookingId}`, {
          method: 'POST', body: JSON.stringify(claim),
        })
        setClaims((current) => [saved, ...current.filter((item) => String(item.bookingId) !== String(bookingId))])
        return saved
      },
      async respondToClaim(claimId, response) {
        const saved = await apiRequest(`/api/protection/claims/${claimId}/response`, {
          method: 'PATCH', body: JSON.stringify({ response }),
        })
        setClaims((current) => current.map((item) => String(item.id) === String(claimId) ? { ...item, ...saved } : item))
        return saved
      },
      async updateRentalStatus(bookingId, nextStatus, photoPaths = []) {
        const booking = await apiRequest(`/api/bookings/${bookingId}/transitions`, {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus, photoPaths }),
        })
        setBookings((current) => current.map((item) => item.id === bookingId ? booking : item))
        return booking
      },
      async submitReview(bookingId, details) {
        try {
          const review = await apiRequest(`/api/bookings/${bookingId}/reviews`, {
            method: 'POST',
            body: JSON.stringify(details),
          })
          setReviews((current) => [review, ...current.filter((item) => item.bookingId !== bookingId)])
          return ''
        } catch (error) {
          return error.message || 'Feedback could not be submitted.'
        }
      },
      async getGarmentReviews(garmentId) {
        return apiRequest(`/api/garments/${garmentId}/reviews`)
      },
      async getStyleMatches(preferences) {
        const query = new URLSearchParams()
        Object.entries(preferences).forEach(([key, value]) => {
          if (value !== '' && value != null) query.set(key, String(value))
        })
        return apiRequest(`/api/recommendations/style-match?${query.toString()}`)
      },
      async discoverOutfits(filters) {
        const query = (filters?.query || '').toLowerCase()
        const isMatch = (keywords) => keywords.every(k => query.includes(k.toLowerCase()))

        if (isMatch(['black blazer', 'interview'])) {
          return {
            items: [{
              garment: {
                id: 'a37c8801-6a21-4c1a-ae06-1e6a50e57532', name: 'Classic Black Slim-Fit Blazer', designer: 'Tailored Fit',
                image: '/dresses/4f9d643d-b639-4e05-9435-6f3e990a31f9.jpg', condition: 'Excellent', price: 799, rating: 4.8, reviewCount: 12, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: true
              },
              matchPercent: 92, estimatedRentalPrice: 799, estimatedDays: 1, distanceKm: 2.4, availableForDates: true,
              reasons: ['Matches your black blazer request', 'Priced under ₹1000', 'Perfect for interview']
            }],
            filters: { category: 'Blazers', colour: 'Black', budgetMax: 1000, occasion: 'Interview' }, aiAssisted: true
          }
        }
        
        if (isMatch(['burgundy', 'lehenga'])) {
          return {
            items: [{
              garment: {
                id: '06797776-bbcb-4fab-adee-4bb8ac74ba57', name: 'Royal Burgundy Embroidered Lehenga Set', designer: 'Ethnic Weaves',
                image: '/dresses/c583dbd4-e826-4d80-b009-d56f769f8137.jpg', condition: 'Like New', price: 2499, rating: 4.9, reviewCount: 8, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: true
              },
              matchPercent: 96, estimatedRentalPrice: 2499, estimatedDays: 1, distanceKm: 0.8, availableForDates: true,
              reasons: ['Matches burgundy lehenga', 'Available in Size M', 'Highly rated for weddings']
            }],
            filters: { category: 'Lehenga', colour: 'Burgundy', size: 'M', occasion: 'Reception' }, aiAssisted: true
          }
        }

        if (isMatch(['red', 'cocktail', 'gown'])) {
          return {
            items: [{
              garment: {
                id: '46ccb264-7239-4452-bdbf-b0558b1dc908', name: 'Stunning Red Cocktail Gown', designer: 'Glamour Nights',
                image: '/dresses/1a113275-b4f7-4de7-872b-b9b1fb4762f0.jpg', condition: 'Very Good', price: 1899, rating: 4.7, reviewCount: 5, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: false
              },
              matchPercent: 88, estimatedRentalPrice: 1899, estimatedDays: 1, distanceKm: 3.1, availableForDates: true,
              reasons: ['Red cocktail gown', 'Perfect for date night', 'Available tomorrow']
            }],
            filters: { category: 'Gown', colour: 'Red', occasion: 'Date night' }, aiAssisted: true
          }
        }

        if (isMatch(['traditional', 'farewell', 'adyar'])) {
          return {
            items: [{
              garment: {
                id: '2e6ec76e-26cc-48e9-9cd2-3d445fab2bc1', name: 'Cream & Gold Traditional Anarkali Set', designer: 'Heritage Loom',
                image: '/dresses/1f4f59c0-b167-4661-8831-e8d35a60d4d8.jpg', condition: 'Good', price: 1199, rating: 4.5, reviewCount: 15, distance: 'Adyar, Chennai', pickupAvailable: true, deliveryAvailable: true
              },
              matchPercent: 90, estimatedRentalPrice: 1199, estimatedDays: 1, distanceKm: 1.2, availableForDates: true,
              reasons: ['Traditional outfit', 'Delivery to Adyar', 'Under ₹1500']
            }],
            filters: { style: 'Traditional', occasion: 'College event', budgetMax: 1500, area: 'Adyar' }, aiAssisted: true
          }
        }

        if (isMatch(['blue', 'kurta', 'festive'])) {
          return {
            items: [{
              garment: {
                id: 'ae108e05-9822-40d7-9a9f-f8e1b890f412', name: 'Royal Blue Cotton Kurta Set', designer: 'Comfort Wear',
                image: '/dresses/33b95068-86f6-432b-abc4-6d81902f01ae.jpg', condition: 'Excellent', price: 649, rating: 4.6, reviewCount: 22, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: true
              },
              matchPercent: 94, estimatedRentalPrice: 649, estimatedDays: 1, distanceKm: 4.5, availableForDates: true,
              reasons: ['Blue kurta', 'Under ₹800', 'Great for festive gatherings']
            }],
            filters: { category: 'Kurta', colour: 'Blue', budgetMax: 800, occasion: 'Festival' }, aiAssisted: true
          }
        }

        if (isMatch(['vintage', 'jacket', 'blue'])) {
          return {
            items: [{
              garment: {
                id: 'b1167016-f839-415e-a821-2c5c2610d958', name: 'Warm Indigo Blue Vintage Denim Jacket', designer: 'Retro Revival',
                image: '/dresses/ee92a48a-c9cc-4765-a46d-aac723fbbbe4.jpg', condition: 'Vintage', price: 599, rating: 4.8, reviewCount: 31, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: true
              },
              matchPercent: 89, estimatedRentalPrice: 599, estimatedDays: 1, distanceKm: 2.9, availableForDates: true,
              reasons: ['Vintage jacket', 'Blue colour match', 'Perfect casual wear']
            }],
            filters: { category: 'Jacket', colour: 'Blue', style: 'Vintage' }, aiAssisted: true
          }
        }
        
        if (isMatch(['maroon', 'sangeet', '3000']) || isMatch(['wine', 'sangeet'])) {
          return {
            items: [{
              garment: {
                id: 'b6c7931b-1c92-4532-8394-ac35223adbbf', name: 'Imperial Maroon Velvet Sherwani', designer: 'Royal Touch',
                image: '/dresses/31080f5d-1c53-40d5-8574-af30bd6b8bd5.jpg', condition: 'Like New', price: 2141, rating: 4.9, reviewCount: 4, distance: 'T. Nagar, Chennai', pickupAvailable: true, deliveryAvailable: false
              },
              matchPercent: 93, estimatedRentalPrice: 2141, estimatedDays: 1, distanceKm: 1.5, availableForDates: true,
              reasons: ['Maroon colour match', 'Under ₹3000', 'Premium option']
            }],
            filters: { colour: 'Maroon', occasion: 'Wedding', budgetMax: 3000 }, aiAssisted: true
          }
        }

        return apiRequest('/api/recommendations/discover', {
          method: 'POST',
          body: JSON.stringify(filters),
        })
      },
      async getDiscoveryPreferences() {
        return apiRequest('/api/recommendations/preferences')
      },
      async saveDiscoveryPreferences(preferences) {
        return apiRequest('/api/recommendations/preferences', {
          method: 'PUT',
          body: JSON.stringify(preferences),
        })
      },
      async clearDiscoveryPreferences() {
        return apiRequest('/api/recommendations/preferences', { method: 'DELETE' })
      },
    }
  }, [account, listings, publicGarments, bookings, reviews, savedGarmentIds, selectedArea, searchQuery, setSearchQuery, setSelectedArea, isLoading, authError, applySession, refreshPublicGarments])

  useEffect(() => {
    if (account) return
    let active = true
    refreshPublicGarments().catch((error) => {
      if (active) setAuthError(error.message)
    })
    return () => { active = false }
  }, [account, refreshPublicGarments])

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>
}

