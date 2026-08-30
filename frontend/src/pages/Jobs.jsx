import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, Clock, Search,
  Users, Zap, Check, LayoutGrid, Plus, BadgeCheck, Image as ImageIcon, ShieldCheck,
  Wallet, Globe, X, Loader2, ExternalLink,
} from 'lucide-react';
import { jobsApi, publishersApi, dispatchToast } from '../api/client';
import { JOB_CATEGORIES } from '../utils/taxonomy';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import MobileFilterBar from '../components/MobileFilterBar';
import { Link } from 'react-router-dom';
import HeroBrief from '../components/HeroBrief';
import { timeAgoLong as timeAgo } from '../utils/time';
import JobComposer from '../components/jobs/JobComposer';
import JobApplyModal from '../components/jobs/JobApplyModal';


/** Renders the stored numeric pay range as the string a human expects to read. */
const formatPay = (job) => {
  const { salaryMin: min, salaryMax: max, salaryCurrency: cur, salaryPeriod: period } = job;
  if (min == null && max == null) return null;
  const unit = { HOUR: '/hr', DAY: '/day', MONTH: '/mo', YEAR: '/yr', PROJECT: ' total' }[period] || '';
  const n = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const money = min != null && max != null && String(min) !== String(max)
    ? `${n(min)} – ${n(max)}`
    : n(min ?? max);
  return `${money} ${cur || ''}${unit}`.trim();
};

