import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { uploadUrl } from '../config';

export default function HighlightVideo({ url, onEnded }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center text-white">
    <p>This video couldn’t load.</p>
    <p className="text-sm text-gray-300">Try again. If it still fails, the seller may need to upload it again as MP4 or WebM.</p>
    <button className="flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4" onClick={() => { setAttempt(n => n + 1); setFailed(false); }}><RotateCcw size={16} />Retry video</button>
  </div>;
  return <video key={attempt} src={uploadUrl(url)} controls autoPlay playsInline muted preload="metadata" className="w-full h-full object-contain" onError={() => setFailed(true)} onEnded={onEnded} aria-label="Highlight video" />;
}
