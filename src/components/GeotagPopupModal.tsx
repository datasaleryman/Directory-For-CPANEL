import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Navigation, ExternalLink, Copy, Check, Info, Phone, Compass } from 'lucide-react';
import { Contact } from '../types.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeotagPopupModalProps {
  contact: Contact;
  onClose: () => void;
  onTrackInFullMap: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const GeotagPopupModal: React.FC<GeotagPopupModalProps> = ({
  contact,
  onClose,
  onTrackInFullMap,
  showToast
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const { latitude, longitude, full_name, barangay, purok, contact_number } = contact;

  // Initialize mini-map centered on the contact's coordinates
  useEffect(() => {
    if (!latitude || !longitude || !mapContainerRef.current) return;

    // Use a short timeout to let the modal transition finish and DOM fully settle
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) return;

      try {
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          maxZoom: 28,
          minZoom: 1
        }).setView([latitude, longitude], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 28,
          maxNativeZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        // Custom pulsing marker pin matching the theme
        const activeMarkerIcon = L.divIcon({
          className: 'custom-pulsing-geotag-pin',
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
              <span style="position: absolute; display: inline-flex; width: 100%; height: 100%; border-radius: 50%; background-color: #0d9488; opacity: 0.4; animate: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <div style="position: relative; display: flex; align-items: center; justify-content: center; height: 18px; width: 18px; border-radius: 50%; background-color: #0f766e; border: 2.5px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <div style="width: 4px; height: 4px; border-radius: 50%; background-color: #ffffff;"></div>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        L.marker([latitude, longitude], { icon: activeMarkerIcon })
          .addTo(map)
          .bindPopup(`<strong class="text-slate-800">${full_name}</strong><br/><span class="text-xs text-slate-500">${purok}, ${barangay}</span>`)
          .openPopup();

        mapInstanceRef.current = map;
        setMapReady(true);

        // Force a resize re-calculation to prevent gray boxes/broken tiles
        setTimeout(() => {
          map.invalidateSize();
        }, 150);

      } catch (err) {
        console.error('Error rendering modal Leaflet map:', err);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude]);

  const copyCoordinates = () => {
    if (!latitude || !longitude) return;
    const coordsText = `${latitude}, ${longitude}`;
    navigator.clipboard.writeText(coordsText).then(() => {
      setCopied(true);
      showToast('Coordinates copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openInGoogleMaps = () => {
    if (!latitude || !longitude) return;
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh] md:h-[550px] animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Map Panel */}
        <div className="relative flex-1 bg-slate-100 h-1/2 md:h-full min-h-[220px]">
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {!mapReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 text-slate-500 gap-3 z-10">
              <div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Initializing location map...</span>
            </div>
          )}

          {/* Map Badges */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 shadow-xs border border-slate-200 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-teal-600" />
            <span>Map coordinates locked</span>
          </div>
        </div>

        {/* Info & Navigation Details Panel */}
        <div className="w-full md:w-[350px] bg-white p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 h-1/2 md:h-full overflow-y-auto">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                  <MapPin className="w-3 h-3" /> Geotagged Household
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2 line-clamp-2">{full_name}</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Household Location Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 shrink-0">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Address</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{purok}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Barangay {barangay}</p>
                </div>
              </div>

              {contact_number && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact Number</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{contact_number}</p>
                  </div>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">GPS Coordinates</p>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
                  </div>
                  <button
                    onClick={copyCoordinates}
                    className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50/50 rounded-lg transition-colors cursor-pointer"
                    title="Copy Coordinates"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 mt-6">
            <button
              onClick={onTrackInFullMap}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer text-sm"
            >
              <Navigation className="w-4 h-4" />
              Track in Full Map
            </button>

            <button
              onClick={openInGoogleMaps}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-medium rounded-xl transition-colors cursor-pointer text-sm"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              Open in Google Maps
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
