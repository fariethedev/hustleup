import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Repeat, ArrowRight, Package, Coins } from 'lucide-react';
import { swapsApi } from '../api/client';
import { uploadUrl } from '../config';
import { hasCash, cashLabel } from '../utils/swap';

/**
 * The public swap chain: recent accepted trades, rendered as a horizontal neon chain.
 *
 * This is the growth surface — it exists to be screenshotted. So it deliberately shows
 * *what* got traded rather than dry counts, renders nothing at all when there is no
 * activity (an empty chain reads worse than no chain), and stays legible at story
 * aspect ratio.
 */
export default function SwapChain({ limit = 8 }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    swapsApi.chain(limit)
      .then((r) => setLinks(r.data || []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [limit]);

  // Silence beats an empty state here: this sits inside the feed, and a "no swaps yet"
  // box every scroll makes the app look abandoned.
  if (loading || links.length === 0) return null;

  return (
    <div className="relative w-full border-b border-white/5 py-4">
      <div className="flex items-center gap-2 px-4 mb-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#FF00FF] to-[#00FFFF] flex items-center justify-center">
          <Repeat className="w-3 h-3 text-black" strokeWidth={3} />
        </div>
        <h2 className="text-[11px] font-black tracking-[0.2em] text-white">Swap chain</h2>
        <span className="text-[10px] text-gray-600 font-bold">{links.length} recent trade{links.length === 1 ? '' : 's'}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto overscroll-x-contain scrollbar-hide px-4 pb-1">
        {links.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.05, 0.4) }}
            className="shrink-0 w-[260px] p-3 rounded-2xl bg-gradient-to-br from-[#FF00FF]/10 to-[#00FFFF]/10 border border-white/10 backdrop-blur-xl"
          >
            {/* Who traded with whom */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <Link to={`/profile/${s.proposerId}`} className="flex items-center gap-1.5 min-w-0 group">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {s.proposerAvatarUrl ? <img src={s.proposerAvatarUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[70px] group-hover:text-white transition-colors">
                  {s.proposerName}
                </span>
              </Link>

              <Repeat className="w-3 h-3 text-[#CDFF00] shrink-0" />

              <Link to={`/profile/${s.targetOwnerId}`} className="flex items-center gap-1.5 min-w-0 group">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {s.targetOwnerAvatarUrl ? <img src={s.targetOwnerAvatarUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[70px] group-hover:text-white transition-colors">
                  {s.targetOwnerName}
                </span>
              </Link>
            </div>

            {/* What changed hands */}
            <div className="flex items-center gap-2">
              <Thumb side={s.gives} />
              <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />
              <Thumb side={s.wants} />
            </div>

            {/* Cash, when the trade needed some. Named neutrally here rather than as
                "you"/"them": the chain is public and read by strangers to both parties, so
                there is no viewer whose side it could be phrased from. */}
            {hasCash(s) && (
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black tracking-widest text-[#CDFF00]">
                <Coins className="w-3 h-3 shrink-0" />
                <span className="truncate">+ {cashLabel(s)} on top</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Thumb({ side }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="w-full h-14 rounded-lg overflow-hidden bg-black/40 mb-1">
        {side?.imageUrl
          ? <img src={uploadUrl(side.imageUrl)} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>}
      </div>
      <p className="text-[9px] font-bold text-gray-400 truncate leading-tight">{side?.title || '—'}</p>
    </div>
  );
}
