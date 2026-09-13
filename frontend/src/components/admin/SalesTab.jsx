import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChartLine, Box, Gem, CircleAlert, Undo, TriangleAlert } from 'lucide-react';
import { adminApi } from '../../api/client';
import { formatPrice } from '../../utils/constants';
import { uploadUrl } from '../../config';
import { Skeleton, Empty, Money } from './shared';
import { plnEquivalent, isMultiCurrency } from './format';

/**
 * Everything sold through the app.
 *
 * <h3>Why two totals and not one</h3>
 * The platform takes no commission — there is no fee anywhere in the payment path. So money
 * moving through HustleSpace and money HustleSpace earns are unrelated numbers, and one
 * combined "sales" figure would report other people's takings as income. GMV and platform
 * revenue are shown as two separate blocks for that reason.
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: 'Year' },
];

export default function SalesTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Only the newest request is allowed to write. Flicking between 7 days and a year fires
  // two overlapping reads, and the slower one landing last would leave the page showing
  // figures for a window the buttons say is no longer selected.
  const latest = useRef(0);

  const load = useCallback(() => {
    const id = ++latest.current;
    setLoading(true);
    adminApi.sales(days)
      .then((r) => { if (id === latest.current) setData(r.data); })
      // A failure clears the data rather than setting a separate flag: "loaded nothing" and
      // "failed to load" are the same screen here, and two states that must agree are two
      // states that can disagree.
      .catch(() => { if (id === latest.current) setData(null); })
      .finally(() => { if (id === latest.current) setLoading(false); });
  }, [days]);

  useEffect(() => load(), [load]);

  if (loading) return <Skeleton rows={3} />;
  if (!data) {
    return <Empty icon={CircleAlert} title="Could not load sales" hint="The marketplace service may be down" />;
  }

  const { gmv, lifetimeGmv, platform, refunds, series, topSellers } = data;
  const mixed = isMultiCurrency(gmv?.totals, platform?.monthlyRunRate);

  return (
    <div className="space-y-5">
      {/* Window picker */}
      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDays(w.days)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
              days === w.days
                ? 'bg-white/10 border-white/25 text-white'
                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* ── The two totals, kept apart ───────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-5 rounded-2xl bg-[#CDFF00]/[0.06] border border-[#CDFF00]/25">
          <div className="flex items-center gap-2 mb-1">
            <Gem className="w-4 h-4 text-[#CDFF00]" />
            <h3 className="text-[10px] font-black tracking-widest text-[#CDFF00]/80">PLATFORM REVENUE</h3>
          </div>
          <Money totals={platform?.monthlyRunRate} className="text-2xl font-black text-[#CDFF00] leading-none block mt-2" />
          <p className="text-[10px] text-gray-400 font-bold mt-1.5">
            per month · {platform?.activeSubscribers ?? 0} active subscriber{platform?.activeSubscribers === 1 ? '' : 's'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            {platform?.newSubscribersInWindow ?? 0} started in this window
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <ChartLine className="w-4 h-4 text-white" />
            <h3 className="text-[10px] font-black tracking-widest text-gray-400">GMV · MARKETPLACE</h3>
          </div>
          <Money totals={gmv?.totals} className="text-2xl font-black text-white leading-none block mt-2" />
          <p className="text-[10px] text-gray-400 font-bold mt-1.5">
            {gmv?.count ?? 0} sale{gmv?.count === 1 ? '' : 's'} in this window
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Buyers paying sellers. The platform takes no cut of this.
          </p>
        </div>
      </div>

      {/* The subscription table keeps no payment history, and a revenue screen must not
          imply otherwise. Stated on the screen rather than only in the API. */}
      {platform?.historyAvailable === false && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-400/[0.07] border border-amber-400/25">
          <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            <b className="text-amber-300">Revenue is a run rate, not billed history.</b>{' '}
            {platform.note}
          </p>
        </div>
      )}

      {mixed && (
        <p className="text-[10px] text-gray-500 px-1">
          Totals span more than one currency and are shown unconverted. The chart below compares
          them at indicative rates.
        </p>
      )}

      {/* ── Daily chart ──────────────────────────────────────────────────── */}
      <SalesChart series={series} mixed={mixed} />

      {/* ── Secondary counters ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Box} label="Bookings" value={gmv?.bookings?.count ?? 0} totals={gmv?.bookings?.totals} />
        <Stat icon={Box} label="Shop orders" value={gmv?.shopOrders?.count ?? 0} totals={gmv?.shopOrders?.totals} />
        <Stat icon={Banknote} label="All time GMV" value={lifetimeGmv?.count ?? 0} totals={lifetimeGmv?.totals} sub="sales ever" />
        <Stat icon={Undo} label="Refunded" value={refunds?.count ?? 0} totals={refunds?.totals} tone="bad" />
      </div>

      {/* ── Who is selling ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] font-black tracking-widest text-gray-500 mb-3">TOP SELLERS · THIS WINDOW</h3>
        {!topSellers || topSellers.length === 0 ? (
          <Empty icon={ChartLine} title="Nothing sold in this window" hint="Try a longer period" />
        ) : (
          <div className="space-y-2">
            {topSellers.map((s, i) => (
              <div key={s.sellerId} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10">
                <span className="w-6 text-center text-[10px] font-black text-gray-600 shrink-0">{i + 1}</span>
                <div className="w-9 h-9 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {s.avatarUrl
                    ? <img src={uploadUrl(s.avatarUrl)} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[#CDFF00] font-black text-xs">{(s.name || 'U')[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/profile/${s.sellerId}`} className="text-sm font-black text-white truncate hover:text-[#CDFF00] transition-colors block">
                    {s.name || 'Unknown account'}
                  </Link>
                  <p className="text-[10px] text-gray-500 truncate">{s.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <Money totals={s.totals} className="text-sm font-black text-[#CDFF00] block leading-none" />
                  <p className="text-[10px] text-gray-500 font-bold mt-1">{s.count} sale{s.count === 1 ? '' : 's'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, totals, sub, tone }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
      <Icon className={`w-4 h-4 mb-2 ${tone === 'bad' ? 'text-red-400' : 'text-[#CDFF00]'}`} />
      <div className="text-xl font-black text-white leading-none">{value}</div>
      <div className="text-[9px] font-bold tracking-widest text-gray-500 mt-1.5">{sub || label}</div>
      <Money totals={totals} className="text-[10px] font-bold text-gray-400 block mt-1 truncate" />
    </div>
  );
}

/**
 * Daily GMV as bars.
 *
 * <p>Hand-drawn rather than pulled from a chart library: this is one series of small
 * numbers, and the page already loads more JavaScript than it needs to.
 *
 * <p>Days with no sales keep their slot. Dropping them would redraw a quiet fortnight as
 * continuous trading, which is the one thing a sales chart must never do.
 */
function SalesChart({ series, mixed }) {
  if (!series || series.length === 0) return null;

  const points = series.map((d) => ({
    date: d.date,
    count: d.count,
    value: plnEquivalent(d.bookings) + plnEquivalent(d.shopOrders),
  }));
  const peak = Math.max(...points.map((p) => p.value), 0);

  if (peak === 0) {
    return (
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
        <h3 className="text-[10px] font-black tracking-widest text-gray-500 mb-3">DAILY GMV</h3>
        <p className="text-xs text-gray-600 py-6 text-center">Nothing sold in this window.</p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-[10px] font-black tracking-widest text-gray-500">DAILY GMV</h3>
        <span className="text-[10px] text-gray-600 font-bold">
          peak {formatPrice(Math.round(peak), 'PLN')}{mixed ? ' (converted)' : ''}
        </span>
      </div>

      <div className="flex items-end gap-[2px] h-32" role="img" aria-label="Daily gross merchandise value">
        {points.map((p) => (
          <div key={p.date} className="flex-1 min-w-0 group relative flex flex-col justify-end h-full">
            <div
              className={`w-full rounded-t transition-colors ${p.value > 0 ? 'bg-[#CDFF00]/70 group-hover:bg-[#CDFF00]' : 'bg-white/5'}`}
              style={{ height: p.value > 0 ? `${Math.max((p.value / peak) * 100, 2)}%` : '2px' }}
            />
            {/* Native tooltip: a per-bar popover for up to 365 bars is a lot of DOM for
                something only ever read one bar at a time. */}
            <span className="absolute inset-0" title={`${p.date} · ${formatPrice(Math.round(p.value), 'PLN')} · ${p.count} sale${p.count === 1 ? '' : 's'}`} />
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-2 text-[9px] text-gray-600 font-bold">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
