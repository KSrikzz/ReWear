import { useMemo } from 'react'
import { ShoppingBag, Inbox, Shirt, CornerDownLeft } from 'lucide-react'
import BusinessMembership from '../components/BusinessMembership'
import GarmentListingForm from '../components/GarmentListingForm'
import ProductActivitySummary from '../components/ProductActivitySummary'
import RentalActivity from '../components/RentalActivity'
import GarmentLifecycleControls from '../components/GarmentLifecycleControls'
import { useMarketplace } from '../context/useMarketplace'
import { clearSessionDraft, useSessionDraft } from '../hooks/useSessionDraft'

export default function SellerHub() {
  const { account, listingsWithInsights, bookings, reviews, claims, addListing, updateListing, updateBusinessPlan, toggleListing, updateRentalStatus, submitProtectionClaim, respondToClaim, updateGarmentLifecycle } = useMarketplace()
  const myListings = useMemo(() => listingsWithInsights.filter((item) => item.ownerId === account.id), [listingsWithInsights, account.id])
  const incomingBookings = useMemo(() => bookings.filter((item) => String(item.ownerId || '') === String(account.id)), [bookings, account.id])
  
  const activeListings = myListings.filter((item) => item.available)
  const pendingRequests = incomingBookings.filter((item) => item.status === 'requested')
  const rentalsInUse = incomingBookings.filter((item) => item.status === 'in_use')
  const returnsWaiting = incomingBookings.filter((item) => item.status === 'return_pending')
  
  const [editingListingId, setEditingListingId] = useSessionDraft(`rewear:${account.id}:editing-listing`, null)
  const editingListing = myListings.find((item) => String(item.id) === String(editingListingId)) || null

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

  return (
    <div className="min-h-screen bg-[#FFF9F1] text-[#18212B]">
      <section className="bg-white border-b border-[#E8E1D8] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Business wardrobe studio</span>
            <h1 className="text-3xl font-serif-couture font-bold mt-1">{account.businessName || 'Set up your studio'}</h1>
            <p className="text-sm text-[#6F747A] mt-2">Set up your clothing business and manage the pieces you offer for rent.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a className="px-5 py-2.5 bg-[#781F37] text-white rounded-xl font-bold text-sm hover:bg-[#5E182B] transition-colors shadow-sm whitespace-nowrap" href="#business-inventory-form">Add clothing</a>
            <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-[#E8E1D8] text-sm text-[#18212B]">
              <ShoppingBag className="w-4 h-4 text-[#781F37]" />
              <span><strong>{myListings.length}</strong> {myListings.length === 1 ? 'piece' : 'pieces'} in your inventory</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-label="Business overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Available listings', value: activeListings.length, icon: <ShoppingBag className="w-6 h-6" /> },
            { label: 'Requests to review', value: pendingRequests.length, icon: <Inbox className="w-6 h-6" /> },
            { label: 'Currently in use', value: rentalsInUse.length, icon: <Shirt className="w-6 h-6" /> },
            { label: 'Returns to confirm', value: returnsWaiting.length, icon: <CornerDownLeft className="w-6 h-6" /> },
          ].map((metric) => (
            <div className="bg-white p-5 rounded-2xl border border-[#E8E1D8] shadow-sm flex items-center gap-4" key={metric.label}>
              <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-[#781F37]">
                {metric.icon}
              </div>
              <div>
                <span className="block text-xs text-[#6F747A] font-semibold">{metric.label}</span>
                <strong className="block text-xl font-bold">{metric.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">
        <BusinessMembership planId={account.businessPlan} membershipStatus={account.membershipStatus} onSelectPlan={updateBusinessPlan} />

        <section aria-labelledby="business-requests-title">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Rental activity</span>
              <h2 className="text-2xl font-serif-couture font-bold mt-1" id="business-requests-title">Requests for your clothing</h2>
              <p className="text-sm text-[#6F747A] mt-1">Confirm requests, record handover, and close a rental after the return.</p>
            </div>
            <span className="px-3 py-1 bg-amber-50 text-[#C89228] border border-amber-200 rounded-full text-xs font-bold">
              <strong>{incomingBookings.filter((item) => ['requested', 'return_pending'].includes(item.status)).length}</strong> need attention
            </span>
          </div>
          
          {incomingBookings.length ? (
            <div className="flex flex-col gap-6">
              {incomingBookings.map((booking) => <RentalActivity key={booking.id} booking={booking} account={account} onStatusChange={updateRentalStatus} existingClaim={claims.find((claim) => String(claim.bookingId) === String(booking.id))} onProtectionClaim={submitProtectionClaim} onClaimResponse={respondToClaim} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] p-10 text-center shadow-sm flex flex-col items-center">
              <Inbox className="w-10 h-10 text-[#6F747A] mb-4" />
              <h3 className="text-lg font-bold mb-2">No rental requests yet</h3>
              <p className="text-sm text-[#6F747A]">New requests for your clothing will appear here.</p>
            </div>
          )}
        </section>

        <div>
          <div className="mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Your clothing</span>
            <h2 className="text-2xl font-serif-couture font-bold mt-1">Inventory for rent</h2>
            <p className="text-sm text-[#6F747A] mt-1">Add photos and rental details. Pause pieces that aren’t available.</p>
          </div>

          {myListings.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
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
                        <button className="text-sm font-bold text-[#18212B] hover:underline" type="button" onClick={() => setEditingListingId(String(listing.id))}>Edit listing</button>
                        {!listing.retired && !listing.underMaintenance && (
                          <button className="text-sm font-bold text-[#18212B] hover:underline" type="button" onClick={() => toggleListing(listing.id)}>
                            {listing.available ? 'Pause listing' : 'Make available'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] p-12 text-center shadow-sm flex flex-col items-center mb-12">
              <ShoppingBag className="w-12 h-12 text-[#6F747A] mb-4" />
              <h3 className="text-xl font-serif-couture font-bold mb-2">Your inventory is ready for its first piece</h3>
              <p className="text-sm text-[#6F747A] max-w-md">Publish a clothing listing to make it available to personal wardrobe members.</p>
            </div>
          )}

          <div id="business-inventory-form" className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-6 sm:p-8">
            <GarmentListingForm key={editingListing?.id || 'new-listing'} initialListing={editingListing} onSave={editingListing ? saveEditedListing : addListing} onCancel={cancelEditing} ownerLabel={account.businessName || account.name} />
          </div>
        </div>
      </section>
    </div>
  )
}
