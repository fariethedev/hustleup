import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion } from 'framer-motion';
import { CircleX, Redo, Maximize2, Undo, CircleCheck, Loader } from 'lucide-react';
import { lockBodyScroll } from '../utils/lockBodyScroll';

/**
 * Pan / zoom / rotate crop dialog.
 *
 * Uploads used to be handed to the server exactly as the camera produced them, and every
 * surface then displayed them with `object-cover` — which silently crops to the centre.
 * A photo whose subject sits anywhere else lost it, and the person posting had no say.
 * This puts the framing decision in their hands before anything is uploaded.
 *
 * The crop is committed to a real canvas and returned as a new File, so what gets stored
 * is what was framed — nothing downstream needs to know a crop happened.
 *
 * @param {File}     file        the image being framed
 * @param {Array}    aspects     selectable ratios, e.g. [{label:'1:1', value:1}]
 * @param {number}   lockAspect  single fixed ratio (hides the selector) — used by stories
 * @param {Function} onCancel    dismiss without changing anything
 * @param {Function} onApply     receives the cropped File
 */
export default function ImageCropper({ file, aspects, lockAspect, onCancel, onApply }) {
  const RATIOS = useMemo(
    () => aspects || [
      { label: 'Original', value: 0 },
      { label: '1:1', value: 1 },
      { label: '4:5', value: 4 / 5 },
      { label: '16:9', value: 16 / 9 },
    ],
    [aspects],
  );

  const [imgEl, setImgEl] = useState(null);      // decoded source bitmap
  const [rotation, setRotation] = useState(0);   // 0 | 90 | 180 | 270
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [aspect, setAspect] = useState(lockAspect || RATIOS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState({ w: 320, h: 320 });

  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const drag = useRef(null);
  const pinch = useRef(null);

  useEffect(() => lockBodyScroll(), []);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Decode once. The object URL is revoked on unmount so a long editing session
  // doesn't leak one blob per opened photo.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    let active = true;
    im.onload = () => { if (active) setImgEl(im); };
    im.onerror = () => { if (active) setError('This photo could not be opened. Try a JPEG, PNG or WebP image.'); };
    im.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  // Rotating by 90 degrees swaps which natural dimension is horizontal.
  const natural = useMemo(() => {
    if (!imgEl) return { w: 1, h: 1 };
    const swap = rotation === 90 || rotation === 270;
    return {
      w: swap ? imgEl.naturalHeight : imgEl.naturalWidth,
      h: swap ? imgEl.naturalWidth : imgEl.naturalHeight,
    };
  }, [imgEl, rotation]);

  const effectiveAspect = aspect || (natural.w / natural.h);

  // Fit the crop frame inside whatever space the stage has.
  const frame = useMemo(() => {
    let w = stage.w;
    let h = w / effectiveAspect;
    if (h > stage.h) { h = stage.h; w = h * effectiveAspect; }
    return { w: Math.round(w), h: Math.round(h) };
  }, [stage, effectiveAspect]);

  // At zoom 1 the image exactly covers the frame, so there is never an empty gap.
  const baseScale = useMemo(
    () => Math.max(frame.w / natural.w, frame.h / natural.h),
    [frame, natural],
  );

  const scale = baseScale * zoom;
  const displayed = { w: natural.w * scale, h: natural.h * scale };

  /** Keeps the image covering the frame; without it panning tears open blank edges. */
  const clamp = useCallback((o, s = scale) => {
    const maxX = Math.max(0, (natural.w * s - frame.w) / 2);
    const maxY = Math.max(0, (natural.h * s - frame.h) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  }, [natural, frame, scale]);

  // Re-clamp whenever the geometry changes — switching ratio or zooming out could
  // otherwise strand the image off-centre with a visible gap.
  const position = clamp(offset);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: Math.max(120, width), h: Math.max(120, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Gestures ──────────────────────────────────────────────────────────────
  const pointFrom = (e) => {
    const t = e.touches?.[0] || e;
    return { x: t.clientX, y: t.clientY };
  };

  const onDown = (e) => {
    if (e.touches?.length === 2) {
      const [a, b] = e.touches;
      pinch.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom,
      };
      return;
    }
    const p = pointFrom(e);
    drag.current = { sx: p.x, sy: p.y, ox: position.x, oy: position.y };
  };

  const onMove = (e) => {
    if (pinch.current && e.touches?.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(Math.min(5, Math.max(1, pinch.current.zoom * (dist / pinch.current.dist))));
      return;
    }
    if (!drag.current) return;
    const p = pointFrom(e);
    setOffset(clamp({
      x: drag.current.ox + (p.x - drag.current.sx),
      y: drag.current.oy + (p.y - drag.current.sy),
    }));
  };

  const onUp = () => { drag.current = null; pinch.current = null; };

  const onWheel = (e) => {
    setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.0015)));
  };

  const rotate = () => {
    setRotation((r) => (r + 90) % 360);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); setRotation(0); };

  // ── Export ────────────────────────────────────────────────────────────────
  const apply = async () => {
    if (!imgEl) return;
    setBusy(true);
    setError('');
    try {
      // 1. Bake rotation into an upright bitmap so the crop maths stays axis-aligned.
      let source = imgEl;
      if (rotation !== 0) {
        const rc = document.createElement('canvas');
        rc.width = natural.w;
        rc.height = natural.h;
        const rx = rc.getContext('2d');
        rx.translate(rc.width / 2, rc.height / 2);
        rx.rotate((rotation * Math.PI) / 180);
        rx.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);
        source = rc;
      }

      // 2. Map the frame back onto source pixels. `scale` converts source px to CSS px,
      //    and the image's top-left sits at this offset inside the frame.
      const left = (frame.w - displayed.w) / 2 + position.x;
      const top = (frame.h - displayed.h) / 2 + position.y;
      const sx = -left / scale;
      const sy = -top / scale;
      const sw = frame.w / scale;
      const sh = frame.h / scale;

      // 3. Render at the cropped region's true resolution, capped so a 48MP phone photo
      //    doesn't turn into an unusable upload.
      const MAX = 1600;
      const outScale = Math.min(1, MAX / Math.max(sw, sh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * outScale));
      canvas.height = Math.max(1, Math.round(sh * outScale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image editing is unavailable in this browser');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // PNG sources stay PNG so transparency doesn't flatten to black; everything else
      // becomes JPEG, which is far smaller for photographs.
      const isPng = file.type === 'image/png';
      const type = isPng ? 'image/png' : 'image/jpeg';
      const blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
      if (!blob) throw new Error('Could not render the crop');

      const name = file.name.replace(/\.[^.]+$/, '') + (isPng ? '.png' : '.jpg');
      await onApply(new File([blob], name, { type, lastModified: Date.now() }));
    } catch {
      setError('Your crop could not be saved. Try again, or cancel to keep the original photo.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-dialog-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onCancel(); }
        if (event.key === 'Tab') {
          const elements = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
          const first = elements[0];
          const last = elements[elements.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
        }
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-xl flex flex-col outline-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancel crop"
          className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors disabled:opacity-40"
        >
          <CircleX className="w-4 h-4" />
        </button>
        <p id="crop-dialog-title" className="text-sm font-semibold text-white">Crop photo</p>
        <button
          type="button"
          onClick={apply}
          disabled={busy || !imgEl}
          className="min-h-11 px-4 rounded-full bg-[#CDFF00] text-black text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-all"
        >
          {busy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CircleCheck className="w-3.5 h-3.5" />} {busy ? 'Saving…' : 'Use photo'}
        </button>
      </div>
      {error && <p role="alert" className="px-4 py-3 text-sm text-red-300 text-center">{error}</p>}

      {/* Stage */}
      <div ref={stageRef} className="flex-1 min-h-0 flex items-center justify-center p-4 select-none">
        {!imgEl ? (
          !error && <Loader className="w-6 h-6 text-gray-600 animate-spin" />
        ) : (
          <div
            className="relative overflow-hidden bg-black touch-none cursor-grab active:cursor-grabbing rounded-lg"
            tabIndex={0}
            role="group"
            aria-label="Photo framing. Use arrow keys to move the photo."
            onKeyDown={(event) => {
              const movement = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
              if (movement) { event.preventDefault(); setOffset(clamp({ x: position.x + movement[0], y: position.y + movement[1] })); }
            }}
            style={{ width: frame.w, height: frame.h }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} onTouchCancel={onUp}
            onWheel={onWheel}
          >
            {/* Sized by the *unrotated* natural dimensions, then rotated about its centre —
                the extra offset term re-centres it when a 90° turn swaps width and height. */}
            <img
              src={imgEl.src}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: imgEl.naturalWidth * scale,
                height: imgEl.naturalHeight * scale,
                left: (frame.w - displayed.w) / 2 + position.x + (displayed.w - imgEl.naturalWidth * scale) / 2,
                top: (frame.h - displayed.h) / 2 + position.y + (displayed.h - imgEl.naturalHeight * scale) / 2,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            />
            {/* Rule-of-thirds guides make the framing decision easier to judge */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border border-white/30" />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <Maximize2 className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            type="range" min="1" max="5" step="0.01" value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-[#CDFF00] cursor-pointer"
          />
          <button type="button" onClick={rotate} title="Rotate 90 degrees" aria-label="Rotate" className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
            <Redo className="w-4 h-4" />
          </button>
          <button type="button" onClick={reset} title="Reset" aria-label="Reset" className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
            <Undo className="w-4 h-4" />
          </button>
        </div>

        {!lockAspect && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {RATIOS.map((r) => (
              <button
                type="button"
                key={r.label}
                onClick={() => setAspect(r.value)}
                aria-pressed={aspect === r.value}
                className={`min-h-11 px-4 rounded-full text-xs font-semibold border transition-all ${
                  aspect === r.value
                    ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                    : 'border-white/15 text-gray-400 hover:text-white hover:border-white/35'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Drag to reposition · scroll or pinch to zoom
        </p>
      </div>
    </Motion.div>,
    document.body,
  );
}
