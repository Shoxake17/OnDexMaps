import React, { useState } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { SidebarRight } from './components/SidebarRight';
import { AddPlaceModal } from './components/AddPlaceModal';
import { Place } from './@types/place';

export default function App() {
  // Mock baza (boshlang'ich joylar)
  const [places, setPlaces] = useState<Place[]>([
    {
      id: "1",
      name: "Chust tuman hokimligi",
      category: "Davlat muassasasi",
      rating: 4.8,
      reviewsCount: 512,
      distance: "2.4 km",
      address: "Chust shahri, Markaziy ko'cha",
      description: "Markaziy hokimiyat binosi",
      workTime: "09:00 - 18:00",
      isOpen: true,
      coordinates: [71.2401, 41.0047]
    }
  ]);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  
  // Modal oynani boshqarish uchun state'lar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);

  // Xaritani bosganda ishlaydigan funksiya
  const handleMapClick = (coords: [number, number]) => {
    setClickedCoords(coords);
    setIsModalOpen(true); // Modalni ochish
  };

  // Yangi joyni mock bazaga qo'shish
  const handleAddPlace = (newPlaceData: { name: string; category: string; description: string; coordinates: [number, number] }) => {
    const newPlace: Place = {
      id: Date.now().toString(),
      name: newPlaceData.name,
      category: newPlaceData.category,
      rating: 5.0,
      reviewsCount: 1,
      distance: "0.1 km",
      address: "Xaritadan belgilangan manzil",
      description: newPlaceData.description,
      workTime: "09:00 - 22:00",
      isOpen: true,
      coordinates: newPlaceData.coordinates
    };

    setPlaces((prevPlaces) => [...prevPlaces, newPlace]);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans bg-gray-50">
      <Header onSearchChange={(q) => console.log(q)} onGpsClick={() => console.log('GPS')} />
      
      <MapView 
        center={[71.2401, 41.0047]} 
        zoom={16} 
        places={places} 
        onSelectPlace={(place) => setSelectedPlace(place)}
        onMapClick={handleMapClick}
      />

      {selectedPlace && (
        <SidebarRight 
          place={selectedPlace} 
          onClose={() => setSelectedPlace(null)} 
        />
      )}

      {/* Manzil qo'shish Oynasi (Modal) */}
      <AddPlaceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddPlace={handleAddPlace}
        clickedCoords={clickedCoords}
      />
    </div>
  );
}