export default function Jobs() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Server-side publishing rights. Never derived client-side — the server owns this rule.
  const [canPostRaw, setCanPost] = useState(false);
  // Signing out must immediately hide the composer, without an effect writing state.
  const canPost = isAuthenticated && canPostRaw;
  const [composerOpen, setComposerOpen] = useState(false);
  const [applyTo, setApplyTo] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsApi.board({ category: activeCategory, q: searchQuery || undefined })
      .then((res) => setJobs(res.data?.content || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [activeCategory, searchQuery]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
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
      .then((res) => setCanPost(!!res.data?.canPostJobs))
      .catch(() => setCanPost(false));
  }, [isAuthenticated]);

  const onApplied = (jobId) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId
      ? { ...j, appliedByCurrentUser: true, applicationsCount: j.applicationsCount + 1 }
      : j)));
    setApplyTo(null);
    dispatchToast('Application sent', 'success');
  };

  return (
    <div className="min-h-screen text-white">
      <HeroBrief
        eyebrow="Jobs & Gigs"
        title="Work worth showing up for"
        subtitle="Every advert here comes from a verified hiring company."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {/* Publisher call-to-action: either compose, or find out how to be allowed to. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <ShieldCheck className="w-4 h-4 text-[#CDFF00]" />
            Verified employers only
          </div>
          {canPost ? (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setComposerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Post a job
            </motion.button>
          ) : (
            <Link
              to="/publisher/apply?type=HIRING_COMPANY"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#CDFF00]/40 text-[10px] font-black uppercase tracking-widest text-gray-300 transition-colors"
            >
              <BadgeCheck className="w-4 h-4 text-[#CDFF00]" /> Hiring? Get verified
            </Link>
          )}
        </div>

        {/* Mobile: search and categories collapse behind icons */}
        <MobileFilterBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search roles or companies…"
          activeFilters={activeCategory !== 'all' ? 1 : 0}
          resultLabel={`${jobs.length} role${jobs.length === 1 ? '' : 's'}`}
          onClear={() => { setSearchQuery(''); setActiveCategory('all'); }}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeCategory === 'all'
                  ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> All
            </button>
            {JOB_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" /> {cat.name}
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
            placeholder="Search roles or companies…"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
              {jobs.length} found
            </span>
          )}
        </div>

        {/* Category filter */}
        <div className="hidden sm:flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              activeCategory === 'all'
                ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> All
          </button>
          {JOB_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeCategory === cat.id
                  ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" /> {cat.name}
            </button>
          ))}
        </div>

        {/* Board */}
        <div className="space-y-3">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {jobs.length > 0 ? jobs.map((job) => {
                const catInfo = JOB_CATEGORIES.find((c) => c.id === job.category);
                const pay = formatPay(job);
                const applied = job.appliedByCurrentUser;
                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="bg-white/[0.02] border border-white/10 hover:border-[#CDFF00]/30 rounded-2xl overflow-hidden transition-all"
                  >
                    {/* Media strip — the reason job cards exist visually at all. Horizontally
                        scrollable so a company can show a workplace without the card growing
                        unbounded. */}
                    {job.mediaUrls?.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide p-3 pb-0">
                        {job.mediaUrls.map((url, i) => (
                          <div
                            key={i}
                            className="relative shrink-0 w-40 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10"
                          >
                            {/\.(mp4|mov|webm|m4v)$/i.test(url) ? (
                              <video src={url} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {catInfo && (
                              <span className="text-[9px] font-black text-[#CDFF00] bg-[#CDFF00]/10 px-2.5 py-1 rounded-md uppercase tracking-widest border border-[#CDFF00]/20">
                                {catInfo.name}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                              {String(job.jobType || '').replace('_', ' ')}
                            </span>
                            {job.remote && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                <Globe className="w-3 h-3" /> Remote
                              </span>
                            )}
                          </div>

                          <h2 className="text-base font-black text-white mb-1.5 leading-tight">{job.title}</h2>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 font-semibold mb-3">
                            <span className="flex items-center gap-1.5">
                              {job.companyLogoUrl
                                ? <img src={job.companyLogoUrl} alt="" className="w-4 h-4 rounded object-cover" />
                                : <Briefcase className="w-3.5 h-3.5 text-gray-600" />}
                              {job.companyName}
                              {/* Every advert on this board is from a verified company —
                                  the tick is the whole point of the gate. */}
                              <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" />
                            </span>
                            {job.location && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-600" /> {job.location}
                              </span>
                            )}
                            {pay && (
                              <span className="flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-gray-600" /> {pay}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-600" /> {timeAgo(job.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 leading-relaxed mb-2.5 line-clamp-2">
                            {job.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {job.tags?.map((tag) => (
                              <span key={tag} className="text-[9px] font-bold text-gray-500 bg-white/5 border border-white/5 px-2 py-1 rounded-md uppercase tracking-widest">
                                {tag}
                              </span>
                            ))}
                            {job.applicationsCount > 0 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest ml-1">
                                <Users className="w-3 h-3" /> {job.applicationsCount} applied
                              </span>
                            )}
                            {job.mediaUrls?.length > 0 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                                <ImageIcon className="w-3 h-3" /> {job.mediaUrls.length}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* An aggregated advert has no employer on HustleSpace to receive
                              an application, so it sends the candidate to the board it came
                              from. Showing Apply here would collect a CV into a void. */}
                          {job.sourceUrl ? (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 bg-[#CDFF00] text-black hover:scale-105 active:scale-95"
                            >
                              Apply on {job.sourceName} <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <button
                              onClick={() => setApplyTo(job)}
                              disabled={applied || job.ownedByCurrentUser}
                              className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                applied || job.ownedByCurrentUser
                                  ? 'bg-white/5 border border-white/10 text-gray-500'
                                  : 'bg-[#CDFF00] text-black hover:scale-105 active:scale-95'
                              }`}
                            >
                              {job.ownedByCurrentUser
                                ? <>Your advert</>
                                : applied
                                  ? <><Check className="w-3.5 h-3.5" /> Applied</>
                                  : <><Zap className="w-3.5 h-3.5" /> Apply now</>}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                    <Search className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight">No openings yet</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5">
                      {searchQuery || activeCategory !== 'all'
                        ? 'Try a different search or category'
                        : 'Verified companies post here first'}
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {composerOpen && (
          <JobComposer
            categories={JOB_CATEGORIES}
            onClose={() => setComposerOpen(false)}
            onPosted={(job) => { setComposerOpen(false); setJobs((p) => [job, ...p]); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {applyTo && (
          <JobApplyModal
            job={applyTo}
            onClose={() => setApplyTo(null)}
            onApplied={() => onApplied(applyTo.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
