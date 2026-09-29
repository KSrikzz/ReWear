import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Shirt, Inbox, ShoppingBag, Star } from 'lucide-react'
import GarmentListingForm from '../components/GarmentListingForm'
import ProductActivitySummary from '../components/ProductActivitySummary'
import RentalActivity from '../components/RentalActivity'
import GarmentLifecycleControls from '../components/GarmentLifecycleControls'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'

export default function MyCloset() {
  const { account, listingsWithInsights, bookings, reviews, claims, addListing, updateListing, toggleListing, updateRentalStatus, submitReview, submitProtectionClaim, respondToClaim, updateGarmentLifecycle } = useMarketplace()
  const [activeTab, setActiveTab] = useSessionDraft(`rewear:${account.id}:closet-tab`, 'rentals')
  const [editingListingId, setEditingListingId] = useSessionDraft(`rewear:${account.id}:editing-listing`, null)
  
  const myListings = useMemo(() => listingsWithInsights.filter((item) => item.ownerId === account.id), [listingsWithInsights, account.id])
  const editingListing = myListings.find((item) => String(item.id) === String(editingListingId)) || null
  const myBookings = useMemo(() => bookings.filter((item) => String(item.customerId) === String(account.id)), [bookings, account.id])
  const incomingBookings = useMemo(() => bookings.filter((item) => String(item.ownerId || '') === String(account.id)), [bookings, account.id])
  
  const activeRentals = myBookings.filter((item) => ['confirmed', 'handover_pending', 'in_use', 'return_pending'].includes(item.status))
  const pendingReviewCount = myBookings.filter((item) => item.status === 'completed' && !reviews.some((review) => review.bookingId === item.id)).length

  async function saveListing(listing) {
    await addListing(listing)
    setActiveTab('listings')
  }

  async function saveEditedListing(listing) {
    await updateListing(editingListing.id, listing)
    clearListingDraft(editingListing.id)
    setEditingListingId(null)
  }

  function clearListingDraft(listingId) {
    const key = `rewear:${account.id}:listing:${listingId}`
    clearSessionDraft(`${key}:form`)
    clearSessionDraft(`${key}:location`)
    clearSessionDraft(`${key}:image`)
  }

  function cancelEditing() {
    if (editingListingId) clearListingDraft(editingListingId)
    setEditingListingId(null)
  }

  const icons = { styler: Shirt, inbox: Inbox, checkroom: ShoppingBag, rate_review: Star }

  return (
    <div className="min-h-screen bg-[#FFF9F1] text-[#18212B]">
      <section className="bg-white border-b border-[#E8E1D8] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Personal wardrobe</span>
            <h1 className="text-3xl font-serif-couture font-bold mt-1">Your closet, {account.name.split(' ')[0]}</h1>
            <p className="text-sm text-[#6F747A] mt-2">Track outfits you rent and requests for pieces you share.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="px-5 py-2.5 bg-white border border-[#E8E1D8] text-[#18212B] rounded-xl font-bold text-sm hover:bg-stone-50 transition-colors shadow-sm" to="/">Browse clothing</Link>
            <button className="px-5 py-2.5 bg-[#781F37] text-white rounded-xl font-bold text-sm hover:bg-[#5E182B] transition-colors shadow-sm" type="button" onClick={() => setActiveTab('listings')}>Share a piece</button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-label="Personal wardrobe overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active rentals', value: activeRentals.length, icon: 'styler', action: 'rentals' },
            { label: 'Requests on my pieces', value: incomingBookings.filter((item) => item.status === 'requested').length, icon: 'inbox', action: 'incoming' },
            { label: 'Pieces I’m sharing', value: myListings.length, icon: 'checkroom', action: 'listings' },
            { label: 'Feedback to leave', value: pendingReviewCount, icon: 'rate_review', action: 'rentals' },
          ].map((metric) => {
            const Icon = icons[metric.icon]
            return (
              <button className="bg-white p-5 rounded-2xl border border-[#E8E1D8] shadow-sm flex items-center gap-4 text-left hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[#781F37]" key={metric.label} type="button" onClick={() => setActiveTab(metric.action)}>
                <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-[#781F37]">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs text-[#6F747A] font-semibold">{metric.label}</span>
                  <strong className="block text-xl font-bold">{metric.value}</strong>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex border-b border-[#E8E1D8] mb-8 overflow-x-auto" role="tablist" aria-label="Your wardrobe activity">
          {[
            { id: 'rentals', label: 'My rentals', count: myBookings.length },
            { id: 'incoming', label: 'Requests for my pieces', count: incomingBookings.length },
            { id: 'listings', label: 'My listings', count: myListings.length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-6 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-[#781F37] text-[#781F37]' : 'border-transparent text-[#6F747A] hover:text-[#18212B] hover:border-stone-300'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-[#781F37]/10 text-[#781F37]' : 'bg-stone-100 text-[#6F747A]'}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {activeTab === 'rentals' && (
          myBookings.length ? (
            <div className="flex flex-col gap-6">
              {myBookings.map((booking) => (
                <RentalActivity
                  key={booking.id}
                  booking={booking}
                  account={account}
                  onStatusChange={updateRentalStatus}
                  hasReviewForBooking={reviews.some((review) => review.bookingId === booking.id)}
                  onReviewSubmit={submitReview}
                  existingClaim={claims.find((claim) => String(claim.bookingId) === String(booking.id))}
                  onProtectionClaim={submitProtectionClaim}
                  onClaimResponse={respondToClaim}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] p-12 text-center shadow-sm flex flex-col items-center">
              <Shirt className="w-12 h-12 text-[#6F747A] mb-4" />
              <h2 className="text-xl font-serif-couture font-bold mb-2">Your next occasion is waiting</h2>
              <p className="text-sm text-[#6F747A] mb-6 max-w-md">When you request an outfit, its confirmation and return steps will show up here.</p>
              <Link className="px-5 py-2.5 bg-[#781F37] text-white rounded-xl font-bold text-sm hover:bg-[#5E182B] transition-colors shadow-sm" to="/">Browse outfits</Link>
            </div>
          )
        )}

        {activeTab === 'incoming' && (
          incomingBookings.length ? (
            <div className="flex flex-col gap-6">
              {incomingBookings.map((booking) => <RentalActivity key={booking.id} booking={booking} account={account} onStatusChange={updateRentalStatus} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] p-12 text-center shadow-sm flex flex-col items-center">
              <Inbox className="w-12 h-12 text-[#6F747A] mb-4" />
              <h2 className="text-xl font-serif-couture font-bold mb-2">No rental requests yet</h2>
              <p className="text-sm text-[#6F747A] mb-6 max-w-md">Requests for your shared pieces will appear here.</p>
              <button className="px-5 py-2.5 bg-[#781F37] text-white rounded-xl font-bold text-sm hover:bg-[#5E182B] transition-colors shadow-sm" type="button" onClick={() => setActiveTab('listings')}>Manage my listings</button>
            </div>
          )
        )}

        {activeTab === 'listings' && (
          <div className="space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-serif-couture font-bold">Your shared pieces</h2>
                <p className="text-sm text-[#6F747A] mt-1">Pause a listing whenever you need to keep it close.</p>
              </div>
            </div>
            
            {myListings.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myListings.map((listing) => (
                  <article className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm overflow-hidden flex flex-col" key={listing.id}>
                    <img className="w-full h-64 object-cover" src={listing.image} alt={listing.name} />
                    <div className="p-5 flex flex-col flex-1">
                      <div className="mb-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${listing.available ? 'bg-[#197B5B]/10 text-[#197B5B]' : 'bg-stone-100 text-[#6F747A]'}`}>
                          {listing.retired ? 'Retired' : listing.underMaintenance ? 'Under maintenance' : listing.available ? 'Available to rent' : 'Paused'}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg leading-tight mb-1">{listing.name}</h3>
                      <p className="text-sm text-[#6F747A] font-medium mb-4">₹{Number(listing.price).toLocaleString('en-IN')} / day · Size {listing.size}</p>
                      
                      <div className="mt-auto space-y-4">
                        <ProductActivitySummary garment={listing} reviews={reviews} />
                        <GarmentLifecycleControls garment={listing} onUpdate={updateGarmentLifecycle} />
                        <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E8E1D8]">
                          <Link to={`/product/${listing.id}`} className="text-sm font-bold text-[#781F37] hover:underline">View</Link>
                          <button className="text-sm font-bold text-[#18212B] hover:underline" type="button" onClick={() => setEditingListingId(String(listing.id))}>Edit</button>
                          {!listing.retired && !listing.underMaintenance && (
                            <button className="text-sm font-bold text-[#18212B] hover:underline" type="button" onClick={() => toggleListing(listing.id)}>
                              {listing.available ? 'Pause' : 'Make available'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E8E1D8] p-12 text-center shadow-sm flex flex-col items-center">
                <ShoppingBag className="w-12 h-12 text-[#6F747A] mb-4" />
                <h3 className="text-xl font-serif-couture font-bold mb-2">Share your first outfit</h3>
                <p className="text-sm text-[#6F747A] max-w-md">Earn from the pieces you love and help someone else find their occasion look.</p>
              </div>
            )}
            <GarmentListingForm key={editingListing?.id || 'new-listing'} initialListing={editingListing} onSave={editingListing ? saveEditedListing : saveListing} onCancel={cancelEditing} ownerLabel={account.name} />
          </div>
        )}
      </section>
    </div>
  )
}
