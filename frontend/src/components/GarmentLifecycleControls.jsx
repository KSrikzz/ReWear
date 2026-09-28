import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { ChevronDown, History, Wrench, RefreshCw, Archive, CheckCircle2 } from 'lucide-react'

const CONDITIONS = ['New', 'Like new', 'Excellent', 'Very good', 'Good', 'Fair']

function eventLabel(event) {
  return ({
    condition_updated: 'Condition updated',
    maintenance_started: 'Marked under maintenance',
    maintenance_completed: 'Marked ready for rent',
    repair_recorded: 'Repair or inspection recorded',
    retired: 'Listing retired',
    reactivated: 'Listing reactivated',
  })[event.eventType] || 'Listing updated'
}

export default function GarmentLifecycleControls({ garment, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState([])
  const [condition, setCondition] = useState(garment.condition || 'Good')
  const [repairNote, setRepairNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => setCondition(garment.condition || 'Good'), [garment.condition])
  
  useEffect(() => {
    if (!expanded) return
    let active = true
    apiRequest(`/api/garments/${garment.id}/lifecycle`).then((events) => {
      if (active) setHistory(events)
    }).catch((error) => {
      if (active) setMessage(error.message || 'History could not be loaded.')
    })
    return () => { active = false }
  }, [expanded, garment.id])

  async function save(changes, success) {
    setBusy(true)
    setMessage('')
    try {
      const updated = await onUpdate(garment.id, changes)
      setCondition(updated.condition || condition)
      setRepairNote('')
      setMessage(success)
      const events = await apiRequest(`/api/garments/${garment.id}/lifecycle`)
      setHistory(events)
    } catch (error) {
      setMessage(error.message || 'The listing update could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details 
      className="group bg-white rounded-2xl border border-[#E8E1D8] shadow-sm overflow-hidden transition-all duration-300"
      open={expanded} 
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="cursor-pointer p-4 md:p-5 flex items-center justify-between font-bold text-[#18212B] hover:bg-stone-50 transition list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#197B5B]" />
          <span>Care &amp; condition history</span>
        </div>
        <ChevronDown className="w-5 h-5 text-stone-400 group-open:-rotate-180 transition-transform duration-300" />
      </summary>
      
      <div className="p-4 md:p-5 border-t border-[#E8E1D8] bg-stone-50/50 space-y-6 animate-fade-in">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-[#18212B] uppercase tracking-wide mb-1.5">Current condition</span>
            <select 
              value={condition} 
              disabled={busy || garment.retired} 
              onChange={(event) => {
                setCondition(event.target.value)
                void save({ condition: event.target.value }, 'Condition updated.')
              }}
              className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition disabled:opacity-50 disabled:bg-stone-100"
            >
              {CONDITIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!garment.retired && (
            <button 
              type="button" 
              disabled={busy} 
              onClick={() => void save({ underMaintenance: !garment.underMaintenance }, garment.underMaintenance ? 'Piece marked ready for rent.' : 'Piece paused for maintenance.')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm ${
                garment.underMaintenance 
                  ? 'bg-[#197B5B] hover:bg-[#135d44] text-white' 
                  : 'bg-white border border-stone-200 text-[#18212B] hover:border-[#18212B]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {garment.underMaintenance ? <CheckCircle2 className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
              {garment.underMaintenance ? 'Mark ready for rent' : 'Mark under maintenance'}
            </button>
          )}
          
          <button 
            type="button" 
            disabled={busy} 
            onClick={() => {
              const retire = !garment.retired
              void save({ retired: retire }, retire ? 'Listing retired.' : 'Listing reactivated.')
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              garment.retired 
                ? 'bg-[#781F37] hover:bg-[#5E182B] text-white shadow-sm' 
                : 'text-[#6F747A] hover:text-[#C93B3B] hover:bg-red-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {garment.retired ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {garment.retired ? 'Reactivate listing' : 'Retire listing'}
          </button>
        </div>

        {!garment.retired && (
          <form 
            onSubmit={(event) => { 
              event.preventDefault()
              if (repairNote.trim()) void save({ repairNote: repairNote.trim() }, 'Repair or inspection added to history.') 
            }}
            className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-200"
          >
            <div className="flex-1 relative">
              <input 
                maxLength="500" 
                value={repairNote} 
                onChange={(event) => setRepairNote(event.target.value)} 
                placeholder="e.g. Replaced a loose hook; checked seams"
                className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition"
              />
              {repairNote.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">
                  {500 - repairNote.length}
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={busy || !repairNote.trim()}
              className="bg-[#18212B] hover:bg-[#2A3441] disabled:bg-stone-200 disabled:text-stone-400 text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-sm"
            >
              Add note
            </button>
          </form>
        )}

        {message && (
          <div className="p-3 bg-stone-100 text-[#18212B] text-sm rounded-xl font-medium border border-stone-200">
            {message}
          </div>
        )}

        <div className="pt-2">
          <h4 className="text-[10px] font-bold text-[#6F747A] uppercase tracking-wider mb-4">Timeline</h4>
          
          <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2.5 before:w-0.5 before:bg-stone-200">
            {history.map((event, index) => (
              <div key={event.id} className="relative pl-8">
                <div className={`absolute left-0 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center bg-white ${index === 0 ? 'ring-2 ring-stone-100' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-[#197B5B]' : 'bg-stone-300'}`} />
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-stone-100 shadow-sm text-sm">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <strong className="text-[#18212B]">{eventLabel(event)}</strong>
                    <time dateTime={event.createdAt} className="text-xs text-stone-400 whitespace-nowrap font-medium">
                      {new Date(event.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </time>
                  </div>
                  {event.previousCondition && event.nextCondition && event.previousCondition !== event.nextCondition && (
                    <div className="text-xs text-[#6F747A] font-medium flex items-center gap-1.5 mt-1">
                      <span className="line-through">{event.previousCondition}</span>
                      <span aria-hidden="true">→</span>
                      <span className="text-[#197B5B]">{event.nextCondition}</span>
                    </div>
                  )}
                  {event.note && <p className="text-stone-600 mt-2">{event.note}</p>}
                </div>
              </div>
            ))}
            
            {expanded && history.length === 0 && (
              <div className="relative pl-8">
                <div className="absolute left-0 w-5 h-5 rounded-full border-2 border-white bg-white">
                  <div className="w-2 h-2 rounded-full bg-stone-300" />
                </div>
                <div className="text-sm text-stone-500 py-1 font-medium">No care history has been recorded yet.</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </details>
  )
}
