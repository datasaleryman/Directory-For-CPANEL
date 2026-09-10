import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Eye, Phone, User, RefreshCw, Navigation, ArrowLeft } from 'lucide-react';
import { Contact } from '../types.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ClinicMapProps {
  authToken: string;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  initialNavigateContact?: Contact | null;
  onClearInitialNavigateContact?: () => void;
  lastSyncTime?: string | null;
  onBack?: () => void;
}

export const ClinicMap: React.FC<ClinicMapProps> = ({
  authToken,
  showToast,
  initialNavigateContact,
  onClearInitialNavigateContact,
  lastSyncTime,
  onBack
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);
  const leafletLoaded = true;

  // Live Navigation States
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<Contact | null>(null);
  const [navigationStats, setNavigationStats] = useState<{ distance: string; eta: string } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<any>(null);
  const userMarkerInstanceRef = useRef<any>(null);
  const routeLineInstanceRef = useRef<any>(null);
  const teardropMarkerRef = useRef<any>(null);

  // Haversine formula to compute exact distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  // Human-friendly ETA based on distance
  const estimateETA = (distanceKm: number): string => {
    if (distanceKm < 0.05) return "Arrived";
    if (distanceKm < 1) {
      const mins = Math.max(1, Math.round(distanceKm * 15)); // Walking pace
      return `${mins} min${mins > 1 ? 's' : ''} (walk)`;
    } else {
      const mins = Math.max(2, Math.round(distanceKm * 2)); // Driving pace
      return `${mins} min${mins > 1 ? 's' : ''} (drive)`;
    }
  };

  // Stop active navigation and remove layers
  const stopNavigation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (userMarkerInstanceRef.current) {
      try {
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(userMarkerInstanceRef.current)) {
          mapInstanceRef.current.removeLayer(userMarkerInstanceRef.current);
        }
      } catch (e) {}
      userMarkerInstanceRef.current = null;
    }
    if (routeLineInstanceRef.current) {
      try {
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(routeLineInstanceRef.current)) {
          mapInstanceRef.current.removeLayer(routeLineInstanceRef.current);
        }
      } catch (e) {}
      routeLineInstanceRef.current = null;
    }

    setIsNavigating(false);
    setUserLocation(null);
    setNavigationTarget(null);
    setNavigationStats(null);
  };

  // Update real-time marker position and route line as user moves
  const updateNavigationOnMap = (userLat: number, userLng: number, target: Contact) => {
    if (!mapInstanceRef.current || !target.latitude || !target.longitude) return;

    try {
      const dist = calculateDistance(userLat, userLng, target.latitude, target.longitude);
      const etaStr = estimateETA(dist);
      const distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`;
      setNavigationStats({ distance: distStr, eta: etaStr });

      // Custom pulsating blue GPS location pin
      const gpsPulseIcon = L.divIcon({
        className: 'gps-custom-dot',
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="position: absolute; width: 22px; height: 22px; background-color: #3b82f6; border-radius: 50%; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 5px; left: 5px; width: 12px; height: 12px; background-color: #1d4ed8; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.35);"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      if (userMarkerInstanceRef.current && mapInstanceRef.current.hasLayer(userMarkerInstanceRef.current)) {
        userMarkerInstanceRef.current.setLatLng([userLat, userLng]);
      } else {
        userMarkerInstanceRef.current = L.marker([userLat, userLng], { icon: gpsPulseIcon }).addTo(mapInstanceRef.current);
      }

      const routeCoords: [number, number][] = [
        [userLat, userLng],
        [target.latitude, target.longitude]
      ];

      if (routeLineInstanceRef.current && mapInstanceRef.current.hasLayer(routeLineInstanceRef.current)) {
        routeLineInstanceRef.current.setLatLngs(routeCoords);
      } else {
        routeLineInstanceRef.current = L.polyline(routeCoords, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
          lineJoin: 'round'
        }).addTo(mapInstanceRef.current);
      }

      // Centered user following: Fix the map view to follow the user closely so they can track where the route is going through
      mapInstanceRef.current.setView([userLat, userLng], 17, { animate: true });
    } catch (e) {
      console.warn('Navigation map update skipped:', e);
    }
  };

  // Start active GPS tracker
  const startNavigation = (target: Contact) => {
    if (!target.latitude || !target.longitude) {
      showToast('This household has no valid coordinates.', 'error');
      return;
    }

    stopNavigation();
    setNavigationTarget(target);
    setIsNavigating(true);

    const startGPSSimulation = () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      showToast('Using Simulated Live GPS Navigation Route to demonstrate real-time movement!', 'success');
      
      // Start slightly southwest of the target
      let currentLat = target.latitude! - 0.003;
      let currentLng = target.longitude! - 0.004;
      
      setUserLocation({ latitude: currentLat, longitude: currentLng });
      updateNavigationOnMap(currentLat, currentLng, target);

      const steps = 20; // 20 steps to reach the target
      let currentStep = 0;
      
      simulationIntervalRef.current = setInterval(() => {
        if (currentStep >= steps) {
          // Arrived!
          setUserLocation({ latitude: target.latitude!, longitude: target.longitude! });
          updateNavigationOnMap(target.latitude!, target.longitude!, target);
          showToast(`You have arrived at ${target.full_name}'s household!`, 'success');
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          return;
        }

        currentStep++;
        const ratio = currentStep / steps;
        // Slight realistic curve
        const curveOffsetLat = Math.sin(ratio * Math.PI) * 0.0003;
        const curveOffsetLng = Math.cos(ratio * Math.PI) * 0.0002;
        
        currentLat = (target.latitude! - 0.003) + (0.003 * ratio) + curveOffsetLat;
        currentLng = (target.longitude! - 0.004) + (0.004 * ratio) + curveOffsetLng;

        setUserLocation({ latitude: currentLat, longitude: currentLng });
        updateNavigationOnMap(currentLat, currentLng, target);
      }, 1500); // Progress route every 1.5s
    };

    if (!navigator.geolocation) {
      console.warn('GPS Geolocation is not supported by your browser. Falling back to simulation.');
      startGPSSimulation();
      return;
    }

    // Try real GPS first, but with a timeout fallback
    let gpsSuccess = false;
    const gpsTimeout = setTimeout(() => {
      if (!gpsSuccess) {
        console.warn('GPS initial query timed out. Falling back to simulated route tracking.');
        startGPSSimulation();
      }
    }, 4500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        gpsSuccess = true;
        clearTimeout(gpsTimeout);
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        updateNavigationOnMap(latitude, longitude, target);
        showToast(`Real-time GPS navigation to ${target.full_name} started!`, 'success');
      },
      (error) => {
        gpsSuccess = true; // prevent double triggers
        clearTimeout(gpsTimeout);
        console.warn('Initial GPS query failed:', error.message || error);
        startGPSSimulation();
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
    );

    // Watch real GPS but log errors silently so it doesn't alert annoyingly if it fails, allowing simulation to run
    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        updateNavigationOnMap(latitude, longitude, target);
      },
      (error) => {
        console.warn('GPS watch warning (simulation handles movement):', error.message || error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    watchIdRef.current = id;
  };

  // Clean up GPS listener and simulation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // Fetch all non-deleted contacts that have coordinates
  const fetchGeotaggedContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts/export', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch geotagged contacts.');
      }
      // Filter those that have coordinates
      const geotagged = Array.isArray(data)
        ? data.filter((c: Contact) => c.geotagged && c.latitude && c.longitude)
        : [];
      setContacts(geotagged);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeotaggedContacts();
  }, [lastSyncTime]);

  // Set custom style animations on mount
  useEffect(() => {
    // Inject custom pulsing dot and bouncing teardrop styles
    const styleId = 'clinic-map-custom-styles';
    if (!document.getElementById(styleId)) {
      const customStyle = document.createElement('style');
      customStyle.id = styleId;
      customStyle.textContent = `
        @keyframes teardrop-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .custom-teardrop-bounce {
          animation: teardrop-bounce 2s ease-in-out infinite;
        }
      `;
      document.head.appendChild(customStyle);
    }
  }, []);

  // Initialize Map Instance once on mount
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    // Allow user to zoom in to the map with no limit (maxZoom: 28)
    const map = L.map(mapContainerRef.current, {
      maxZoom: 28,
      minZoom: 1
    }).setView([7.8244, 123.4475], 13);

    // Add standard OpenStreetMap tiles with unlimited zoom scaling
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 28,         // Allow map zoom levels up to 28
      maxNativeZoom: 19,   // Upscale OSM level 19 tiles when zoom goes beyond 19
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      stopNavigation();
      if (teardropMarkerRef.current) {
        try {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(teardropMarkerRef.current)) {
            mapInstanceRef.current.removeLayer(teardropMarkerRef.current);
          }
        } catch (e) {}
        teardropMarkerRef.current = null;
      }
      if (markersLayerRef.current) {
        try {
          markersLayerRef.current.clearLayers();
        } catch (e) {}
        markersLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update contact markers on the map whenever contacts list changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // Custom static green dot icon (non-pulsing)
    const greenDotIcon = L.divIcon({
      className: 'custom-static-dot-marker-layer',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;">
          <span style="position: absolute; display: inline-flex; width: 100%; height: 100%; border-radius: 50%; background-color: #10b981; opacity: 0.3;"></span>
          <span style="position: relative; display: inline-flex; border-radius: 50%; height: 10px; width: 10px; background-color: #059669; border: 2px solid #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.25);"></span>
        </div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const validContacts = (contacts || []).filter(c => c.latitude && c.longitude);

    validContacts.forEach(contact => {
      const marker = L.marker([contact.latitude!, contact.longitude!], {
        icon: greenDotIcon
      });

      marker.on('click', () => {
        setSelectedContact(contact);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // Fit map bounds to show all markers on initial load
    if (validContacts.length > 0 && !hasFittedBoundsRef.current) {
      try {
        const group = L.featureGroup(validContacts.map(c => L.marker([c.latitude!, c.longitude!])));
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds.pad(0.1));
          hasFittedBoundsRef.current = true;
        }
      } catch (e) {
        console.warn('Failed to fit bounds:', e);
      }
    }
  }, [contacts]);

  // Listen for initialNavigateContact requests from outside to locate and navigate
  useEffect(() => {
    if (leafletLoaded && mapInstanceRef.current && initialNavigateContact && contacts.length > 0) {
      const target = contacts.find(c => c.id === initialNavigateContact.id) || initialNavigateContact;
      if (target.latitude && target.longitude) {
        // Center the camera on target contact
        mapInstanceRef.current.setView([target.latitude, target.longitude], 17, { animate: false });
        setSelectedContact(target);

        // Immediately fire the live dynamic navigation
        startNavigation(target);

        // Reset state so returning to the map tab doesn't lock or re-trigger navigation
        if (onClearInitialNavigateContact) {
          onClearInitialNavigateContact();
        }
      }
    }
  }, [leafletLoaded, contacts, initialNavigateContact]);

  // Synchronize teardrop marker on map when selectedContact changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;

    let timeoutId: any = null;

    // Clean up previous teardrop marker
    if (teardropMarkerRef.current) {
      try {
        if (mapInstanceRef.current.hasLayer(teardropMarkerRef.current)) {
          mapInstanceRef.current.removeLayer(teardropMarkerRef.current);
        }
      } catch (e) {
        console.warn('Failed to remove teardrop marker:', e);
      }
      teardropMarkerRef.current = null;
    }

    // Add new teardrop marker if a contact is selected
    if (selectedContact && selectedContact.latitude && selectedContact.longitude && mapInstanceRef.current) {
      const teardropIcon = L.divIcon({
        className: 'custom-teardrop-marker-container',
        html: `
          <div class="custom-teardrop-bounce" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" style="width: 36px; height: 36px;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const teardrop = L.marker([selectedContact.latitude, selectedContact.longitude], {
        icon: teardropIcon,
        zIndexOffset: 1000 // Always render above standard dots
      }).addTo(mapInstanceRef.current);

      // Create rich popup description
      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 150px;">
          <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #064e3b; font-size: 13px;">${selectedContact.full_name}</h4>
          <p style="margin: 0 0 2px 0; font-size: 11px; color: #475569;"><b>Barangay:</b> ${selectedContact.barangay}</p>
          <p style="margin: 0 0 2px 0; font-size: 11px; color: #475569;"><b>Purok:</b> ${selectedContact.purok || 'None'}</p>
          <p style="margin: 0 0 0 0; font-size: 11px; color: #475569;"><b>Contact:</b> ${selectedContact.contact_number || 'N/A'}</p>
        </div>
      `;

      teardrop.bindPopup(popupContent, { autoPan: false });
      
      timeoutId = setTimeout(() => {
        try {
          if (teardrop && mapInstanceRef.current && mapInstanceRef.current.hasLayer(teardrop)) {
            teardrop.openPopup();
          }
        } catch (e) {
          console.warn('Safe openPopup catch:', e);
        }
      }, 200);

      teardropMarkerRef.current = teardrop;
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (teardropMarkerRef.current) {
        try {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(teardropMarkerRef.current)) {
            mapInstanceRef.current.removeLayer(teardropMarkerRef.current);
          }
        } catch (e) {}
        teardropMarkerRef.current = null;
      }
    };
  }, [selectedContact, leafletLoaded]);

  const handleZoomTo = (contact: Contact) => {
    if (!mapInstanceRef.current || !contact.latitude || !contact.longitude) return;
    const currentZoom = mapInstanceRef.current.getZoom();
    const targetZoom = Math.max(currentZoom, 16); // Preserve user's closer zoom level if they zoomed in
    mapInstanceRef.current.setView([contact.latitude, contact.longitude], targetZoom);
    setSelectedContact(contact);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-xs group"
              title="Back to Directory"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-800">Geotagged Household Map</h3>
            <p className="text-xs text-slate-500 mt-0.5">Showing real-time locations of geotagged households registered in Saint Francis Clinic Directory</p>
          </div>
        </div>
        <button
          onClick={fetchGeotaggedContacts}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Map Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar list of geotagged households */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-[220px] lg:h-[550px] flex flex-col">
          <h4 className="font-bold text-slate-800 text-sm mb-3">Geotagged Households ({contacts.length})</h4>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading households...
              </div>
            ) : !contacts || contacts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No geotagged households found. Try syncing from the directory first.
              </div>
            ) : (
              (contacts || []).map(c => (
                <button
                  key={c.id}
                  onClick={() => handleZoomTo(c)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedContact?.id === c.id
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm font-semibold'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 text-slate-700'
                  }`}
                >
                  <p className="font-bold truncate text-slate-800">{c.full_name}</p>
                  <p className="text-slate-500 mt-0.5 truncate">{c.barangay} • Purok {c.purok || 'N/A'}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">{c.latitude?.toFixed(5)}, {c.longitude?.toFixed(5)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* The interactive map canvas */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-[550px] relative">
          {!leafletLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 gap-3 z-30">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Initializing Interactive Map Canvas...</p>
            </div>
          ) : null}

          {/* Floating Live Navigation Panel Overlay */}
          {isNavigating && navigationTarget && (
            <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-80 bg-blue-600 text-white rounded-2xl shadow-xl p-4 z-20 flex flex-col gap-2 border border-blue-500/30 backdrop-blur-md animate-scale-up">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Live GPS Tracker Active
                  </h5>
                  <h4 className="font-extrabold text-xs truncate max-w-[180px]">To {navigationTarget.full_name}</h4>
                </div>
                <button
                  onClick={stopNavigation}
                  className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] rounded-lg shadow transition-colors cursor-pointer"
                >
                  End Navigation
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1 pt-2 border-t border-blue-500/50">
                <div>
                  <span className="text-[9px] text-blue-200 uppercase font-bold block">Distance Left</span>
                  <span className="text-sm font-black tracking-tight">{navigationStats?.distance || 'Locating...'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-blue-200 uppercase font-bold block">ETA (Speed Calc)</span>
                  <span className="text-sm font-black tracking-tight">{navigationStats?.eta || 'Locating...'}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floater detailing the selected household */}
          {selectedContact && (
            <div className="absolute bottom-5 left-5 right-5 sm:left-auto sm:right-5 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 max-w-sm z-20 animate-scale-up">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{selectedContact.full_name}</h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block mt-1 w-max">
                      Geotagged
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Barangay</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">{selectedContact.barangay}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Purok</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">{selectedContact.purok || 'None'}</span>
                  </div>
                </div>

                <div className="text-xs">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Contact Number</span>
                  <span className="font-mono text-slate-800 block mt-0.5">{selectedContact.contact_number || 'No contact provided'}</span>
                </div>

                <div className="text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-xl font-mono text-[11px] text-slate-500">
                  Lat: {selectedContact.latitude?.toFixed(6)}<br />
                  Lng: {selectedContact.longitude?.toFixed(6)}
                </div>
                
                <button
                  onClick={() => startNavigation(selectedContact)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all mt-3 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-500"
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  Live Integrated GPS Navigation 🧭
                </button>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedContact.latitude},${selectedContact.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all mt-2 cursor-pointer"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
