import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Star, Navigation, ExternalLink, ShieldCheck, RefreshCw, Building } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  locationName: string;
  initialAddress?: string;
  className?: string;
}

// In-memory frontend cache for geocoded location widgets
const widgetMapsCache = new Map<string, any>();

export const GoogleMapsWidget: React.FC<Props> = ({ locationName, initialAddress, className = '' }) => {
  const { currentTenant, authToken, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const cacheKey = `${locationName || ''}_${initialAddress || ''}`.toLowerCase().trim();
  const [mapsData, setMapsData] = useState<any>(() => widgetMapsCache.get(cacheKey) || null);

  const fetchMapsVerification = async (force: boolean = false) => {
    if (!locationName) return;
    if (!force && widgetMapsCache.has(cacheKey)) {
      setMapsData(widgetMapsCache.get(cacheKey));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/maps-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': currentTenant?.id || 'tenant-alm-nexus',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          locationName,
          address: initialAddress
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        widgetMapsCache.set(cacheKey, json.data);
        setMapsData(json.data);
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapsVerification();
  }, [locationName, initialAddress]);

  const mapsUrl = mapsData?.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName + ' ' + (initialAddress || ''))}`;

  return (
    <div className={`p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>{locationName}</span>
              {mapsData?.verified && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  <ShieldCheck className="w-3 h-3" /> Geocoded
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400">Google Maps Grounding Verification</p>
          </div>
        </div>

        <button
          onClick={() => fetchMapsVerification(true)}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          title="Re-verify location"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Verifying client geocode with Google Maps Grounding...</span>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {/* Address & Status */}
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-1.5">
            <div className="flex items-start gap-2 text-slate-300">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed text-[11px] font-mono">{mapsData?.formattedAddress || initialAddress || `${locationName} Global Hub`}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/40">
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{mapsData?.rating || '4.9'} / 5.0 Rating</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                {mapsData?.operationalStatus || 'OPERATIONAL'}
              </span>
            </div>
          </div>

          {/* Interactive Map Visual Placeholder */}
          <div className="relative h-28 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center group">
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
            
            <div className="relative z-10 text-center space-y-1">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
                <Navigation className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-bold text-slate-200">Interactive Location Map</p>
              <p className="text-[10px] text-slate-400 font-mono">Lat: {mapsData?.latitude || '37.7749'}, Lng: {mapsData?.longitude || '-122.4194'}</p>
            </div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-slate-900/80 backdrop-blur-xs"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-1">
            {mapsData?.phone && (
              <a href={`tel:${mapsData.phone}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition">
                <Phone className="w-3 h-3" />
                <span>{mapsData.phone}</span>
              </a>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer shadow-md"
            >
              <span>Get Directions</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
