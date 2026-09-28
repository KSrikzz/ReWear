import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { Search, MapPin, Globe, X, CheckCircle2 } from 'lucide-react'

export default function LocationPicker({ selectedArea, garments, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [hubs, setHubs] = useState([])

  useEffect(() => {
    let active = true
    apiRequest('/api/locations/hubs').then((result) => { if (active) setHubs(result) }).catch(() => {})
    return () => { active = false }
  }, [])

  const areas = useMemo(() => {
    const choices = new Map()
    garments.forEach((garment) => {
      const area = String(garment.distance || '').trim()
      if (area) choices.set(area.toLocaleLowerCase(), { value: area, source: 'Clothing pickup area' })
    })
    hubs.forEach((hub) => {
      const area = [hub.area, hub.city].filter(Boolean).join(', ')
      if (area) choices.set(area.toLocaleLowerCase(), { value: area, source: hub.name || 'ReWear pickup point' })
    })
    return [...choices.values()].sort((left, right) => left.value.localeCompare(right.value))
  }, [garments, hubs])

  const filteredAreas = areas.filter((area) => area.value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4" 
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section className="bg-[#FFF9F1] text-[#18212B] w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-[#E8E1D8] flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="location-modal-title">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E8E1D8]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89228] mb-1">Hyperlocal pickup</div>
            <h2 className="font-serif-couture text-2xl font-black text-[#18212B]" id="location-modal-title">Choose your neighborhood</h2>
            <p className="text-sm text-[#6F747A] mt-1">We’ll use this area to narrow the clothing listings you browse.</p>
          </div>
          <button 
            className="p-2 rounded-full hover:bg-stone-200/60 text-[#18212B] transition cursor-pointer" 
            type="button" 
            onClick={onClose} 
            aria-label="Close neighborhood selector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            autoFocus 
            value={search} 
            onChange={(event) => setSearch(event.target.value)} 
            placeholder="Search neighborhoods or pickup points" 
            className="w-full text-sm p-3.5 pl-10 rounded-xl border border-stone-200 bg-white focus:ring-1 focus:ring-[#781F37] focus:border-[#781F37] outline-none transition shadow-sm"
          />
        </div>

        {/* Options List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          <button 
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer text-left ${!selectedArea ? 'border-[#197B5B] bg-[#197B5B]/5 ring-1 ring-[#197B5B]' : 'border-stone-200 hover:bg-white hover:border-[#197B5B]/30 bg-stone-50/50'}`} 
            type="button" 
            onClick={() => { onSelect(''); onClose() }}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${!selectedArea ? 'bg-[#197B5B] text-white' : 'bg-stone-200 text-stone-500'}`}>
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className={`font-semibold ${!selectedArea ? 'text-[#197B5B]' : 'text-[#18212B]'}`}>Any neighborhood</div>
              <div className="text-xs text-[#6F747A] mt-0.5">Show all available areas</div>
            </div>
            {!selectedArea && <CheckCircle2 className="w-5 h-5 text-[#197B5B] shrink-0" />}
          </button>

          {filteredAreas.map((area) => {
            const isSelected = selectedArea.toLocaleLowerCase() === area.value.toLocaleLowerCase()
            return (
              <button 
                key={area.value} 
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer text-left ${isSelected ? 'border-[#197B5B] bg-[#197B5B]/5 ring-1 ring-[#197B5B]' : 'border-stone-200 hover:bg-white hover:border-[#197B5B]/30 bg-stone-50/50'}`} 
                type="button" 
                onClick={() => { onSelect(area.value); onClose() }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#197B5B] text-white' : 'bg-stone-200 text-stone-500'}`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${isSelected ? 'text-[#197B5B]' : 'text-[#18212B]'}`}>{area.value}</div>
                  <div className="text-xs text-[#6F747A] mt-0.5">{area.source}</div>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-[#197B5B] shrink-0" />}
              </button>
            )
          })}
          
          {!filteredAreas.length && (
            <div className="p-8 text-center text-[#6F747A]">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              <p className="text-sm">No pickup areas match that search yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
