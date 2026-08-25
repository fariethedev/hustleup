import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Video, ChevronRight, Crop } from 'lucide-react';
import { storiesApi, dispatchToast } from '../../api/client';
import ImageCropper from '../ImageCropper';
import { lockBodyScroll } from '../../utils/lockBodyScroll';

export default function StoryCreator({ onClose, onSuccess }) {
  const [storyType, setStoryType] = useState('TEXT');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // The image awaiting framing. Stories render full-bleed 9:16 with object-cover, so an
  // un-framed upload gets cropped by the viewer with no say from the author — the cropper
  // opens automatically on select rather than hiding behind an optional button.
  const [cropCandidate, setCropCandidate] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unlock = lockBodyScroll();
    return () => unlock();
  }, []);

  useEffect(() => (
    () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    }
  ), [mediaPreview]);

  const resetMediaState = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    // Switching story type mid-edit must also drop any half-finished framing, or the
    // cropper would reopen over a photo the author has already abandoned.
    setCropCandidate(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStoryTypeChange = (nextType) => {
    setStoryType(nextType);
    setError(null);
    if (nextType === 'TEXT') {
      resetMediaState();
    } else if (mediaFile && nextType !== (mediaFile.type.startsWith('video/') ? 'VIDEO' : 'IMAGE')) {
      resetMediaState();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const expectedPrefix = storyType === 'VIDEO' ? 'video/' : 'image/';

    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        setError('File size must be under 20MB');
        return;
      }
      if (!file.type.startsWith(expectedPrefix)) {
        setError(storyType === 'VIDEO' ? 'Please choose a video file' : 'Please choose an image file');
        return;
      }
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setError(null);

      if (file.type.startsWith('image/')) {
        setCropCandidate(file);
        return;
      }

      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  /** Commit the framed image as the story's media. */
  const acceptCrop = (croppedFile) => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(croppedFile);
    setMediaPreview(URL.createObjectURL(croppedFile));
    setCropCandidate(null);
  };

  /** Backing out of the cropper leaves the previous media untouched. */
  const cancelCrop = () => {
    setCropCandidate(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('type', storyType);
    
    if (storyType === 'TEXT') {
      if (!content.trim()) {
        setError('Story content is required');
        setIsSubmitting(false);
        return;
      }
      formData.append('content', content.trim());
    } else {
      if (!mediaFile) {
        setError(storyType === 'VIDEO' ? 'Please select a video' : 'Please select a photo');
        setIsSubmitting(false);
        return;
      }
      formData.append('media', mediaFile);
    }

    try {
      await storiesApi.create(formData);
      dispatchToast('Story posted successfully!', 'success');
      onSuccess();
    } catch (err) {
      // Read both shapes: StoryController returns {message}, but anything caught by the
      // shared GlobalExceptionHandler (e.g. a rejected upload type) returns {error}.
      // Only checking `message` meant those failures showed the generic fallback and the
      // real reason never reached the user.
      const data = err.response?.data;
      const errorMsg =
        data?.message ||
        data?.error ||
        (err.response?.status
          ? `Could not post story (server said ${err.response.status}).`
          : 'Could not reach the server. Check your connection and try again.');
      setError(errorMsg);
      console.error('Failed to create story:', err.response?.status, data || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-[#0a0a0a] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[85vh] relative"
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Share Story</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-5 space-y-5">
            {/* Type Selection */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'TEXT', icon: Type, label: 'Text' },
                { id: 'IMAGE', icon: ImageIcon, label: 'Photo' },
                { id: 'VIDEO', icon: Video, label: 'Video' }
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleStoryTypeChange(type.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${storyType === type.id ? 'bg-[#CDFF00] border-transparent text-black' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Creator Content Area */}
            <div className="flex flex-col justify-center items-center relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept={storyType === 'VIDEO' ? 'video/*' : 'image/*'}
              />

              {storyType === 'TEXT' ? (
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full"
                >
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type something…"
                    className="w-full min-h-[180px] bg-white/[0.04] border border-white/10 rounded-2xl text-white text-xl font-semibold text-center focus:outline-none focus:border-[#CDFF00] placeholder:text-gray-600 leading-snug resize-none p-4"
                    rows={5}
                    maxLength={300}
                  />
                  <div className="text-right mt-1.5">
                    <span className="text-gray-500 text-xs">{content.length} / 300</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full"
                >
                  <div
                    onClick={() => fileInputRef.current.click()}
                    className="relative w-full aspect-[9/13] max-h-[320px] mx-auto rounded-2xl bg-white/[0.04] border-2 border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer group hover:border-[#CDFF00] overflow-hidden transition-all"
                  >
                    {mediaPreview ? (
                      <>
                        {storyType === 'VIDEO' ? (
                          <video src={mediaPreview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                        ) : (
                          <img src={mediaPreview} alt="Story preview" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          {/* Re-frame the photo already chosen, without having to pick it
                              again. stopPropagation keeps the parent's file-picker click
                              from firing underneath. */}
                          {storyType !== 'VIDEO' && mediaFile && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCropCandidate(mediaFile); }}
                              className="px-4 py-2 rounded-full bg-[#CDFF00] text-black font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                            >
                              <Crop className="w-3.5 h-3.5" /> Adjust
                            </button>
                          )}
                          <span className="px-4 py-2 rounded-full bg-white/15 border border-white/25 text-white font-bold text-xs">
                            Change
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#CDFF00]/10 transition-all">
                          {storyType === 'VIDEO' ? <Video className="w-6 h-6 text-gray-500 group-hover:text-[#CDFF00]" /> : <ImageIcon className="w-6 h-6 text-gray-500 group-hover:text-[#CDFF00]" />}
                        </div>
                        <h4 className="text-white font-semibold text-sm mb-1">Select {storyType === 'VIDEO' ? 'a clip' : 'a photo'}</h4>
                        <p className="text-gray-500 text-xs">Max file size 20MB</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 w-full"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">{error}</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 shrink-0 border-t border-white/10">
          <button
             type="button"
             onClick={handleSubmit}
             disabled={isSubmitting}
             className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Posting…
              </>
            ) : (
              <>
                Post story <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Locked to 9:16 — that is the shape a story is actually viewed at, so letting the
          author choose a different ratio here would just guarantee a re-crop on playback. */}
      {cropCandidate && (
        <ImageCropper
          file={cropCandidate}
          lockAspect={9 / 16}
          onCancel={cancelCrop}
          onApply={acceptCrop}
        />
      )}
    </motion.div>,
    document.body
  );
}
