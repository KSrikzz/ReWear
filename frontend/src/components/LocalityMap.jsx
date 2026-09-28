import { useMemo, useState } from 'react'
import { Map as MapIcon, Store } from 'lucide-react'

const WIDTH = 720
const HEIGHT = 420
const ZOOM = 12
const TILE_SIZE = 256
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION_NAME = import.meta.env.VITE_MAP_ATTRIBUTION_NAME || '© OpenStreetMap contributors'
const ATTRIBUTION_URL = import.meta.env.VITE_MAP_ATTRIBUTION_URL || 'https://www.openstreetmap.org/copyright'

function point(latitude, longitude) {
  const world = TILE_SIZE * (2 ** ZOOM)
  const lat = Math.max(-85.0511, Math.min(85.0511, Number(latitude))) * Math.PI / 180
  return {
    x: (Number(longitude) + 180) / 360 * world,
    y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * world,
  }
}

function toTileUrl(x, y) {
  const count = 2 ** ZOOM
  const wrappedX = ((x % count) + count) % count
  return TILE_URL.replace('{z}', String(ZOOM)).replace('{x}', String(wrappedX)).replace('{y}', String(y))
}

export default function LocalityMap({ items = [], hubs = [], searchLocation, onSelectItem }) {
  const [activeMarker, setActiveMarker] = useState('')
  const listings = useMemo(() => items.flatMap((item) => {
    const garment = item.garment
    const latitude = Number(garment.approximateLatitude)
    const longitude = Number(garment.approximateLongitude)
    return garment.approximateLatitude != null && garment.approximateLongitude != null
      && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ ...item, latitude, longitude }]
      : []
  }), [items])
  const hubMarkers = useMemo(() => hubs.flatMap((hub) => {
    const latitude = Number(hub.approximateLatitude)
    const longitude = Number(hub.approximateLongitude)
    return hub.approximateLatitude != null && hub.approximateLongitude != null
      && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ ...hub, latitude, longitude }] : []
  }), [hubs])
  const clusters = useMemo(() => {
    const groups = new Map()
    listings.forEach((item) => {
      const key = `${item.latitude.toFixed(2)}:${item.longitude.toFixed(2)}`
      const group = groups.get(key) || { id: key, latitude: item.latitude, longitude: item.longitude, items: [] }
      group.items.push(item)
      groups.set(key, group)
    })
    return [...groups.values()]
  }, [listings])

  const center = useMemo(() => {
    if (searchLocation?.latitude != null && searchLocation?.longitude != null) return searchLocation
    const points = [...clusters, ...hubMarkers]
    if (!points.length) return null
    return {
      latitude: points.reduce((sum, value) => sum + value.latitude, 0) / points.length,
      longitude: points.reduce((sum, value) => sum + value.longitude, 0) / points.length,
    }
  }, [clusters, hubMarkers, searchLocation])

  const map = useMemo(() => {
    if (!center) return null
    const projected = point(center.latitude, center.longitude)
    const left = projected.x - WIDTH / 2
    const top = projected.y - HEIGHT / 2
    const firstX = Math.floor(left / TILE_SIZE)
    const lastX = Math.floor((left + WIDTH) / TILE_SIZE)
    const firstY = Math.floor(top / TILE_SIZE)
    const lastY = Math.floor((top + HEIGHT) / TILE_SIZE)
    const tiles = []
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        if (y < 0 || y >= 2 ** ZOOM) continue
        tiles.push({ key: `${x}:${y}`, url: toTileUrl(x, y), left: x * TILE_SIZE - left, top: y * TILE_SIZE - top })
      }
    }
    const markerPosition = (latitude, longitude) => {
      const marker = point(latitude, longitude)
      return { left: `${(marker.x - left) / WIDTH * 100}%`, top: `${(marker.y - top) / HEIGHT * 100}%` }
    }
    return { tiles, markerPosition }
  }, [center])

  if (!listings.length && !hubMarkers.length) {
    return (
      <div className="bg-stone-50 border border-stone-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center text-[#6F747A] min-h-[300px]">
        <MapIcon className="w-12 h-12 mb-4 text-stone-300" aria-hidden="true" />
        <div className="max-w-sm">
          <h3 className="text-lg font-serif-couture text-[#18212B] mb-2">Map points are not available yet</h3>
          <p className="text-sm">Listings appear here when their owners add an approximate area. Search by locality or PIN code to keep discovering nearby pieces.</p>
        </div>
      </div>
    )
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm overflow-hidden flex flex-col" aria-label="Nearby clothing map">
      <div className="relative w-full bg-[#e5e3df] overflow-hidden" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {map.tiles.map((tile) => (
            <img 
              key={tile.key} 
              src={tile.url} 
              alt="" 
              className="absolute w-[256px] h-[256px]"
              style={{ left: `${tile.left / WIDTH * 100}%`, top: `${tile.top / HEIGHT * 100}%` }} 
              loading="lazy" 
            />
          ))}
        </div>
        
        {clusters.map((cluster) => (
          <button
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#781F37] ${
              activeMarker === cluster.id 
                ? 'bg-[#781F37] border-white text-white z-20 scale-110' 
                : 'bg-white border-[#781F37] text-[#781F37]'
            }`}
            key={cluster.id}
            type="button"
            style={map.markerPosition(cluster.latitude, cluster.longitude)}
            aria-label={`${cluster.items.length} clothing listing${cluster.items.length === 1 ? '' : 's'} in this area`}
            onClick={() => setActiveMarker(activeMarker === cluster.id ? '' : cluster.id)}
          >
            {cluster.items.length}
          </button>
        ))}
        
        {hubMarkers.map((hub) => (
          <button
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-xl shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#C89228] ${
              activeMarker === `hub:${hub.id}` 
                ? 'bg-[#C89228] text-white z-20 scale-110' 
                : 'bg-white text-[#C89228]'
            }`}
            key={hub.id}
            type="button"
            style={map.markerPosition(hub.latitude, hub.longitude)}
            aria-label={`Pickup hub ${hub.name}, ${hub.area}`}
            onClick={() => setActiveMarker(activeMarker === `hub:${hub.id}` ? '' : `hub:${hub.id}`)}
          >
            <Store className="w-4 h-4" aria-hidden="true" />
          </button>
        ))}
        
        {searchLocation && map && (
          <span 
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#6D4AFF] border-2 border-white shadow-md animate-pulse" 
            style={map.markerPosition(searchLocation.latitude, searchLocation.longitude)} 
            title="Your approximate search area"
          >
            <span className="sr-only">You</span>
          </span>
        )}
        
        {activeMarker.startsWith('hub:') && (() => {
          const hub = hubMarkers.find((item) => `hub:${item.id}` === activeMarker)
          return hub ? (
            <div className="absolute z-30 bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-[#E8E1D8] p-4 min-w-[200px] text-center">
              <strong className="block text-[#18212B] font-medium mb-1">{hub.name}</strong>
              <span className="block text-sm text-[#6F747A] mb-2">{hub.area}, {hub.city}</span>
              <small className="inline-block bg-[#FFF9F1] text-[#C89228] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Verified pickup hub</small>
            </div>
          ) : null
        })()}
        
        {clusters.find((cluster) => cluster.id === activeMarker) && (
          <div className="absolute z-30 bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-[#E8E1D8] p-4 min-w-[240px] max-w-[300px]">
            <strong className="block text-[10px] font-bold uppercase tracking-wider text-[#6F747A] mb-3 border-b border-stone-100 pb-2">
              {clusters.find((cluster) => cluster.id === activeMarker).items.length} nearby listing{clusters.find((cluster) => cluster.id === activeMarker).items.length === 1 ? '' : 's'}
            </strong>
            <div className="space-y-2">
              {clusters.find((cluster) => cluster.id === activeMarker).items.slice(0, 4).map((item) => (
                <button 
                  type="button" 
                  key={item.garment.id} 
                  className="w-full text-left text-sm text-[#18212B] hover:text-[#781F37] truncate block transition-colors"
                  onClick={() => onSelectItem?.(item.garment.id)}
                >
                  {item.garment.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="absolute bottom-2 right-2 z-10 bg-white/80 backdrop-blur px-2 py-0.5 rounded text-[10px] text-[#6F747A]">
          <a href={ATTRIBUTION_URL} target="_blank" rel="noreferrer" className="hover:underline">{ATTRIBUTION_NAME}</a>
        </div>
      </div>
      
      <div className="p-4 bg-stone-50 border-t border-[#E8E1D8]">
        <p className="text-xs text-[#6F747A] mb-1">Map markers show broad seller areas and verified hubs. Home addresses and exact GPS coordinates stay private. Map tiles use the configured provider.</p>
        {hubMarkers.length === 0 && <p className="text-[10px] font-bold uppercase tracking-wider text-[#18212B]">No verified pickup hubs have been added for this area yet.</p>}
      </div>
    </section>
  )
}
