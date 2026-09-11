import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Calendar, ArrowLeft, Newspaper, BadgeCheck, Plus, ShieldCheck,
  Clock, Eye, LayoutGrid, X, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { newsApi, publishersApi } from '../api/client';
import { SECTIONS } from '../utils/taxonomy';
import HeroBrief from '../components/HeroBrief';
import MobileFilterBar from '../components/MobileFilterBar';
import ArticleComposer from '../components/news/ArticleComposer';


const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function News() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [section, setSection] = useState('all');
  const [selected, setSelected] = useState(null);   // the article being read (full body)
  const [canPostRaw, setCanPost] = useState(false);
  // Signing out must immediately hide the composer, without an effect writing state.
  const canPost = isAuthenticated && canPostRaw;
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    newsApi.feed({ category: section, q: searchQuery || undefined })
      .then((res) => setArticles(res.data?.content || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [section, searchQuery]);

  useEffect(() => {
    const t = setTimeout(load, searchQuery ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, searchQuery]);

  // Sets state only from the async callback. An early `setCanPost(false)` in the
  // effect body would trigger a cascading re-render (react-hooks/set-state-in-effect);
  // the render guard below already treats a signed-out visitor as unable to post.
  useEffect(() => {
    if (!isAuthenticated) return;
    publishersApi.me()
      .then((res) => setCanPost(!!res.data?.canPostNews))
      .catch(() => setCanPost(false));
  }, [isAuthenticated]);

  // The grid ships cards without bodies, so opening one fetches the full article.
  const openArticle = (article) => {
    setSelected({ ...article, body: null });
    newsApi.one(article.id)
      .then((res) => setSelected(res.data))
      .catch(() => setSelected({ ...article, body: 'This article could not be loaded.' }));
  };

  return (
    <div className="min-h-screen text-white">
      <HeroBrief
        eyebrow="News"
        title="What's moving in the hustle economy"
        subtitle="Reported by verified outlets."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-gray-500">
            <ShieldCheck className="w-4 h-4 text-[#CDFF00]" />
            Verified outlets only
          </div>
          {canPost ? (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setComposerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest"
            >
              <Plus className="w-4 h-4" /> Publish article
            </motion.button>
          ) : (
            <Link
              to="/publisher/apply?type=NEWS_OUTLET"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#CDFF00]/40 text-[10px] font-black tracking-widest text-gray-300 transition-colors"
            >
              <BadgeCheck className="w-4 h-4 text-[#CDFF00]" /> Run an outlet? Get verified
            </Link>
          )}
        </div>

        {/* Mobile: search and sections collapse behind icons */}
        <MobileFilterBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search stories or outlets…"
          activeFilters={section !== 'all' ? 1 : 0}
          resultLabel={`${articles.length} stor${articles.length === 1 ? 'y' : 'ies'}`}
          onClear={() => { setSearchQuery(''); setSection('all'); }}
        >
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide pb-0.5">
            <button
              onClick={() => setSection('all')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                section === 'all'
                  ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> All
            </button>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSection(section === sec.id ? 'all' : sec.id)}
                className={`shrink-0 px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                  section === sec.id
                    ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {sec.name}
              </button>
            ))}
          </div>
        </MobileFilterBar>

        {/* Desktop: unchanged inline layout */}
        <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/10 focus-within:border-[#CDFF00]/50 rounded-xl px-4 py-2.5 mb-4 transition-colors">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            type="text"
            placeholder="Search stories or outlets…"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
        </div>

        {/* Sections */}
        <div className="hidden sm:flex flex-wrap items-center gap-2 mb-8">
          <button
            onClick={() => setSection('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
              section === 'all'
                ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> All
          </button>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(section === s.id ? 'all' : s.id)}
              className={`px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                section === s.id
                  ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex sm:grid overflow-x-auto overscroll-x-contain sm:overflow-visible snap-x snap-mandatory scrollbar-hide gap-3 sm:gap-4 pb-1 sm:pb-0 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-72 shrink-0 w-[calc((100%-0.75rem)/2)] sm:w-auto snap-start rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
              <Newspaper className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">No stories yet</h3>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1.5">
                {searchQuery || section !== 'all' ? 'Try another search or section' : 'Verified outlets publish here'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex sm:grid overflow-x-auto overscroll-x-contain sm:overflow-visible snap-x snap-mandatory scrollbar-hide gap-3 sm:gap-4 pb-1 sm:pb-0 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {articles.map((a) => (
                <motion.button
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  whileHover={{ y: -4 }}
                  onClick={() => openArticle(a)}
                  className="shrink-0 w-[calc((100%-0.75rem)/2)] sm:w-auto snap-start text-left bg-white/[0.02] border border-white/10 hover:border-[#CDFF00]/30 rounded-2xl overflow-hidden transition-colors flex flex-col"
                >
                  <div className="aspect-[16/10] sm:aspect-auto sm:h-40 bg-black/40 overflow-hidden shrink-0">
                    {a.coverImageUrl
                      ? <img src={a.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Newspaper className="w-8 h-8 text-gray-700" />
                        </div>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    {a.category && (
                      <span className="self-start text-[9px] font-black text-[#CDFF00] bg-[#CDFF00]/10 px-2.5 py-1 rounded-md tracking-widest border border-[#CDFF00]/20 mb-2">
                        {a.category}
                      </span>
                    )}
                    <h2 className="text-sm font-black text-white leading-snug mb-1.5">{a.title}</h2>
                    {a.summary && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3">{a.summary}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 text-[10px] font-bold text-gray-500 tracking-widest">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {a.outletLogoUrl && (
                          <img src={a.outletLogoUrl} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                        )}
                        <span className="truncate">{a.outletName}</span>
                        <BadgeCheck className="w-3 h-3 text-[#CDFF00] shrink-0" />
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> {a.readingMinutes}m
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Reader view */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[800] bg-black/90 backdrop-blur-sm overflow-y-auto"
            onClick={() => setSelected(null)}
          >
            <motion.article
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl mx-auto my-6 sm:my-12 bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden"
            >
              <div className="sticky top-0 z-10 px-5 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
                <button onClick={() => setSelected(null)}
                        className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setSelected(null)}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selected.coverImageUrl && (
                <img src={selected.coverImageUrl} alt="" className="w-full max-h-80 object-cover" />
              )}

              <div className="p-6 sm:p-8">
                {selected.category && (
                  <span className="inline-block text-[9px] font-black text-[#CDFF00] bg-[#CDFF00]/10 px-2.5 py-1 rounded-md tracking-widest border border-[#CDFF00]/20 mb-3">
                    {selected.category}
                  </span>
                )}
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3">{selected.title}</h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 tracking-widest mb-6 pb-6 border-b border-white/10">
                  <span className="flex items-center gap-1.5">
                    {selected.outletLogoUrl && (
                      <img src={selected.outletLogoUrl} alt="" className="w-4 h-4 rounded object-cover" />
                    )}
                    {selected.outletName}
                    {/* The tick means "verified HustleSpace outlet". An aggregated article
                        has not been verified by anyone here, so it says where it came from
                        instead of borrowing a badge it did not earn. */}
                    {selected.sourceName
                      ? <span className="text-gray-600 normal-case">· via feed</span>
                      : <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" />}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> {formatDate(selected.publishedAt || selected.createdAt)}
                  </span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {selected.readingMinutes}m read</span>
                  <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> {selected.viewsCount}</span>
                </div>

                {selected.summary && (
                  <p className="text-base text-gray-300 leading-relaxed font-semibold mb-6">{selected.summary}</p>
                )}

                {/* An aggregated article stores the feed's summary, not the full text —
                    scraping the body would be republishing someone else's work. So the
                    prominent action is to go and read it where it was written. */}
                {selected.sourceUrl && (
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 mb-6 px-4 py-3.5 rounded-2xl border border-[#CDFF00]/25 bg-[#CDFF00]/[0.06] hover:border-[#CDFF00]/60 transition-colors group"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black tracking-widest text-[#CDFF00]">
                        Read the full story
                      </span>
                      <span className="block text-xs text-gray-400 truncate">
                        Published by {selected.sourceName}
                      </span>
                    </span>
                    <ExternalLink className="w-4 h-4 text-[#CDFF00] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </a>
                )}

                {selected.body === null ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 rounded bg-white/[0.04] animate-pulse" style={{ width: `${90 - i * 8}%` }} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.body}</div>
                )}

                {selected.mediaUrls?.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3 mt-6">
                    {selected.mediaUrls.map((url, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                        {/\.(mp4|mov|webm|m4v)$/i.test(url)
                          ? <video src={url} controls className="w-full" />
                          : <img src={url} alt="" className="w-full object-cover" loading="lazy" />}
                      </div>
                    ))}
                  </div>
                )}

                {selected.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-6 pt-6 border-t border-white/10">
                    {selected.tags.map((t) => (
                      <span key={t} className="text-[9px] font-bold text-gray-500 bg-white/5 border border-white/5 px-2 py-1 rounded-md tracking-widest">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composerOpen && (
          <ArticleComposer
            sections={SECTIONS}
            onClose={() => setComposerOpen(false)}
            onPublished={(a) => { setComposerOpen(false); setArticles((p) => [a, ...p]); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
