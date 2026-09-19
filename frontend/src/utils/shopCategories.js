import {
  Building2, Shirt, ShoppingBasket, Smartphone, BookOpen, Sofa, Sparkles,
  Scissors, Hand, Flower2, PenTool, Dumbbell, GraduationCap, Wrench,
} from 'lucide-react';

/**
 * A shop's structured business type — separate from the free-text `category` a seller has
 * always been able to type ("Hair & Beauty", "Beauty Salon", two spellings of the same
 * business). Nothing that decides which features a shop gets can be driven by parsing that
 * string, so this is the fixed list the owner instead picks from at creation.
 *
 * `kind: 'APPOINTMENT'` is the one thing this actually drives: whether ShopManager offers a
 * services-and-slots calendar alongside the product shelf, and whether the storefront offers
 * a "Book an appointment" widget. A salon still sells product sometimes (shampoo on the
 * counter) and a clothing shop never takes a booking, so this adds a capability rather than
 * replacing one — the product shelf stays available either way.
 *
 * Mirrors `ShopBusinessType` in the backend (`hustleup-marketplace/.../shop/model`) — the
 * `value` here is that enum's name, sent and received as plain text.
 */
export const SHOP_BUSINESS_TYPES = [
  { value: 'GENERAL', label: 'General store', kind: 'CATALOGUE', icon: Building2 },
  { value: 'CLOTHING_FASHION', label: 'Clothing & Fashion', kind: 'CATALOGUE', icon: Shirt },
  { value: 'GROCERY_FOOD', label: 'Grocery & Food', kind: 'CATALOGUE', icon: ShoppingBasket },
  { value: 'ELECTRONICS', label: 'Electronics', kind: 'CATALOGUE', icon: Smartphone },
  { value: 'BOOKS_STATIONERY', label: 'Books & Stationery', kind: 'CATALOGUE', icon: BookOpen },
  { value: 'HOME_LIVING', label: 'Home & Living', kind: 'CATALOGUE', icon: Sofa },
  { value: 'BEAUTY_COSMETICS', label: 'Beauty & Cosmetics', kind: 'CATALOGUE', icon: Sparkles },
  { value: 'HAIR_SALON', label: 'Hair Salon', kind: 'APPOINTMENT', icon: Scissors },
  { value: 'BARBERSHOP', label: 'Barbershop', kind: 'APPOINTMENT', icon: Scissors },
  { value: 'NAIL_STUDIO', label: 'Nail Studio', kind: 'APPOINTMENT', icon: Hand },
  { value: 'SPA_MASSAGE', label: 'Spa & Massage', kind: 'APPOINTMENT', icon: Flower2 },
  { value: 'TATTOO_PIERCING', label: 'Tattoo & Piercing', kind: 'APPOINTMENT', icon: PenTool },
  { value: 'FITNESS_TRAINING', label: 'Fitness & Personal Training', kind: 'APPOINTMENT', icon: Dumbbell },
  { value: 'TUTORING_LESSONS', label: 'Tutoring & Lessons', kind: 'APPOINTMENT', icon: GraduationCap },
  { value: 'REPAIR_SERVICES', label: 'Repairs & Technical Services', kind: 'APPOINTMENT', icon: Wrench },
];

export const getBusinessType = (value) =>
  SHOP_BUSINESS_TYPES.find((t) => t.value === value) || SHOP_BUSINESS_TYPES[0];

export const isAppointmentBusiness = (value) => getBusinessType(value).kind === 'APPOINTMENT';

/** How long a slot lasts, offered as one-tap presets when opening a new one. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
