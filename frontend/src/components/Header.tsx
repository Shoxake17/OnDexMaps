import React from 'react';
import { Search, MapPin, Navigation } from 'lucide-react';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  onGpsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchChange, onGpsClick }) => {
  return (
    <header className="absolute top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md shadow-sm z-30 flex items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center space-x-2">
        <div className="bg-emerald-500 text-white p-2 rounded-xl flex items-center justify-center">
          <MapPin size={20} />
        </div>
        <span className="text-xl font-extrabold tracking-tight text-gray-900">
          OnDex<span className="text-emerald-600">Map</span>
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative w-96">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search size={18} />
        </span>
        <input 
          type="text" 
          placeholder="Manzil yoki joy qidiring..." 
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-16 py-2 bg-gray-100 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500 text-sm transition"
        />
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-400 font-medium">
          Ctrl / ⌘ K
        </span>
      </div>

      {/* GPS Button */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={onGpsClick}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
        >
          <Navigation size={16} className="text-emerald-600" />
          <span>Mening joyim</span>
        </button>
      </div>
    </header>
  );
};