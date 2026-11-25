export default function BrandLoader({ label = 'Loading', compact = false }) {
  return (
    <div className={`brand-loader ${compact ? 'brand-loader-compact' : ''}`} role="status" aria-label={label}>
      <span className="brand-loader-orbit" aria-hidden="true" />
      <img src="/hustlespace-logo.png" alt="" className="brand-loader-mark" />
      {!compact && <span className="brand-loader-label">{label}</span>}
    </div>
  );
}
