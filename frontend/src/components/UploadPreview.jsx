import { useEffect, useRef } from 'react';

/** Keep one object URL per preview and release the file when it is replaced. */
export default function UploadPreview({ file, alt = '', className = '' }) {
  const element = useRef(null);
  useEffect(() => {
    if (!file || !element.current) return;
    const url = URL.createObjectURL(file);
    element.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file?.type?.startsWith('video/')
    ? <video ref={element} muted playsInline preload="metadata" className={className} aria-label={alt || 'Video preview'} />
    : <img ref={element} alt={alt} className={className} />;
}
