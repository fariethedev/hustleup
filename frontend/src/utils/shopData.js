import shopGrocery from '../assets/shop_grocery.png';
import shopFashion from '../assets/shop_fashion.png';
import shopElectronics from '../assets/shop_electronics.png';
import shopBeauty from '../assets/shop_beauty.png';
import shopFood from '../assets/shop_food.png';
import shopServices from '../assets/shop_services.png';

export const SHOPS = [
  {
    id: 'oja-market',
    name: 'Oja Market',
    category: 'Groceries',
    tagline: 'Farm-fresh produce delivered daily',
    description: 'Your one-stop shop for fresh fruits, vegetables, dairy, and organic products. We source directly from local farms to bring you the freshest produce at the best prices.',
    image: shopGrocery,
    accentColor: '#10B981',
    accentBg: '#ECFDF5',
    rating: 4.9,
    reviewCount: 342,
    location: 'Warszawa',
    products: [
      { id: 'fm-1', name: 'Organic Avocados (3 pack)', price: 12.99, currency: 'PLN', category: 'Fruits', image: '🥑' },
      { id: 'fm-2', name: 'Farm Fresh Eggs (12)', price: 15.50, currency: 'PLN', category: 'Dairy', image: '🥚' },
      { id: 'fm-3', name: 'Sourdough Bread Loaf', price: 8.99, currency: 'PLN', category: 'Bakery', image: '🍞' },
      { id: 'fm-4', name: 'Mixed Berry Pack 500g', price: 18.99, currency: 'PLN', category: 'Fruits', image: '🫐' },
      { id: 'fm-5', name: 'Organic Whole Milk 1L', price: 6.50, currency: 'PLN', category: 'Dairy', image: '🥛' },
      { id: 'fm-6', name: 'Fresh Spinach Bundle', price: 4.99, currency: 'PLN', category: 'Vegetables', image: '🥬' },
      { id: 'fm-7', name: 'Greek Yogurt 500g', price: 9.99, currency: 'PLN', category: 'Dairy', image: '🥛' },
      { id: 'fm-8', name: 'Cherry Tomatoes 250g', price: 7.50, currency: 'PLN', category: 'Vegetables', image: '🍅' },
    ],
  },
  {
    id: 'ankara-threads',
    name: 'Ankara Threads',
    category: 'Fashion & Clothing',
    tagline: 'Streetwear that speaks volumes',
    description: 'Curated streetwear and contemporary fashion for the modern hustler. From exclusive drops to everyday essentials, we keep you looking fresh.',
    image: shopFashion,
    accentColor: '#8B5CF6',
    accentBg: '#F5F3FF',
    rating: 4.8,
    reviewCount: 218,
    location: 'Kraków',
    products: [
      { id: 'ut-1', name: 'Oversized Graphic Tee', price: 89.99, currency: 'PLN', category: 'T-Shirts', image: '👕' },
      { id: 'ut-2', name: 'Slim Fit Denim Jeans', price: 199.99, currency: 'PLN', category: 'Pants', image: '👖' },
      { id: 'ut-3', name: 'Classic White Sneakers', price: 349.99, currency: 'PLN', category: 'Shoes', image: '👟' },
      { id: 'ut-4', name: 'Leather Crossbody Bag', price: 159.99, currency: 'PLN', category: 'Bags', image: '👜' },
      { id: 'ut-5', name: 'Zip-Up Hoodie (Black)', price: 149.99, currency: 'PLN', category: 'Hoodies', image: '🧥' },
      { id: 'ut-6', name: 'Baseball Cap — Logo', price: 59.99, currency: 'PLN', category: 'Accessories', image: '🧢' },
      { id: 'ut-7', name: 'Cargo Joggers (Khaki)', price: 179.99, currency: 'PLN', category: 'Pants', image: '👖' },
      { id: 'ut-8', name: 'Crew Socks 3-Pack', price: 39.99, currency: 'PLN', category: 'Accessories', image: '🧦' },
    ],
  },
  {
    id: 'nairobi-tech',
    name: 'Nairobi Tech Hub',
    category: 'Electronics',
    tagline: 'Gear up with the latest tech',
    description: 'Premium electronics and tech accessories at unbeatable prices. From wireless earbuds to smart home devices, find the tech that powers your hustle.',
    image: shopElectronics,
    accentColor: '#3B82F6',
    accentBg: '#EFF6FF',
    rating: 4.7,
    reviewCount: 156,
    location: 'Wrocław',
    products: [
      { id: 'tz-1', name: 'Wireless Noise-Cancel Headphones', price: 299.99, currency: 'PLN', category: 'Audio', image: '🎧' },
      { id: 'tz-2', name: 'USB-C Fast Charger 65W', price: 89.99, currency: 'PLN', category: 'Chargers', image: '🔌' },
      { id: 'tz-3', name: 'Bluetooth Speaker Portable', price: 149.99, currency: 'PLN', category: 'Audio', image: '🔊' },
      { id: 'tz-4', name: 'Mechanical Keyboard RGB', price: 249.99, currency: 'PLN', category: 'Peripherals', image: '⌨️' },
      { id: 'tz-5', name: 'Wireless Mouse Ergonomic', price: 119.99, currency: 'PLN', category: 'Peripherals', image: '🖱️' },
      { id: 'tz-6', name: 'LED Desk Lamp Smart', price: 79.99, currency: 'PLN', category: 'Smart Home', image: '💡' },
      { id: 'tz-7', name: 'Phone Stand Adjustable', price: 49.99, currency: 'PLN', category: 'Accessories', image: '📱' },
      { id: 'tz-8', name: 'Webcam 1080p HD', price: 159.99, currency: 'PLN', category: 'Peripherals', image: '📷' },
    ],
  },
  {
    id: 'sahara-beauty',
    name: 'Sahara Beauty',
    category: 'Beauty & Skincare',
    tagline: 'Radiance starts here',
    description: 'Premium beauty and skincare essentials. From K-beauty to luxury cosmetics, discover products that make you glow from within.',
    image: shopBeauty,
    accentColor: '#EC4899',
    accentBg: '#FDF2F8',
    rating: 4.9,
    reviewCount: 489,
    location: 'Poznań',
    products: [
      { id: 'gb-1', name: 'Vitamin C Serum 30ml', price: 79.99, currency: 'PLN', category: 'Skincare', image: '✨' },
      { id: 'gb-2', name: 'Matte Lipstick Set (5)', price: 59.99, currency: 'PLN', category: 'Makeup', image: '💄' },
      { id: 'gb-3', name: 'Hydrating Face Mask (10 pack)', price: 45.99, currency: 'PLN', category: 'Skincare', image: '🧖' },
      { id: 'gb-4', name: 'Rose Gold Perfume 50ml', price: 189.99, currency: 'PLN', category: 'Fragrance', image: '🌹' },
      { id: 'gb-5', name: 'Eyeshadow Palette 12 Shades', price: 99.99, currency: 'PLN', category: 'Makeup', image: '🎨' },
      { id: 'gb-6', name: 'SPF 50 Sunscreen 100ml', price: 34.99, currency: 'PLN', category: 'Skincare', image: '☀️' },
      { id: 'gb-7', name: 'Hair Growth Oil 100ml', price: 49.99, currency: 'PLN', category: 'Haircare', image: '💆' },
      { id: 'gb-8', name: 'Nail Polish Set (8 colors)', price: 44.99, currency: 'PLN', category: 'Nails', image: '💅' },
    ],
  },
  {
    id: 'jollof-express',
    name: 'Jollof Express',
    category: 'Food & Catering',
    tagline: 'Artisan flavors for every craving',
    description: 'Handcrafted meals, premium pastries, and gourmet sauces. From meal prep kits to artisan treats, elevate your food game.',
    image: shopFood,
    accentColor: '#F59E0B',
    accentBg: '#FFFBEB',
    rating: 4.8,
    reviewCount: 275,
    location: 'Gdańsk',
    products: [
      { id: 'gm-1', name: 'Weekly Meal Prep Kit (5 meals)', price: 149.99, currency: 'PLN', category: 'Meal Kits', image: '🍱' },
      { id: 'gm-2', name: 'Artisan Chocolate Box (12)', price: 69.99, currency: 'PLN', category: 'Sweets', image: '🍫' },
      { id: 'gm-3', name: 'Truffle Infused Olive Oil 250ml', price: 89.99, currency: 'PLN', category: 'Sauces', image: '🫒' },
      { id: 'gm-4', name: 'Assorted Macaron Box (24)', price: 79.99, currency: 'PLN', category: 'Pastries', image: '🧁' },
      { id: 'gm-5', name: 'Homemade Pasta Kit', price: 39.99, currency: 'PLN', category: 'Meal Kits', image: '🍝' },
      { id: 'gm-6', name: 'Premium Coffee Beans 500g', price: 54.99, currency: 'PLN', category: 'Drinks', image: '☕' },
      { id: 'gm-7', name: 'Sourdough Starter Kit', price: 24.99, currency: 'PLN', category: 'Bakery', image: '🍞' },
      { id: 'gm-8', name: 'Hot Sauce Trio Set', price: 44.99, currency: 'PLN', category: 'Sauces', image: '🌶️' },
    ],
  },
  {
    id: 'lagos-fixers',
    name: 'Lagos Fixers',
    category: 'Skills & Services',
    tagline: 'Expert help, on demand',
    description: 'Professional services from verified experts. Whether you need a plumber, tutor, designer, or photographer — ProFix connects you with the best.',
    image: shopServices,
    accentColor: '#14B8A6',
    accentBg: '#F0FDFA',
    rating: 5.0,
    reviewCount: 167,
    location: 'Łódź',
    products: [
      { id: 'ps-1', name: 'Home Plumbing Repair (1hr)', price: 120.00, currency: 'PLN', category: 'Home', image: '🔧' },
      { id: 'ps-2', name: 'Math Tutoring Session (1hr)', price: 80.00, currency: 'PLN', category: 'Tutoring', image: '📐' },
      { id: 'ps-3', name: 'Logo Design Package', price: 350.00, currency: 'PLN', category: 'Design', image: '🎨' },
      { id: 'ps-4', name: 'Photography Session (2hr)', price: 500.00, currency: 'PLN', category: 'Photography', image: '📸' },
      { id: 'ps-5', name: 'Personal Training Session', price: 100.00, currency: 'PLN', category: 'Fitness', image: '💪' },
      { id: 'ps-6', name: 'House Cleaning (3hr)', price: 180.00, currency: 'PLN', category: 'Home', image: '🧹' },
      { id: 'ps-7', name: 'Resume Writing Service', price: 150.00, currency: 'PLN', category: 'Career', image: '📝' },
      { id: 'ps-8', name: 'Guitar Lessons (1hr)', price: 90.00, currency: 'PLN', category: 'Music', image: '🎸' },
    ],
  },
];

export function getShopById(id) {
  return SHOPS.find((s) => s.id === id) || null;
}

export function getProductByShopAndProductId(shopId, productId) {
  const shop = getShopById(shopId);
  if (!shop) return null;

  const product = shop.products.find((item) => item.id === productId);
  if (!product) return null;

  return { shop, product };
}
