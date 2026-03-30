import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Video, ChevronRight } from 'lucide-react';
import { storiesApi } from '../../api/client';
import { lockBodyScroll } from '../../utils/lockBodyScroll';

export default function StoryCreator({ onClose, onSuccess }) {
  const [storyType, setStoryType] = useState('TEXT');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => lockBodyScroll(), []);

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
      setMediaFile(file);
      const preview = URL.createObjectURL(file);
      setMediaPreview(preview);
      setError(null);
    }
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
      onSuccess();
    } catch (err) {
      console.error('Failed to create story:', err);
      setError('Could not post story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center overflow-hidden"
    >
      <div className="w-full max-w-lg bg-[#0A0A0A] sm:rounded-[4rem] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col max-h-[90vh] relative z-10 m-4">
        
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between shrink-0 border-b border-white/5">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Share <span className="text-[#CDFF00]">Story</span></h2>
          <button 
            onClick={onClose} 
            className="p-3.5 rounded-full bg-white/5 hover:bg-[#CDFF00] hover:text-black transition-all group shadow-xl"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-10">
            {/* Type Selection */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'TEXT', icon: Type, label: 'TEXT' },
                { id: 'IMAGE', icon: ImageIcon, label: 'PHOTO' },
                { id: 'VIDEO', icon: Video, label: 'VIDEO' }
              ].map((type) => (
                <button 
                  key={type.id}
                  type="button"
                  onClick={() => handleStoryTypeChange(type.id)}
                  className={`flex flex-col items-center justify-center gap-3 py-6 rounded-3xl border-2 transition-all duration-300 ${storyType === type.id ? 'bg-[#CDFF00] border-transparent text-black scale-105 shadow-[0_0_20px_rgba(205,255,0,0.2)]' : 'border-white/5 bg-white/5 text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
                >
                  <type.icon className={`w-6 h-6 ${storyType === type.id ? 'stroke-[3px]' : ''}`} />
                  <span className="text-[10px] font-black tracking-widest uppercase">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Creator Content Area */}
            <div className="flex flex-col justify-center items-center min-h-[360px] relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept={storyType === 'VIDEO' ? 'video/*' : 'image/*'}
              />

              {storyType === 'TEXT' ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full"
                >
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type something fire..."
                    className="w-full min-h-[300px] bg-transparent text-white text-4xl font-black uppercase text-center focus:outline-none placeholder:text-gray-900 leading-tight resize-none italic px-4"
                    rows={6}
                    maxLength={150}
                  />
                  <div className="text-center mt-4">
                    <span className="px-4 py-1.5 rounded-full bg-white/5 text-gray-600 text-[10px] font-black tracking-widest uppercase">
                      {content.length} / 150
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full"
                >
                  <div 
                    onClick={() => fileInputRef.current.click()}
                    className="relative w-full aspect-[9/11] rounded-[3rem] bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer group hover:border-[#CDFF00] overflow-hidden transition-all duration-500 shadow-inner"
                  >
                    {mediaPreview ? (
                      <>
                        {storyType === 'VIDEO' ? (
                          <video src={mediaPreview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                        ) : (
                          <img src={mediaPreview} alt="Story preview" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                          <span className="px-8 py-3 rounded-full bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest shadow-2xl">
                            Change File
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-8">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-[#CDFF00]/10 transition-all border border-white/5">
                          {storyType === 'VIDEO' ? <Video className="w-10 h-10 text-gray-600 group-hover:text-[#CDFF00]" /> : <ImageIcon className="w-10 h-10 text-gray-600 group-hover:text-[#CDFF00]" />}
                        </div>
                        <h4 className="text-white font-black text-sm uppercase tracking-widest mb-2 italic">Select {storyType === 'VIDEO' ? 'Clip' : 'Visual'}</h4>
                        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Max file size 20MB</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-4 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 w-full"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 flex gap-4 shrink-0 border-t border-white/5 bg-[#0A0A0A]">
          <button 
             type="button"
             onClick={handleSubmit}
             disabled={isSubmitting}
             className="w-full py-6 rounded-full bg-[#CDFF00] text-black font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(205,255,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
              </>
            ) : (
              <>
                Post Your Story <ChevronRight className="w-5 h-5 stroke-[3px]" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
