import { Scissors, Utensils, PartyPopper, Shirt, Package, Wrench } from 'lucide-react';

export const LISTING_TYPES = [
  { value: 'HAIR_BEAUTY', label: 'Hair & Beauty', icon: Scissors, color: 'from-pink-500 to-rose-500' },
  { value: 'FOOD', label: 'Food & Catering', icon: Utensils, color: 'from-orange-500 to-amber-500' },
  { value: 'EVENT', label: 'Events & Entertainment', icon: PartyPopper, color: 'from-purple-500 to-indigo-500' },
  { value: 'FASHION', label: 'Fashion & Clothing', icon: Shirt, color: 'from-fuchsia-500 to-pink-500' },
  { value: 'GOODS', label: 'Goods & Products', icon: Package, color: 'from-blue-500 to-cyan-500' },
  { value: 'SKILL', label: 'Skills & Services', icon: Wrench, color: 'from-emerald-500 to-teal-500' },
];

export const BOOKING_STATUS_MAP = {
  POSTED: { label: 'Posted', color: 'bg-sky-500/15 text-sky-400' },
  INQUIRED: { label: 'Inquired', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
  NEGOTIATING: { label: 'Negotiating', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
  BOOKED: { label: 'Booked', color: 'bg-emerald-500/15 text-emerald-400' },
  COMPLETED: { label: 'Completed', color: 'bg-green-500/15 text-green-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
};

export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP'];

export const POLISH_CITIES = [
  'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk',
  'Łódź', 'Szczecin', 'Katowice', 'Lublin', 'Białystok',
  'Gdynia', 'Toruń', 'Rzeszów', 'Bydgoszcz', 'Olsztyn',
];

export function formatPrice(amount, currency = 'PLN') {
  const num = Number(amount);
  if (isNaN(num)) return `${currency} 0`;
  const formatted = num.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  switch (currency) {
    case 'PLN': return `${formatted} PLN`;
    case 'EUR': return `€${formatted}`;
    case 'USD': return `$${formatted}`;
    case 'GBP': return `£${formatted}`;
    default: return `${formatted} ${currency}`;
  }
}
