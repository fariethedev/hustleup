import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { MapPin, Check, ShoppingBag, Trash2, Star } from 'lucide-react';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES, formatPrice, displayCity } from '../utils/constants';
import { addToCart, openCart, selectCartItems } from '../store/cartSlice';
import { coverImage, mediaList } from '../utils/media';
import CardCarousel from './CardCarousel';

export default function ListingCard({ listing, onDelete }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const own = user?.id === listing.sellerId;
  const inCart = items.some((item) => item.listingId === String(listing.id));
  const category = LISTING_TYPES.find((type) => type.value === listing.listingType) || LISTING_TYPES[4];
  const media = mediaList(listing);
  const cover = coverImage(listing);
  const available = !listing.status || listing.status === 'ACTIVE';
  const instant = ['GOODS', 'FASHION', 'FOOD'].includes(listing.listingType);
  const add = () => {
    if (inCart) { dispatch(openCart()); return; }
    dispatch(addToCart({ listingId: listing.id, title: listing.title, price: Number(listing.price), currency: listing.currency || 'PLN', quantity: 1, image: cover, sellerId: listing.sellerId, sellerName: listing.sellerName || 'Seller', shippingMethod: listing.shippingMethod, shippingPrice: Number(listing.shippingPrice) || 0, checkoutFields: listing.checkoutFields }));
  };
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] transition-colors hover:border-white/25">
      <Link to={`/listing/${listing.id}`} aria-label={`View ${listing.title}`} className="relative block aspect-[4/5] overflow-hidden bg-[#191919]">
        <CardCarousel media={media.length ? media : [cover].filter(Boolean)} title={listing.title} fallbackIcon={category.icon} fallbackClassName={category.color} imageClassName="h-full w-full object-contain" />
        {!available && <span className="absolute bottom-3 left-3 rounded-full bg-black/80 px-3 py-1 text-xs text-white">Unavailable</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="truncate text-[11px] text-gray-500">{category.label}</p>
        <Link to={`/listing/${listing.id}`} className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white hover:underline">{listing.title}</Link>
        <div className="flex flex-wrap items-center justify-between gap-1"><p className="text-base font-bold text-white">{formatPrice(listing.price, listing.currency)}</p>{listing.avgRating > 0 && <span className="flex items-center gap-1 text-xs text-gray-300"><Star className="h-3 w-3 fill-[#CDFF00] text-[#CDFF00]" />{Number(listing.avgRating).toFixed(1)}</span>}</div>
        <p className="truncate text-xs text-gray-400">{listing.sellerName || 'Local seller'}</p>
        <p className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{displayCity(listing.locationCity)}</span></p>
        <div className="mt-auto pt-2">
          {own ? onDelete ? <button type="button" onClick={() => onDelete(listing.id)} aria-label={`Delete ${listing.title}`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 text-xs text-red-300"><Trash2 className="h-4 w-4" />Delete</button> : <span className="flex min-h-11 items-center text-xs text-gray-500">Your listing</span> : instant && available ? (
            <button type="button" onClick={add} className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold ${inCart ? 'border border-[#CDFF00]/40 text-[#CDFF00]' : 'bg-white text-black hover:bg-[#CDFF00]'}`} aria-label={inCart ? `View ${listing.title} in cart` : `Add ${listing.title} to cart`}>{inCart ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{inCart ? 'In your cart' : 'Add to cart'}</button>
          ) : <Link to={`/listing/${listing.id}`} className="flex min-h-11 items-center justify-center rounded-xl border border-white/15 text-xs font-semibold text-white">{listing.listingType === 'HAIR_BEAUTY' || listing.listingType === 'SKILL' ? 'View service' : 'View details'}</Link>}
        </div>
      </div>
    </article>
  );
}
