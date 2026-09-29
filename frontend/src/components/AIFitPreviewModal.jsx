import { useState, useEffect } from 'react'
import { X, Ruler, UserCircle2, Camera, ShieldCheck, Shirt, ArrowRight, Expand } from 'lucide-react'

export default function AIFitPreviewModal({ garment, onClose, onConfirmSize }) {
  const [measurement, setMeasurement] = useState({ bust: '34', waist: '28', hip: '38', height: '165' })
  const [selectedSize, setSelectedSize] = useState('M')
  const [imageMode, setImageMode] = useState('overlay')
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  const availableSizes = garment.size ? String(garment.size).split(',').map(s => s.trim()) : ['S', 'M', 'L']

  // Mock calculation
  const getFitMode = (size) => {
    if (size === 'S') return { mode: 'SNUG', color: 'text-[#D89022]', bg: 'bg-[#D89022]/10', ease: '-2cm ease' }
    if (size === 'M') return { mode: 'REGULAR', color: 'text-[#197B5B]', bg: 'bg-[#197B5B]/10', ease: '+3cm ease' }
    if (size === 'L') return { mode: 'OVERSIZED', color: 'text-[#6D4AFF]', bg: 'bg-[#6D4AFF]/10', ease: '+8cm ease' }
    return { mode: 'REGULAR', color: 'text-[#197B5B]', bg: 'bg-[#197B5B]/10', ease: '+3cm ease' }
  }

  const handleSimulate = () => {
    setIsSimulating(true)
    setTimeout(() => {
      setIsSimulating(false)
    }, 2000)
  }

  useEffect(() => {
    handleSimulate()
  }, [selectedSize, imageMode])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#18212B]/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#FFF9F1] h-full shadow-2xl flex flex-col relative overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#FFF9F1]/95 backdrop-blur-md z-10 border-b border-[#E8E1D8] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif-couture text-2xl font-black text-[#18212B]">AI Fit Preview</h2>
            <p className="text-sm text-[#6F747A]">Virtual Try-On & Sizing Analysis</p>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-[#18212B] rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          
          {/* Privacy Panel */}
          <div className="bg-[#197B5B]/10 border border-[#197B5B]/20 p-4 rounded-2xl flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#197B5B] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#197B5B] uppercase tracking-wider mb-1">Privacy-First AI</h4>
              <p className="text-xs text-[#197B5B]/80 leading-relaxed">
                Your photos and measurements are processed securely for this session only. Zero permanent photo storage. 
                They are never used to train global AI models.
              </p>
            </div>
          </div>

          {/* User Measurements */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserCircle2 className="w-4 h-4 text-[#6F747A]" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Your Measurement Profile</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(measurement).map(([key, val]) => (
                <div key={key} className="bg-white border border-[#E8E1D8] p-3 rounded-xl shadow-sm">
                  <label className="text-[10px] uppercase text-[#6F747A] font-bold block mb-1 capitalize">{key}</label>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="number" 
                      value={val} 
                      onChange={e => setMeasurement({...measurement, [key]: e.target.value})}
                      className="w-full text-lg font-bold text-[#18212B] bg-transparent outline-none p-0 border-none"
                    />
                    <span className="text-xs text-[#6F747A]">cm</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Visual Try-On */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#6F747A]" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Clothed Photo Simulation</h3>
              </div>
              <div className="flex bg-stone-200 p-1 rounded-lg">
                <button 
                  onClick={() => setImageMode('overlay')} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${imageMode === 'overlay' ? 'bg-white shadow text-[#18212B]' : 'text-[#6F747A]'}`}
                >
                  Overlay Preview
                </button>
                <button 
                  onClick={() => setImageMode('upload')} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${imageMode === 'upload' ? 'bg-white shadow text-[#18212B]' : 'text-[#6F747A]'}`}
                >
                  Upload Photo
                </button>
              </div>
            </div>

            <div className="relative aspect-[3/4] sm:aspect-video bg-stone-100 rounded-3xl border border-[#E8E1D8] overflow-hidden flex items-center justify-center shadow-inner">
              {isSimulating ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-[#E8E1D8] border-t-[#781F37] rounded-full animate-spin" />
                  <p className="text-sm font-medium text-[#6F747A]">Generating {selectedSize} fit simulation...</p>
                </div>
              ) : (
                <>
                  {imageMode === 'overlay' ? (
                    <div className="relative w-full h-full">
                      {/* Placeholder for the avatar overlay */}
                      <img src={garment.image} alt={garment.name} className="absolute inset-0 w-full h-full object-contain opacity-40 blur-sm mix-blend-multiply" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-96 border-2 border-dashed border-[#781F37]/50 rounded-3xl flex flex-col items-center justify-center text-center p-6 bg-white/50 backdrop-blur-sm shadow-xl">
                          <Shirt className="w-12 h-12 text-[#781F37] mb-2 opacity-50" />
                          <p className="font-bold text-[#18212B] text-lg mb-1">{selectedSize} Fit</p>
                          <p className="text-xs text-[#781F37] font-medium">{getFitMode(selectedSize).mode}</p>
                        </div>
                      </div>
                    </div>
                  ) : uploadedPhotoUrl ? (
                    <div className="relative w-full h-full">
                      <img src={uploadedPhotoUrl} alt="User photo" className="absolute inset-0 w-full h-full object-cover" />
                      <img src={garment.image} alt={garment.name} className="absolute inset-0 w-full h-full object-contain opacity-70 drop-shadow-2xl mix-blend-multiply" />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                         <div className="bg-black/60 backdrop-blur text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-full">AI Privacy Preview Active</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center p-6">
                      <Camera className="w-10 h-10 text-stone-300 mb-3" />
                      <p className="text-sm font-medium text-[#18212B] mb-1">Upload a full-body photo</p>
                      <p className="text-xs text-[#6F747A] mb-4">Must be clothed. Form-fitting clothes work best.</p>
                      <label className="px-4 py-2 bg-white border border-[#E8E1D8] shadow-sm rounded-lg text-xs font-bold text-[#18212B] hover:bg-stone-50 cursor-pointer">
                        Choose Photo
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => { 
                          if (e.target.files && e.target.files[0]) { 
                            setUploadedPhotoUrl(URL.createObjectURL(e.target.files[0])); 
                            handleSimulate(); 
                          } 
                        }} />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Size Comparison */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="w-4 h-4 text-[#6F747A]" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">Size Comparison</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-4">
              {availableSizes.map(size => {
                const fitInfo = getFitMode(size)
                const isSelected = size === selectedSize
                
                return (
                  <button 
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected 
                        ? 'bg-white border-[#781F37] shadow-md ring-1 ring-[#781F37]' 
                        : 'bg-white border-[#E8E1D8] hover:border-stone-300 shadow-sm opacity-70'
                    }`}
                  >
                    <div className="text-lg font-black text-[#18212B]">{size}</div>
                    <div className={`text-[10px] font-bold mt-1 ${fitInfo.color}`}>{fitInfo.mode}</div>
                    <div className="text-xs text-[#6F747A] mt-0.5">{fitInfo.ease}</div>
                  </button>
                )
              })}
            </div>

            {/* Expandable Seam Ease Analysis */}
            <div className="bg-white rounded-xl border border-[#E8E1D8] shadow-sm overflow-hidden">
              <button 
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="w-full p-4 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition"
              >
                <div className="flex items-center gap-2">
                  <Expand className="w-4 h-4 text-[#18212B]" />
                  <span className="text-xs font-bold text-[#18212B]">Seam Ease Analysis for {selectedSize}</span>
                </div>
                <span className="text-lg font-light">{showAnalysis ? '−' : '+'}</span>
              </button>
              
              {showAnalysis && (
                <div className="p-4 border-t border-[#E8E1D8] space-y-3">
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-[#6F747A]">Bust</span>
                    <span className="font-medium text-[#18212B]">34"</span>
                    <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#197B5B] w-[80%]"></div>
                      <div className="h-full bg-[#197B5B]/30 flex-1"></div>
                    </div>
                    <span className="text-[#197B5B] font-medium">+2" ease</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-[#6F747A]">Waist</span>
                    <span className="font-medium text-[#18212B]">28"</span>
                    <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#D89022] w-[95%]"></div>
                      <div className="h-full bg-[#D89022]/30 flex-1"></div>
                    </div>
                    <span className="text-[#D89022] font-medium">+0.5" ease</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-[#6F747A]">Hip</span>
                    <span className="font-medium text-[#18212B]">38"</span>
                    <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#6D4AFF] w-[60%]"></div>
                      <div className="h-full bg-[#6D4AFF]/30 flex-1"></div>
                    </div>
                    <span className="text-[#6D4AFF] font-medium">+4" ease</span>
                  </div>
                  <p className="text-[10px] text-[#6F747A] mt-2 italic">
                    Ease indicates the extra fabric room beyond your body measurement. 
                    A negative ease means the fabric will stretch.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#E8E1D8] p-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A] block">Selected Size</span>
            <span className="text-xl font-black text-[#18212B]">{selectedSize}</span>
          </div>
          <button 
            onClick={() => onConfirmSize(selectedSize)}
            className="px-6 py-3 bg-[#781F37] hover:bg-[#5E182B] text-white font-bold rounded-xl shadow-md transition flex items-center gap-2"
          >
            Save to Order <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}



