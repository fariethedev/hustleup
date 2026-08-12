import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Trophy, Coins, Flame, BadgeCheck, Loader2, TrendingUp, Repeat } from 'lucide-react';
import { leaderboardApi } from '../api/client';
import { selectIsAuthenticated } from '../store/authSlice';
import { formatPrice } from '../utils/constants';

const METRICS = [
  { key: 'sales',    label: 'Most sales',  icon: TrendingUp },
  { key: 'earnings', label: 'Most earned', icon: Coins },
  { key: 'score',    label: 'Hustle score', icon: Flame },
];

const WINDOWS = [
  { key: 'all',   label: 'All time' },
  { key: 'month', label: 'Month' },
  { key: 'week',  label: 'Week' },
];

const TIER_COLORS = {
  Mogul:    'from-[#FF00FF] to-[#00FFFF]',
  Operator: 'from-[#CDFF00] to-[#00FFFF]',
  Hustler:  'from-[#CDFF00] to-[#CDFF00]',
  Grinder:  'from-white/40 to-white/20',
  Rookie:   'from-white/20 to-white/10',
};

/** Medal tint for the top three; everyone else gets a plain number. */
const rankStyle = (rank) => {
  if (rank === 1) return 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black';
  if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-black';
  if (rank === 3) return 'bg-gradient-to-br from-[#CD7F32] to-[#8B4513] text-white';
  return 'bg-white/10 text-gray-400';
};

export default function Leaderboard() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [metric, setMetric] = useState('sales');
  const [window_, setWindow] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myScore, setMyScore] = useState(null);

  useEffect(() => {
    setLoading(true);
    leaderboardApi.board(metric, window_, 25)
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [metric, window_]);

  useEffect(() => {
    if (!isAuthenticated) return;
    leaderboardApi.myScore().then((r) => setMyScore(r.data)).catch(() => {});
  }, [isAuthenticated]);

  // The number each row is currently ranked on — keeps the right-hand column meaningful
  // as the user flips between boards.
  const primaryStat = (e) => {
    if (metric === 'earnings') return formatPrice(e.earnings, e.currency);
    if (metric === 'score') return e.hustleScore;
    return `${e.salesCount} sale${e.salesCount === 1 ? '' : 's'}`;
  };

  return (
    <div className="min-h-screen text-white font-sans pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#CDFF00] to-[#00FFFF] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">Leaderboard</h1>
            <p className="text-[11px] text-gray-500 font-bold mt-1">Who's actually hustling.</p>
          </div>
        </div>

        {/* My score */}
        {myScore && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-2xl bg-white/[0.04] border border-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Your hustle score</p>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-gradient-to-r ${TIER_COLORS[myScore.tier] || TIER_COLORS.Rookie} text-black`}>
                {myScore.tier}
              </span>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <p className="text-4xl font-black text-[#CDFF00] leading-none">{myScore.score}</p>
              <p className="text-[11px] text-gray-500 font-bold mb-1">/ 1000</p>
            </div>

            {/* Component bars — a reputation number nobody can explain isn't trusted. */}
            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-white/5 mb-3">
              {[
                ['sales', '#CDFF00'], ['earnings', '#00FFFF'], ['rating', '#FF00FF'],
                ['reviews', '#ffffff'], ['swaps', '#FFA500'],
              ].map(([k, color]) => (
                <div key={k} style={{ width: `${(myScore.breakdown?.[k] || 0) / 10}%`, background: color }} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-black text-white">{myScore.salesCount}</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Sales</p>
              </div>
              <div>
                <p className="text-sm font-black text-white">{formatPrice(myScore.earnings, myScore.currency)}</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Earned</p>
              </div>
              <div>
                <p className="text-sm font-black text-white">{myScore.acceptedSwaps}</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Swaps</p>
              </div>
            </div>

            {myScore.activityMultiplier < 1 && (
              <p className="mt-3 text-[10px] text-orange-400/90 font-bold text-center">
                Score dimmed to {Math.round(myScore.activityMultiplier * 100)}% — close a sale to bring it back up.
              </p>
            )}
          </motion.div>
        )}

        {/* Metric tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-2.5">
          {METRICS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                metric === key ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Window tabs */}
        <div className="flex gap-1.5 mb-5">
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setWindow(key)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                window_ === key
                  ? 'bg-white/10 border-white/25 text-white'
                  : 'border-white/10 text-gray-500 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Board */}
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-bold">No ranked hustlers yet</p>
            <p className="text-xs text-gray-600 mt-1.5 max-w-xs mx-auto">
              Complete a sale or an accepted swap to be the first on the board.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((e) => (
              <motion.div
                key={e.userId}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(e.rank * 0.02, 0.3) }}
              >
                <Link
                  to={`/profile/${e.userId}`}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${rankStyle(e.rank)}`}>
                    {e.rank}
                  </div>

                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="w-full h-full object-cover" /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate group-hover:text-[#CDFF00] transition-colors">{e.userName}</p>
                      {e.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00FFFF] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{e.tier}</span>
                      {e.acceptedSwaps > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-gray-600">
                          <Repeat className="w-2.5 h-2.5" /> {e.acceptedSwaps}
                        </span>
                      )}
                      {e.city && <span className="text-[9px] text-gray-600 font-bold truncate">{e.city}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#CDFF00] leading-none">{primaryStat(e)}</p>
                    {metric !== 'score' && (
                      <p className="text-[9px] text-gray-600 font-bold mt-1">{e.hustleScore} pts</p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
