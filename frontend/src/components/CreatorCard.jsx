import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BadgeCheck, Check, MapPin, UserPlus } from 'lucide-react';
import { followsApi } from '../api/client';
import { displayCity } from '../utils/constants';
import { uploadUrl } from '../config';

/**
 * A person on HustleSpace, rendered for the Explore rows and the creators browse page.
 *
 * Two shapes on purpose: `variant="compact"` is the narrow avatar-first tile used inside a
 * horizontal row, `variant="full"` is the taller card used in the grid on /explore/creators
 * where there is room for a bio.
 */
export default function CreatorCard({ user: u, index = 0, variant = 'compact' }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleFollow = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await followsApi.follow(u.id);
      else await followsApi.unfollow(u.id);
    } catch {
      setFollowing(!next); // roll back on failure
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = u.role === 'SELLER' ? 'Seller' : 'Hustler';
  const initial = (u.fullName || 'U')[0]?.toUpperCase();

  const followButton = (extraClass = '') => (
    <button
      onClick={toggleFollow}
      disabled={busy}
      className={`flex items-center justify-center gap-1.5 rounded-lg font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-60 ${extraClass} ${
        following
          ? 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/25'
          : 'bg-[#CDFF00] text-black hover:bg-[#d9ff33]'
      }`}
    >
      {following
        ? <><Check className="w-3.5 h-3.5" /> Following</>
        : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
    </button>
  );

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="snap-start shrink-0 w-[132px] flex flex-col items-center text-center"
      >
        <Link to={`/profile/${u.id}`} className="group flex flex-col items-center">
          <motion.div
            whileHover={{ scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-[#00FFFF] via-[#FF00FF] to-[#CDFF00]"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-black border-2 border-[#0A0A0A] flex items-center justify-center">
              {u.avatarUrl
                ? <img src={uploadUrl(u.avatarUrl)} alt={u.fullName} className="w-full h-full object-cover" />
                : <span className="text-[#00FFFF] font-black text-2xl">{initial}</span>}
            </div>
          </motion.div>

          <span className="mt-2.5 flex items-center gap-1 text-[11px] font-black text-white leading-tight line-clamp-1 group-hover:text-[#00FFFF] transition-colors">
            {u.fullName}
            {u.idVerified && <BadgeCheck className="w-3 h-3 text-[#CDFF00] shrink-0" />}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500">{roleLabel}</span>
          <span className="mt-0.5 mb-2 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-gray-500 max-w-full">
            <MapPin className="w-2.5 h-2.5 text-[#CDFF00] shrink-0" />
            <span className="truncate">{displayCity(u.city)}</span>
          </span>
        </Link>

        {followButton('w-full px-2 py-1.5 text-[9px]')}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <Link
        to={`/profile/${u.id}`}
        className="group flex flex-col items-center text-center h-full p-5 rounded-3xl bg-[#0A0A0A] border border-white/10 hover:border-[#00FFFF]/50 transition-colors duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_30px_rgba(0,255,255,0.12)]"
      >
        <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-[#00FFFF] via-[#FF00FF] to-[#CDFF00] group-hover:scale-105 transition-transform duration-300">
          <div className="w-full h-full rounded-full overflow-hidden bg-black border-2 border-[#0A0A0A] flex items-center justify-center">
            {u.avatarUrl
              ? <img src={uploadUrl(u.avatarUrl)} alt={u.fullName} className="w-full h-full object-cover" />
              : <span className="text-[#00FFFF] font-black text-2xl">{initial}</span>}
          </div>
        </div>

        <h3 className="mt-3 flex items-center gap-1 text-sm font-black text-white leading-tight line-clamp-1 group-hover:text-[#00FFFF] transition-colors">
          {u.fullName}
          {u.idVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
        </h3>

        <div className="mt-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
          <span>{roleLabel}</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="w-3 h-3 text-[#CDFF00] shrink-0" />
            <span className="truncate">{displayCity(u.city)}</span>
          </span>
        </div>

        <p className="mt-3 text-xs text-gray-400 leading-relaxed line-clamp-2 min-h-[2rem]">
          {u.bio || 'Building something on HustleSpace.'}
        </p>

        {followButton('mt-4 w-full px-3 py-2 text-[10px]')}
      </Link>
    </motion.div>
  );
}
