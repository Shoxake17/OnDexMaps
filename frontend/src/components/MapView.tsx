import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Place } from '../@types/place';

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onMapClick?: (coords: [number, number]) => void;
}

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export const MapView: React.FC<MapViewProps> = ({ 
  center, 
  zoom = 16, 
  places, 
  onSelectPlace, 
  onMapClick 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      const mapInstance = map.current;
      if (!mapInstance) return;

      const style = mapInstance.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (
            layer.id.includes('water') || 
            layer.id.includes('waterway') || 
            layer.id.includes('natural') ||
            layer.id.includes('hydro') ||
            layer.id.includes('marine') ||
            layer.id.includes('park') ||
            layer.id.includes('landuse') ||
            layer.id.includes('landcover')
          ) {
            if (mapInstance.getLayer(layer.id)) {
              try {
                mapInstance.setLayoutProperty(layer.id, 'visibility', 'none');
              } catch (e) {}
            }
          }
        });
      }

      // Ko'cha chiziqlarini och kulrang qilish
      const layers = mapInstance.getStyle().layers;
      layers.forEach((layer) => {
        if (
          layer.id.includes('road') || 
          layer.id.includes('street') || 
          layer.id.includes('tunnel') || 
          layer.id.includes('bridge')
        ) {
          if (mapInstance.getLayer(layer.id)) {
            try {
              mapInstance.setPaintProperty(layer.id, 'line-color', '#d1d5db');
            } catch (e) {}
          }
        }
      });
    });

    map.current.on('click', (e) => {
      if (onMapClick) {
        onMapClick([e.lngLat.lng, e.lngLat.lat]);
      }
    });

  }, [center, zoom, onMapClick]);

  // Markerlarni boshqarish
  useEffect(() => {
    if (!map.current) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    places.forEach((place) => {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-orange-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white cursor-pointer hover:scale-110 transition';
      el.innerHTML = '📍';

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectPlace(place);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat(place.coordinates)
        .addTo(map.current!);
      
      markers.current.push(marker);
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
    };
  }, [places, onSelectPlace]);

  // Muhim: Xarita konteyneri ota element ichida to'liq joylashishi uchun inline style berildi
  return (
    <div 
      ref={mapContainer} 
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' }} 
    />
  );
};