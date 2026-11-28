import { CirclePlus, CircleX, Scissors } from 'lucide-react';

/**
 * The seller's side of a service menu: one row per service, each with its own price and an
 * optional length. Used by CreateListing and the dashboard's edit form so a barber can list
 * "Skin fade · 60 · 45 min" next to "Beard trim · 30 · 20 min" instead of one price for all.
 *
 * Controlled: `rows` are strings straight from the inputs; utils/services.js turns them
 * into the meta JSON the server reads.
 */
export default function ServiceMenuEditor({ rows, onChange, currency = 'PLN', compact = false }) {
  const update = (i, key, value) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, { name: '', price: '', durationMins: '' }]);

  const input = `bg-white/[0.04] border border-white/10 rounded-xl px-3 ${compact ? 'py-2' : 'py-2.5'} text-white text-sm outline-none focus:border-[#CDFF00] placeholder-gray-600 min-w-0`;

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] gap-1.5 items-center">
          <input
            type="text"
            value={row.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder={i === 0 ? 'e.g. Skin fade' : 'Service'}
            maxLength={60}
            aria-label="Service name"
            className={input}
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={row.price}
            onChange={(e) => update(i, 'price', e.target.value)}
            placeholder={currency}
            aria-label="Price"
            className={input}
          />
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="5"
            value={row.durationMins}
            onChange={(e) => update(i, 'durationMins', e.target.value)}
            placeholder="min"
            aria-label="Length in minutes"
            className={input}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove service"
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <CircleX className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full py-2 rounded-xl border border-dashed border-white/15 text-[11px] font-bold text-gray-300 hover:border-[#CDFF00]/50 hover:text-[#CDFF00] transition-colors flex items-center justify-center gap-1.5"
      >
        {rows.length ? <CirclePlus className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}
        {rows.length ? 'Add another service' : 'Add your services and prices'}
      </button>
    </div>
  );
}
