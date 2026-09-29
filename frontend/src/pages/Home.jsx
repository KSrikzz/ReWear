import { Link, useSearchParams } from 'react-router-dom'
import { OCCASIONS, HERO_IMAGES } from '../data/garments'
import GarmentCard from '../components/GarmentCard'
import { useMarketplace } from '../context/useMarketplace'
import { useSessionDraft } from '../hooks/useSessionDraft'
import { Sparkles, MapPin, Search, Calendar, ChevronRight, ShieldCheck, Shirt, RefreshCw } from 'lucide-react'
import AreaAutocomplete from '../components/AreaAutocomplete'

const WOMENS_CATEGORIES = [
  "Office blazer and trouser set", "Single blazer", "Cocktail dress", "Evening gown", 
  "Floral maxi dress", "Midi dress", "Jumpsuit", "Co-ord set", "Kurta and trouser set", 
  "Anarkali suit", "Sharara set", "Lehenga", "Saree with blouse", "Lightweight cotton saree", 
  "Indo-Western dress", "Winter coat"
];

const MENS_CATEGORIES = [
  "Office blazer", "Three-piece suit", "Tuxedo", "Wedding sherwani", "Bandhgala jacket", 
  "Nehru jacket and kurta", "Kurta pajama set", "Indo-Western set", "Waistcoat set", 
  "Dinner jacket", "Casual jacket", "Overcoat", "Formal shirt and trousers", 
  "Wedding suit in a light color", "Festival jacket"
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"];

export default function Home() {
  const { account, allGarments, hasMoreGarments, loadMoreGarments, searchQuery, setSearchQuery, selectedArea, savedGarmentIds = [] } = useMarketplace()
  const [searchParams, setSearchParams] = useSearchParams()
  const savedOnly = searchParams.get('filter') === 'saved'
  const homeDraftKey = `rewear:${account?.id || 'guest'}:explore`
  
  const [activeFilter, setActiveFilter] = useSessionDraft(`${homeDraftKey}:category`, 'All')
  const [subCategory, setSubCategory] = useSessionDraft(`${homeDraftKey}:subCategory`, '')
  const [maxPrice, setMaxPrice] = useSessionDraft(`${homeDraftKey}:max-price`, '')
  const [sizeFilter, setSizeFilter] = useSessionDraft(`${homeDraftKey}:size`, '')
  const [areaFilter, setAreaFilter] = useSessionDraft(`${homeDraftKey}:area`, '')
  const [occasionFilter, setOccasionFilter] = useSessionDraft(`${homeDraftKey}:occasion`, '')
  const [aiQuery, setAiQuery] = useSessionDraft(`${homeDraftKey}:aiQuery`, '')
  const navigate = require('react-router-dom').useNavigate();
  
  const availableCount = allGarments.filter((garment) => garment.available !== false && garment.ownerId !== account?.id).length
  const completedRentalCount = allGarments.reduce((total, garment) => total + Number(garment.completedRentals || 0), 0)
  const reviewedListingCount = allGarments.filter((garment) => Number(garment.reviewCount || 0) > 0).length
  const filters = ['All', "Women's", "Men's"]
  
  const filteredGarments = allGarments.filter((garment) => {
    if (garment.available === false || garment.ownerId === account?.id) return false
    const category = `${garment.category || ''} ${garment.name}`.toLowerCase()
    
    // Check main category
    const isWomens = WOMENS_CATEGORIES.some(c => category.includes(c.toLowerCase()));
    const isMens = MENS_CATEGORIES.some(c => category.includes(c.toLowerCase()));
    
    let matchesMainCategory = activeFilter === 'All';
    if (activeFilter === "Women's") matchesMainCategory = isWomens || category.includes('women');
    if (activeFilter === "Men's") matchesMainCategory = isMens || category.includes('men');

    const matchesSubCategory = !subCategory || category.includes(subCategory.toLowerCase());
    
    const matchesOccasion = !occasionFilter || category.includes(occasionFilter)
    const searchableText = `${garment.name} ${garment.designer} ${garment.category || ''} ${garment.distance} ${garment.size}`.toLowerCase()
    const matchesBudget = !maxPrice || Number(garment.price) <= Number(maxPrice)
    const matchesSize = !sizeFilter || String(garment.size || '').split(',').map(s => s.trim().toLowerCase()).includes(sizeFilter.toLowerCase())
    const matchesArea = (!areaFilter || String(garment.distance || '').toLowerCase().includes(areaFilter.trim().toLowerCase()))
      && (!selectedArea || String(garment.distance || '').toLowerCase().includes(selectedArea.trim().toLowerCase()))
    const matchesSaved = !savedOnly || savedGarmentIds.includes(String(garment.id))
    return matchesMainCategory && matchesSubCategory && matchesOccasion && matchesBudget && matchesSize && matchesArea && matchesSaved && searchableText.includes(searchQuery.trim().toLowerCase())
  })

  const scrollToTrending = (e) => {
    e?.preventDefault()
    document.getElementById('trending-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-[#FFF9F1] min-h-screen text-[#18212B]">
      
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32">
        {/* Abstract Background Elements matching ReWear */}
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#197B5B]/5 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#781F37]/5 to-transparent blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Copy */}
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[#197B5B] mb-6">
                <span className="w-2 h-2 rounded-full bg-[#197B5B]" />
                <span className="text-xs font-bold uppercase tracking-widest">Shared occasionwear · Chennai</span>
              </div>
              
              <h1 className="font-serif-couture text-5xl md:text-7xl font-black leading-[1.1] mb-6 text-[#18212B]">
                Wear the moment.<br />
                <span className="text-[#C89228] italic">Not the price tag.</span>
              </h1>
              
              <p className="text-lg text-stone-600 mb-8 max-w-lg leading-relaxed">
                Browse and rent clothing for weddings, interviews, farewells, and other occasions. You can also share pieces from your own wardrobe.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mb-12">
                <button 
                  onClick={scrollToTrending}
                  className="bg-[#781F37] hover:bg-[#5E182B] text-white px-8 py-3.5 rounded-xl font-semibold shadow-md transition flex items-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Browse Nearby Racks
                </button>
                <Link 
                  to="/ai-outfit-discovery"
                  className="bg-white border border-[#E8E1D8] text-[#18212B] hover:border-[#197B5B] hover:text-[#197B5B] hover:bg-[#197B5B]/5 px-8 py-3.5 rounded-xl font-semibold shadow-sm transition flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5 text-[#6D4AFF]" />
                  AI Outfit Discovery
                </Link>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#E8E1D8]">
                <div>
                  <div className="font-serif-couture text-3xl font-black text-[#18212B]">{availableCount}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mt-1">Available pieces</div>
                </div>
                <div>
                  <div className="font-serif-couture text-3xl font-black text-[#197B5B]">{completedRentalCount}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mt-1">Completed rentals</div>
                </div>
                <div>
                  <div className="font-serif-couture text-3xl font-black text-[#C89228]">{reviewedListingCount}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mt-1">Reviewed listings</div>
                </div>
              </div>
            </div>
            
            {/* Right Gallery (ReWear style collage) */}
            <div className="relative h-[600px] hidden xl:block">
              {/* Main Portrait */}
              <div className="absolute right-12 top-0 w-[400px] h-[520px] rounded-2xl overflow-hidden shadow-2xl z-10 border-4 border-white transform rotate-2 hover:rotate-0 transition duration-500">
                <img src={HERO_IMAGES.main} alt="Heritage Revival editorial fashion" className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-xl flex items-center justify-between shadow-lg">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#6F747A]">Occasionwear</div>
                    <div className="font-bold text-[#18212B]">Find your next look</div>
                  </div>
                  <div className="bg-[#781F37] text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Browse
                  </div>
                </div>
              </div>
              
              {/* Side Stack 1 */}
              <div className="absolute left-0 top-24 w-[220px] h-[280px] rounded-2xl overflow-hidden shadow-xl z-20 border-4 border-white transform -rotate-6 hover:-rotate-2 transition duration-500">
                <img src={HERO_IMAGES.side1} alt="Pastel mint silk sherwani" className="w-full h-full object-cover" />
              </div>
              
              {/* Side Stack 2 */}
              <div className="absolute left-8 bottom-4 w-[240px] h-[300px] rounded-2xl overflow-hidden shadow-xl z-30 border-4 border-white transform rotate-3 hover:rotate-6 transition duration-500">
                <img src={HERO_IMAGES.side2} alt="Emerald Kanjeevaram silk saree" className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
                  <span className="text-xs font-bold text-[#197B5B]">Farewell Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SMART SEARCH DOCK ===== */}
      <section className="relative z-20 -mt-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-[#E8E1D8]">
          
            <form onSubmit={(e) => {
              e.preventDefault();
              let url = '/ai-outfit-discovery?';
              if (aiQuery) url += `query=${encodeURIComponent(aiQuery)}&`;
              if (occasionFilter) url += `occasion=${encodeURIComponent(occasionFilter)}&`;
              if (areaFilter) url += `area=${encodeURIComponent(areaFilter)}`;
              navigate(url);
            }} className="flex flex-col gap-4">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 focus-within:border-[#781F37] focus-within:ring-1 focus-within:ring-[#781F37] transition">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#781F37]" /> Tell your stylist (AI Outfit Discovery)
                </label>
                <div className="text-lg font-serif-couture text-[#18212B] mb-2">Describe your outfit in your own words.</div>
                <input 
                  type="text" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="I need a classy black blazer for an interview in Chennai under ₹1000 next Monday."
                  className="w-full bg-transparent text-sm font-semibold text-[#18212B] outline-none"
                />
                <div className="text-[10px] text-stone-500 mt-2">AI can turn your request into editable filters. If AI is unavailable, ReWear uses built-in search interpretation.</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 focus-within:border-[#781F37] focus-within:ring-1 focus-within:ring-[#781F37] transition md:col-span-3">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#781F37]" /> Occasion
              </label>
              <select 
                value={occasionFilter} 
                onChange={(e) => setOccasionFilter(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-[#18212B] outline-none appearance-none cursor-pointer"
              >
                <option value="">Any occasion</option>
                <option value="lehenga">Destination Wedding / Sangeet</option>
                <option value="gown">College Farewell / Fest</option>
                <option value="suit">Leadership Interview / Pitch</option>
                <option value="dress">Cocktail Gala / Reception</option>
                <option value="saree">Traditional / Festive</option>
              </select>
            </div>
            
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 focus-within:border-[#781F37] focus-within:ring-1 focus-within:ring-[#781F37] transition md:col-span-4">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-2">
                <MapPin className="w-3.5 h-3.5 text-[#197B5B]" /> Pickup Area
              </label>
              <AreaAutocomplete
                value={areaFilter}
                onChange={setAreaFilter}
                placeholder="Any neighborhood"
                className="w-full bg-transparent text-sm font-semibold text-[#18212B] outline-none placeholder:font-normal placeholder:text-stone-400 text-ellipsis overflow-hidden whitespace-nowrap"
              />
            </div>
            
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 opacity-60 md:col-span-3">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-2">
                <Calendar className="w-3.5 h-3.5 text-[#C89228]" /> Rental Dates
              </label>
              <div className="text-sm font-medium text-stone-500">Choose on listing</div>
            </div>
            
            <button type="submit" className="bg-[#18212B] hover:bg-[#781F37] text-white rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition shadow-md h-full min-h-[64px] md:col-span-2">
                <Search className="w-4 h-4" />
                Find Racks
              </button>
              </div>
            </form>

          {/* Quick Chips */}
          <div className="mt-6 pt-6 border-t border-stone-100 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mr-2">Quick Picks:</span>
            {[
              { emoji: '🌸', label: 'Wedding Sangeet', occasion: 'lehenga' },
              { emoji: '🎓', label: 'College Farewell', occasion: 'gown' },
              { emoji: '💼', label: 'Interviews & Pitch', occasion: 'suit' },
              { emoji: '✨', label: 'Cocktail Nights', occasion: 'dress' },
              { emoji: '🥻', label: 'Kanchipuram Silk', occasion: 'saree' },
            ].map((chip) => (
              <button 
                key={chip.label} 
                onClick={() => setOccasionFilter(chip.occasion)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition ${
                  occasionFilter === chip.occasion 
                    ? 'border-[#197B5B] bg-[#197B5B]/10 text-[#197B5B]' 
                    : 'border-stone-200 bg-white text-stone-600 hover:border-[#197B5B]/30 hover:bg-stone-50'
                }`}
              >
                <span>{chip.emoji}</span> {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Search, color: 'text-[#18212B]', bg: 'bg-[#18212B]/10', title: 'Filter by what matters', desc: 'Browse published listings by category, size, budget, and pickup area.' },
            { icon: Calendar, color: 'text-[#781F37]', bg: 'bg-[#781F37]/10', title: 'Request your dates', desc: 'Choose a pickup date and rental length, then send the request to the provider.' },
            { icon: RefreshCw, color: 'text-[#197B5B]', bg: 'bg-[#197B5B]/10', title: 'Track each rental step', desc: 'Follow confirmation, handover, return, and completion from your wardrobe.' },
            { icon: ShieldCheck, color: 'text-[#C89228]', bg: 'bg-[#C89228]/10', title: 'Feedback after use', desc: 'Renters can leave product feedback after the provider confirms the return.' },
          ].map((card, i) => (
            <div key={i} className="flex flex-col">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${card.bg} ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-[#18212B]">{card.title}</h3>
              <p className="text-sm text-stone-600 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== OCCASION BENTO GRID ===== */}
      <section className="py-16 bg-white border-y border-[#E8E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89228] mb-2">Curated Dressing Rooms</div>
            <h2 className="font-serif-couture text-4xl font-black text-[#18212B]">Dress For The Memory</h2>
            <p className="text-stone-600 mt-4">Choose an occasion category and browse pieces currently listed by clothing owners.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[340px]">
            {OCCASIONS.map((occ) => (
              <div
                key={occ.id}
                className={`relative rounded-3xl overflow-hidden group cursor-pointer ${
                  occ.span === 7 ? 'md:col-span-7' : 'md:col-span-5'
                }`}
                onClick={() => {
                  let newActive = 'All';
                  let newSub = '';
                  if (occ.filter === "Women's Gowns") { newActive = "Women's"; newSub = "gown"; }
                  else if (occ.filter === "Lehengas") { newActive = "Women's"; newSub = "lehenga"; }
                  else if (occ.filter === "Suits & Sherwanis") { newActive = "Men's"; newSub = "suit"; }
                  else if (occ.filter === "Sarees") { newActive = "Women's"; newSub = "saree"; }
                  
                  setActiveFilter(newActive)
                  setSubCategory(newSub)
                  scrollToTrending()
                }}
              >
                <img src={occ.image} alt={occ.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="w-max px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm" style={{
                    background: occ.id === 'farewell' || occ.id === 'festive' ? '#e1f0e8' : occ.id === 'wedding' ? '#f7e8e8' : 'rgba(255,255,255,0.9)',
                    color: occ.id === 'farewell' || occ.id === 'festive' ? '#197b5b' : occ.id === 'wedding' ? '#781f37' : '#18212B'
                  }}>
                    {occ.tag}
                  </div>
                  <h3 className={`font-serif-couture font-black text-white ${occ.span === 7 ? 'text-4xl' : 'text-3xl'}`}>{occ.title}</h3>
                  <p className="text-stone-200 mt-3 text-sm max-w-md line-clamp-2">{occ.desc}</p>
                  
                  <div className="mt-6 flex items-center gap-2 text-white font-semibold text-sm group-hover:text-[#C89228] transition-colors">
                    {occ.link} <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRENDING NEARBY ===== */}
      <section id="trending-section" className="py-24 bg-stone-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#197B5B] mb-2">Current listings</div>
              <h2 className="font-serif-couture text-4xl font-black text-[#18212B]">
                {savedOnly ? 'Your saved outfits' : selectedArea ? `Browse near ${selectedArea}` : 'Browse clothing'}
              </h2>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => { setActiveFilter(f); setSubCategory(''); }}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    activeFilter === f 
                      ? 'bg-white text-[#18212B] font-bold shadow-sm border border-stone-200' 
                      : 'bg-transparent text-stone-500 hover:bg-white/50 border border-transparent font-medium'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Inline Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-10 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            {(activeFilter === "Women's" || activeFilter === "Men's") && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#6F747A] uppercase tracking-wider ml-2">Category</span>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-[#781F37]"
                >
                  <option value="">All Categories</option>
                  {(activeFilter === "Women's" ? WOMENS_CATEGORIES : MENS_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#6F747A] uppercase tracking-wider ml-2">Budget</span>
              <select 
                value={maxPrice} 
                onChange={(e) => setMaxPrice(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-[#781F37]"
              >
                <option value="">Any budget</option>
                <option value="800">Up to ₹800</option>
                <option value="1200">Up to ₹1,200</option>
                <option value="2500">Up to ₹2,500</option>
                <option value="5000">Up to ₹5,000</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#6F747A] uppercase tracking-wider">Size</span>
              <select 
                value={sizeFilter} 
                onChange={(e) => setSizeFilter(e.target.value)} 
                className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-[#781F37]"
              >
                <option value="">Any size</option>
                {SIZES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#6F747A] uppercase tracking-wider">Area</span>
              <div className="w-48">
                <AreaAutocomplete
                  value={areaFilter}
                  onChange={setAreaFilter}
                  placeholder="Any neighborhood"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-[#781F37] placeholder:font-normal"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGarments.map((g) => (
              <GarmentCard key={g.id} garment={g} />
            ))}
          </div>

          {hasMoreGarments && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={loadMoreGarments}
                className="px-8 py-3 bg-white border border-[#E8E1D8] text-[#18212B] font-bold rounded-xl shadow-sm hover:bg-stone-50 transition"
              >
                Load more listings
              </button>
            </div>
          )}

          {filteredGarments.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 shadow-sm mt-6">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="font-serif-couture text-2xl font-black text-[#18212B] mb-2">No outfits match that search</h3>
              <p className="text-stone-500 mb-6 max-w-md mx-auto">
                {savedOnly ? 'Save an outfit with the heart button and it will appear here.' : 'Try another style, size, designer, or neighborhood.'}
              </p>
              {savedOnly ? (
                <Link to="/browse" className="inline-block bg-[#18212B] text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-[#2A3441] transition">
                  Browse all clothing
                </Link>
              ) : (
                <button 
                  onClick={() => { setSearchQuery(''); setActiveFilter('All'); setSubCategory(''); setMaxPrice(''); setSizeFilter(''); setAreaFilter(''); setOccasionFilter(''); setSearchParams({}) }}
                  className="bg-[#18212B] text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-[#2A3441] transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-24 bg-[#781F37] text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-serif-couture text-4xl md:text-5xl font-black mb-6">
            Your wardrobe is someone's dream outfit
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
            Add the rental price, size, condition, and pickup area for pieces you are ready to share.
          </p>
          <Link 
            to="/my-closet" 
            className="inline-flex items-center gap-2 bg-white text-[#781F37] px-8 py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
          >
            <Shirt className="w-5 h-5" />
            Start Listing Your Wardrobe
          </Link>
        </div>
      </section>
      
      
    </div>
  )
}

