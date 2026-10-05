import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ShoppingBag, MessagesSquare, Package, Store, WalletCards } from 'lucide-react';

export default function NavigationGuide() {
  const sections = [
    [Compass, 'Explore', 'Find goods, stores, services and events.', '/explore'],
    [MessagesSquare, 'Messages', 'Ask questions and agree a price before paying.', '/dm'],
    [Package, 'Bookings', 'Track marketplace purchases, confirm receipt or report a problem.', '/dashboard?tab=bookings&view=buying'],
    [ShoppingBag, 'Store orders', 'Follow purchases made from individual stores.', '/dashboard?tab=orders'],
    [Store, 'Selling', 'Manage listings and keep buyers updated on delivery.', '/dashboard?tab=listings'],
    [WalletCards, 'Payments', 'Connect your bank and review payout readiness.', '/payouts'],
  ];
  return <details className="my-5 rounded-2xl border border-white/15 bg-white/[0.03] p-4"><summary className="cursor-pointer min-h-11 flex items-center gap-2 font-semibold"><Compass className="h-5 w-5 text-[#CDFF00]" />How to use HustleSpace</summary><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{sections.map(([Icon, title, description, href]) => <Link key={title} to={href} className="p-4 rounded-xl border border-white/10 hover:border-[#CDFF00]/50">{createElement(Icon, { className: 'h-5 w-5 text-[#CDFF00] mb-3' })}<h3 className="font-semibold text-sm">{title}</h3><p className="text-xs text-gray-400 leading-relaxed mt-1">{description}</p></Link>)}</div></details>;
}
