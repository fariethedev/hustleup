export default function PostMediaGallery({ media = [], className = '' }) {
  if (!media.length) {
    return null;
  }

  const gridClass =
    media.length === 1
      ? 'grid-cols-1'
      : media.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-1 bg-[#121212] ${className}`}>
      {media.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className={`overflow-hidden bg-black ${media.length === 3 && index === 0 ? 'row-span-2' : ''}`}
        >
          {item.type === 'VIDEO' ? (
            <video
              src={item.url}
              controls
              playsInline
              className="w-full h-full max-h-[500px] object-cover"
            />
          ) : (
            <img
              src={item.url}
              alt={`Post media ${index + 1}`}
              className="w-full h-full max-h-[500px] object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
