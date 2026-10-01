import {
  Building2, Shirt, ShoppingBasket, Smartphone, BookOpen, Sofa, Sparkles,
  Scissors, Hand, Flower2, PenTool, Dumbbell, GraduationCap, Wrench,
} from 'lucide-react';

/**
 * The single shop category choice supplies both the business type and its display label.
 * Existing custom category labels are retained until the owner chooses a category.
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

const BEAUTY_CATEGORIES = ['Hair care', 'Skin care', 'Makeup', 'Nail care', 'Fragrance', 'Beauty tools'];
const PRODUCT_CATEGORIES = {
  GENERAL: ['Food & drink', 'Clothing', 'Accessories', 'Electronics', 'Home & garden', 'Health & beauty', 'Books & stationery', 'Sports & leisure'],
  CLOTHING_FASHION: ['T-shirts & tops', 'Shirts', 'Hoodies & sweatshirts', 'Trousers & jeans', 'Dresses & skirts', 'Coats & jackets', 'Shoes', 'Bags & accessories'],
  GROCERY_FOOD: ['Fruit & vegetables', 'Dairy & eggs', 'Meat & fish', 'Bread & bakery', 'Pantry staples', 'Frozen food', 'Snacks & sweets', 'Drinks', 'Household essentials'],
  ELECTRONICS: ['Phones & tablets', 'Computers', 'Audio', 'Cameras', 'Gaming', 'Cables & accessories', 'Appliances'],
  BOOKS_STATIONERY: ['Books', 'Notebooks & planners', 'Pens & pencils', 'Art supplies', 'Office supplies'],
  HOME_LIVING: ['Furniture', 'Home decor', 'Kitchen & dining', 'Bedding & textiles', 'Lighting', 'Garden', 'Cleaning supplies'],
  BEAUTY_COSMETICS: BEAUTY_CATEGORIES,
  HAIR_SALON: BEAUTY_CATEGORIES,
  BARBERSHOP: ['Hair care', 'Beard & shaving', 'Skin care', 'Grooming tools'],
  NAIL_STUDIO: ['Nail care', 'Nail polish', 'Nail tools', 'Hand & foot care'],
  SPA_MASSAGE: ['Skin care', 'Bath & body', 'Massage oils', 'Wellness accessories'],
  TATTOO_PIERCING: ['Aftercare', 'Jewellery', 'Art & prints', 'Accessories'],
  FITNESS_TRAINING: ['Equipment', 'Sportswear', 'Supplements', 'Accessories'],
  TUTORING_LESSONS: ['Books', 'Study materials', 'Stationery', 'Learning kits'],
  REPAIR_SERVICES: ['Spare parts', 'Tools', 'Accessories', 'Refurbished products'],
};

/** Keep a saved custom shelf selectable, including after a shop changes category. */
export const getProductCategories = (businessType, currentCategory = '') => {
  const options = [...(PRODUCT_CATEGORIES[businessType] || PRODUCT_CATEGORIES.GENERAL), 'Other'];
  return currentCategory && !options.includes(currentCategory) ? [currentCategory, ...options] : options;
};

export const isProductInStock = (product) =>
  product?.stockQuantity == null || Number(product.stockQuantity) > 0;

export const stockLabel = (product) => product?.stockQuantity == null
  ? 'Stock not tracked'
  : Number(product.stockQuantity) === 0 ? 'Out of stock' : `${product.stockQuantity} in stock`;

/** How long a slot lasts, offered as one-tap presets when opening a new one. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
