import React, { useEffect, useRef } from 'react';

declare const L: any;

interface LeafletMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  onChange: (coords: { latitude: number; longitude: number; zoom: number }) => void;
  height?: string;
}

export const LeafletMapPicker: React.FC<LeafletMapPickerProps> = ({
  latitude,
  longitude,
  zoom = 15,
  onChange,
  height = '380px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Default fallback center: Milan (45.464204, 9.189982)
  const defaultLat = latitude || 45.464204;
  const defaultLng = longitude || 9.189982;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof L === 'undefined') {
      console.warn('Leaflet (L) is not loaded yet');
      return;
    }

    if (!mapInstanceRef.current) {
      // Initialize Leaflet Map
      const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], zoom);

      // OpenStreetMap Tiles (Free and compliant with spec)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Place Marker if coordinates exist
      if (latitude !== null && longitude !== null) {
        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          onChange({
            latitude: Number(pos.lat.toFixed(6)),
            longitude: Number(pos.lng.toFixed(6)),
            zoom: map.getZoom(),
          });
        });
        markerRef.current = marker;
      }

      // Map Click event to drop or move pin
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        const currentZoom = map.getZoom();

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          marker.on('dragend', (ev: any) => {
            const pos = ev.target.getLatLng();
            onChange({
              latitude: Number(pos.lat.toFixed(6)),
              longitude: Number(pos.lng.toFixed(6)),
              zoom: map.getZoom(),
            });
          });
          markerRef.current = marker;
        }

        onChange({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          zoom: currentZoom,
        });
      });

      map.on('zoomend', () => {
        if (latitude !== null && longitude !== null) {
          onChange({
            latitude,
            longitude,
            zoom: map.getZoom(),
          });
        }
      });

      mapInstanceRef.current = map;
    } else {
      // Update existing map view if coords change externally
      const map = mapInstanceRef.current;
      if (latitude !== null && longitude !== null) {
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
          marker.on('dragend', (ev: any) => {
            const pos = ev.target.getLatLng();
            onChange({
              latitude: Number(pos.lat.toFixed(6)),
              longitude: Number(pos.lng.toFixed(6)),
              zoom: map.getZoom(),
            });
          });
          markerRef.current = marker;
        }
        map.setView([latitude, longitude], zoom);
      }
    }

    return () => {
      // Keep instance alive during hot-reloads or clean on unmount
    };
  }, [latitude, longitude, zoom]);

  // Geocoding Search helper using OpenStreetMap Nominatim
  const handleSearchAddress = async (query: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const newLat = Number(parseFloat(item.lat).toFixed(6));
        const newLng = Number(parseFloat(item.lon).toFixed(6));

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([newLat, newLng]);
          } else {
            const marker = L.marker([newLat, newLng], { draggable: true }).addTo(mapInstanceRef.current);
            markerRef.current = marker;
          }
        }

        onChange({
          latitude: newLat,
          longitude: newLng,
          zoom: 16,
        });
      } else {
        alert('No se encontraron coordenadas para esta dirección.');
      }
    } catch (err) {
      console.error('Error buscando dirección en Nominatim:', err);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-300 shadow-sm relative">
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className="z-0 bg-slate-100"
      />
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 shadow border border-slate-200 z-10 pointer-events-none">
        📍 Haz clic en el mapa o arrastra el pin
      </div>
    </div>
  );
};
