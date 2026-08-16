import React from 'react';
import { X, Navigation, Bookmark, Share2, Phone, Star, MapPin } from 'lucide-react';
import { Place } from '../@types/place';
import { Button } from './common/Button';

interface SidebarRightProps {
  place: Place;
  onClose: () => void;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({ place, onClose }) => {
  return (
    <aside className="absolute top-20 right-4 w-96 bg-white shadow-2xl rounded-2xl z-20 overflow-hidden border border-gray-100">
      <div className="p-5">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center text-amber-500 font-semibold">
            <Star size={14} className="fill-amber-500 mr-1" /> {place.rating} ({place.reviewsCount} ta sharh)
          </span>
          <span>•</span>
          <span>{place.category}</span>
          <span>•</span>
          <span>{place.distance}</span>
        </div>

        <p className="text-xs text-gray-600 mt-3 flex items-start">
          <MapPin size={14} className="mr-1 text-gray-400 shrink-0 mt-0.5" />
          {place.address}
        </p>

        {/* Action Buttons (DRY tamoyili bo'yicha Button komponentidan foydalanildi) */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="primary" icon={<Navigation size={18} />} label="Yo'nalish" />
          <Button variant="secondary" icon={<Bookmark size={18} />} label="Saqlash" />
          <Button variant="secondary" icon={<Share2 size={18} />} label="Ulashish" />
          <Button variant="secondary" icon={<Phone size={18} />} label="Qo'ng'iroq" />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Ma'lumot</h4>
          <p className="text-xs text-gray-600 leading-relaxed">{place.description}</p>
        </div>
      </div>
    </aside>
  );
};