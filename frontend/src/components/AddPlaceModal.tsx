import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlace: (place: { name: string; category: string; description: string; coordinates: [number, number]; address: string }) => void;
  clickedCoords: [number, number] | null;
}

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddPlace, 
  clickedCoords 
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState("Do'kon va savdo");
  const [description, setDescription] = useState('');
  
  const miniMapContainer = useRef<HTMLDivElement>(null);
  const miniMap = useRef<mapboxgl.Map | null>(null);

  const addressText = clickedCoords 
    ? `Chust, Namangan Region, Uzbekistan (${clickedCoords[1].toFixed(4)}, ${clickedCoords[0].toFixed(4)})` 
    : '';

  // Mini xaritani hosil qilish
  useEffect(() => {
    if (!isOpen || !clickedCoords || !miniMapContainer.current) return;

    // Agar xarita allaqachon yaratilgan bo'lsa, markazini yangilaymiz
    if (miniMap.current) {
      miniMap.current.setCenter(clickedCoords);
      return;
    }

    // Yangi mini Mapbox xaritasi
    miniMap.current = new mapboxgl.Map({
      container: miniMapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: clickedCoords,
      zoom: 15,
      interactive: false, // Mini karta harakatlanmaydigan (statik) bo'lishi uchun
      attributionControl: false,
    });

    // Mini xaritaga pin qo'shish
    new mapboxgl.Marker({ color: '#ea580c' })
      .setLngLat(clickedCoords)
      .addTo(miniMap.current);

    return () => {
      if (miniMap.current) {
        miniMap.current.remove();
        miniMap.current = null;
      }
    };
  }, [isOpen, clickedCoords]);

  if (!isOpen || !clickedCoords) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddPlace({
      name,
      category,
      description,
      coordinates: clickedCoords,
      address: addressText,
    });
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-medium text-gray-900">Yangi joy</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Bu joyni xaritaga qo'shing. Ma'lumotlar barchaga ko'rinadi.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          
          {/* Nomi */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              JOY NOMI (MAJBURIY)*
            </label>
            <input 
              type="text" 
              required
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Joyning nomi..." 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-sm font-medium"
            />
          </div>

          {/* Kategoriya */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              KATEGORIYA (MAJBURIY)*
            </label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-sm font-medium"
            >
              <option value="Do'kon va savdo">Do'kon va savdo</option>
              <option value="Apteka va tibbiyot">Apteka va tibbiyot</option>
              <option value="Restoran va kafelar">Restoran va kafelar</option>
              <option value="Davlat muassasasi">Davlat muassasasi</option>
              <option value="Xizmatlar">Xizmat ko'rsatish</option>
            </select>
          </div>

          {/* Manzil */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              MANZIL (AVTOMATIK)*
            </label>
            <input 
              type="text" 
              readOnly
              value={addressText} 
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm select-none"
            />
          </div>

          {/* Haqiqiy Mini Mapbox Karta Bloki */}
          <div className="relative w-full h-36 rounded-2xl border border-gray-200 overflow-hidden shadow-inner">
            <div ref={miniMapContainer} className="w-full h-full" />
          </div>

          {/* Tavsif */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              QO'SHIMCHA TAVSIF
            </label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ish vaqti, mo'ljal yoki qo'shimcha ma'lumotlar..." 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-sm"
              rows={2}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-blue-600 hover:bg-blue-50 rounded-full font-medium text-sm transition cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm shadow-md transition cursor-pointer"
          >
            Jo'natish
          </button>
        </div>

      </div>
    </div>
  );
};