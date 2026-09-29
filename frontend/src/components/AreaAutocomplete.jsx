import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

export default function AreaAutocomplete({ value, onChange, placeholder, className }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchAreas = async () => {
      if (!query || query.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const formattedResults = data.map(item => {
          const parts = item.display_name.split(',').map(s => s.trim());
          return parts.slice(0, 3).join(', ');
        });
        setResults([...new Set(formattedResults)]);
      } catch (error) {
        console.error("Error fetching areas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchAreas, 500);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (area) => {
    setQuery(area);
    onChange(area);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val) onChange('');
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        title={query}
      />
      {isOpen && (query.length >= 3) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-stone-500">Loading...</div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((area, index) => (
                <li
                  key={index}
                  onClick={() => handleSelect(area)}
                  className="px-4 py-2 text-sm text-[#18212B] hover:bg-stone-100 cursor-pointer flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <span className="truncate">{area}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-sm text-stone-500">No areas found</div>
          )}
        </div>
      )}
    </div>
  );
}
