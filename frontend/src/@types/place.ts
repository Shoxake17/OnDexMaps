export interface Place {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewsCount: number;
  distance: string;
  address: string;
  description: string;
  workTime: string;
  isOpen: boolean;
  coordinates: [number, number];
}