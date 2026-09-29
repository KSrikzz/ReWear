import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

const sections = [
  ['overview', 'Overview', '/api/admin/overview'], ['users', 'Users', '/api/admin/users'],
  ['memberships', 'Memberships', '/api/admin/memberships'], ['garments', 'Garments', '/api/admin/garments'],
  ['rentals', 'Rentals', '/api/admin/rentals'], ['payments', 'Payments', '/api/admin/payments'], ['claims', 'Protection claims', '/api/admin/claims'],
]
const labels = { totalGarments: 'All garments', activeGarments: 'Active listings', personalAccounts: 'Personal accounts', businessAccounts: 'Business accounts', registeredUsers: 'Total users', newUsersToday: 'New today', totalRentals: 'Rental orders', activeRentals: 'Active rentals', completedRentals: 'Completed rentals', cancelledRentals: 'Cancelled rentals', platformCommissions: 'Platform commissions', membershipRevenue: 'Membership revenue', transactionVolume: 'Transaction volume', activeMemberships: 'Active memberships', expiredMemberships: 'Expired memberships', silverMembers: 'Silver members', goldMembers: 'Gold members', protectionRevenue: 'Protection premiums', pendingClaims: 'Pending claims', pendingDisputes: 'Pending disputes' }

function displayValue(value, key) {
  if (value == null) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && !Number.isInteger(value)) return '\u20b9' + value.toLocaleString('en-IN')
  if (typeof value === 'number' && !Number.isInteger(value)) return '\u20b9' + value.toLocaleString('en-IN')
  if (typeof value === 'number' && /(revenue|commission|volume|amount|price|total|fee|premium|payout)/i.test(key || '')) return '\u20b9' + value.toLocaleString('en-IN')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AdminDashboard() {
  const [section, setSection] = useState('overview')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyClaim, setBusyClaim] = useState('')
  const [busyUser, setBusyUser] = useState('')
  const [busyRental, setBusyRental] = useState('')
  const current = sections.find(([id]) => id === section)

  async function load(target = section) {
    const selected = sections.find(([id]) => id === target)
    setLoading(true); setError('')
    try { setData(await apiRequest(selected[2])) }
    catch (loadError) { setError(loadError.message || 'Admin data could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load(section) }, [section])

  async function resolveClaim(claim, decision) {
    setBusyClaim(claim.id)
    try {
      await apiRequest(`/api/admin/claims/${claim.id}`, { method: 'PATCH', body: JSON.stringify({ decision, approvedAmount: decision === 'approved' ? claim.requestedAmount : 0, note: decision === 'approved' ? 'Approved by platform review.' : 'Not eligible under the submitted information.' }) })
      await load('claims')
    } catch (claimError) { setError(claimError.message || 'Claim could not be updated.') }
    finally { setBusyClaim('') }
  }

  async function setUserStatus(user, status) {
    setBusyUser(user.id)
    try { await apiRequest(`/api/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load('users') }
    catch (statusError) { setError(statusError.message || 'Account status could not be changed.') }
    finally { setBusyUser('') }
  }

  async function resolveDispute(rental) {
    setBusyRental(rental.id)
    try {
      await apiRequest(`/api/admin/rentals/${rental.id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolution: 'completed' }) })
      await load('rentals')
    } catch (resolveError) { setError(resolveError.message || 'Dispute could not be resolved.') }
    finally { setBusyRental('') }
  }

  const rows = Array.isArray(data) ? data : []
  return (
    <div className="min-h-screen bg-[#FFF9F1] text-[#18212B]">
      <section className="bg-white border-b border-[#E8E1D8] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">ReWear operations</span>
            <h1 className="text-3xl font-serif-couture font-bold mt-1">Admin panel</h1>
            <p className="text-sm text-[#6F747A] mt-2 max-w-xl">Platform overview and operational records. Financial transactions shown here are simulated.</p>
          </div>
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#197B5B]/10 text-[#197B5B]">Administrator</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        <nav className="w-full lg:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0" aria-label="Admin sections">
          {sections.map(([id, label]) => (
            <button key={id} type="button" className={`text-left px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${section === id ? 'bg-[#18212B] text-white' : 'text-[#6F747A] hover:bg-stone-100'}`} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
        </nav>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Platform management</span>
              <h2 className="text-2xl font-serif-couture font-bold mt-1">{current[1]}</h2>
            </div>
            <button className="px-4 py-2 bg-white border border-[#E8E1D8] rounded-xl text-sm font-semibold text-[#18212B] hover:bg-stone-50 transition-colors shadow-sm" type="button" onClick={() => void load()}>Refresh</button>
          </div>

          {error && <p className="text-sm text-[#781F37] bg-[#781F37]/10 p-4 rounded-xl mb-6" role="alert">{error}</p>}
          
          {loading ? (
            <div className="py-12 text-center text-[#6F747A] text-sm animate-pulse" role="status">Loading admin data…</div>
          ) : section === 'overview' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(data).map(([key, value]) => (
                <article className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-5 flex flex-col" key={key}>
                  <span className="text-xs text-[#6F747A] font-semibold mb-2">{labels[key] || key}</span>
                  <strong className="text-2xl font-serif-couture font-bold text-[#18212B]">
                    {typeof value === 'number' && /revenue|commission|volume|premium/i.test(key) ? `₹${value.toLocaleString('en-IN')}` : Number(value).toLocaleString('en-IN')}
                  </strong>
                </article>
              ))}
            </div>
          ) : rows.length ? (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-[#E8E1D8] text-[#6F747A] text-xs uppercase font-bold tracking-wider">
                  <tr>
                    {Object.keys(rows[0]).filter((key) => !['customerId','ownerId','userId'].includes(key)).map((key) => (
                      <th className="px-4 py-3 whitespace-nowrap" key={key}>{key.replaceAll(/([A-Z])/g, ' $1')}</th>
                    ))}
                    {section === 'claims' && <th className="px-4 py-3">Review</th>}
                    {section === 'users' && <th className="px-4 py-3">Account action</th>}
                    {section === 'rentals' && <th className="px-4 py-3">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D8]">
                  {rows.map((row, index) => (
                    <tr className="hover:bg-stone-50 transition-colors" key={row.id || row.businessUserId || row.transactionId || index}>
                      {Object.keys(rows[0]).filter((key) => !['customerId','ownerId','userId'].includes(key)).map((key) => (
                        <td className="px-4 py-3 whitespace-nowrap text-[#18212B]" key={key}>{displayValue(row[key], key)}</td>
                      ))}
                      {section === 'claims' && (
                        <td className="px-4 py-3">
                          {['pending','seller_responded'].includes(row.status) && (
                            <div className="flex gap-2">
                              <button className="px-3 py-1.5 bg-[#197B5B] text-white rounded-lg text-xs font-semibold hover:bg-[#146148] disabled:opacity-50" type="button" disabled={busyClaim === row.id} onClick={() => void resolveClaim(row,'approved')}>Approve</button>
                              <button className="px-3 py-1.5 bg-white border border-[#E8E1D8] text-[#781F37] rounded-lg text-xs font-semibold hover:bg-stone-50 disabled:opacity-50" type="button" disabled={busyClaim === row.id} onClick={() => void resolveClaim(row,'rejected')}>Reject</button>
                            </div>
                          )}
                        </td>
                      )}
                      {section === 'users' && (
                        <td className="px-4 py-3">
                          {row.role !== 'admin' && (
                            <button className="px-3 py-1.5 bg-white border border-[#E8E1D8] rounded-lg text-xs font-semibold hover:bg-stone-50 disabled:opacity-50 text-[#18212B]" type="button" disabled={busyUser === row.id} onClick={() => void setUserStatus(row,row.accountStatus === 'suspended' ? 'active' : 'suspended')}>
                              {busyUser === row.id ? 'Saving…' : row.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      )}
                      {section === 'rentals' && (
                        <td className="px-4 py-3">
                          {row.status === 'disputed' && (
                            <button className="px-3 py-1.5 bg-[#197B5B] text-white rounded-lg text-xs font-semibold hover:bg-[#146148] disabled:opacity-50" type="button" disabled={busyRental === row.id} onClick={() => void resolveDispute(row)}>
                              {busyRental === row.id ? 'Resolving…' : 'Resolve & Complete'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-12 text-center">
              <h3 className="text-xl font-serif-couture font-bold mb-2">Nothing to show yet</h3>
              <p className="text-sm text-[#6F747A]">Records will appear here as people use the platform.</p>
            </div>
          )}
          
          <p className="mt-8 text-xs text-[#6F747A] leading-relaxed max-w-3xl">
            Platform rates, membership prices, protection limits, and claim windows are loaded from backend environment configuration. Update backend settings to change them.
          </p>
        </div>
      </section>
    </div>
  )
}