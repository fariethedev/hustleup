import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Newspaper, Briefcase, Plus, BadgeCheck, ExternalLink, Eye, Users, ShieldCheck, Loader2,
} from 'lucide-react';
import { newsApi, jobsApi, publishersApi, dispatchToast } from '../api/client';
import ArticleComposer from './news/ArticleComposer';
import JobComposer from './jobs/JobComposer';
import { SECTIONS, JOB_CATEGORIES } from '../utils/taxonomy';

/**
 * Publishing an article or a job advert, from the dashboard.
 *
 * <h2>Why this is here and not only on /news and /jobs</h2>
 * <p>The composers already existed, but the only way to reach either was to navigate to the
 * news or jobs page and notice a button in its header. Signing in dropped you on the
 * dashboard, which had no mention of news or jobs at all — so for anyone who had been
 * approved to publish, the feature was effectively invisible from the place they land.
 *
 * <h2>Approval is the server's call</h2>
 * <p>{@code publishersApi.me()} reports {@code canPostNews} / {@code canPostJobs}, and this
 * only decides what to offer. The POST endpoints re-check through {@code PublisherGuard},
 * so forcing a composer open still cannot publish anything. Someone not yet approved gets
 * the application link rather than a disabled button with no explanation.
 */
export default function PublishingPanel() {
  const [permissions, setPermissions] = useState(null); // null until known
  const [articles, setArticles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(null); // 'news' | 'job' | null

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([publishersApi.me(), newsApi.mine(), jobsApi.mine()])
      .then(([me, mine, myJobs]) => {
        if (cancelled) return;
        setPermissions(me.status === 'fulfilled' ? (me.value.data || {}) : {});
        // Both lists 401 for someone who has never published; an empty list is the right
        // reading of that, not an error worth showing.
        setArticles(mine.status === 'fulfilled' ? (mine.value.data || []) : []);
        setJobs(myJobs.status === 'fulfilled' ? (myJobs.value.data || []) : []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const canPostNews = !!permissions?.canPostNews;
  const canPostJobs = !!permissions?.canPostJobs;

  return (
    <div className="space-y-4">
      <Section
        icon={Newspaper}
        title="News"
        blurb="Publish a story to the news desk. It appears on /news and in every reader's section filters."
        canPost={canPostNews}
        applyTo="/publisher/apply?type=NEWS_OUTLET"
        applyLabel="Apply as a news outlet"
        onCompose={() => setComposer('news')}
        composeLabel="Write an article"
        items={articles}
        emptyLabel="You haven't published an article yet."
        renderItem={(a) => (
          <PublishedRow
            key={a.id}
            title={a.title}
            meta={[a.category, a.status, `${a.viewsCount || 0} views`]}
            to="/news"
          />
        )}
      />

      <Section
        icon={Briefcase}
        title="Jobs"
        blurb="Post a vacancy to the jobs board. Candidates apply through HustleSpace and their applications land here."
        canPost={canPostJobs}
        applyTo="/publisher/apply?type=HIRING_COMPANY"
        applyLabel="Apply as a hiring company"
        onCompose={() => setComposer('job')}
        composeLabel="Post a job"
        items={jobs}
        emptyLabel="You haven't posted a job yet."
        renderItem={(j) => (
          <PublishedRow
            key={j.id}
            title={j.title}
            meta={[j.category, j.status, `${j.applicationsCount || 0} applicants`]}
            to="/jobs"
            icon={Users}
          />
        )}
      />

      <AnimatePresence>
        {composer === 'news' && (
          <ArticleComposer
            sections={SECTIONS}
            onClose={() => setComposer(null)}
            onPublished={(a) => {
              setComposer(null);
              setArticles((prev) => [a, ...prev]);
              dispatchToast('Article published', 'success');
            }}
          />
        )}
        {composer === 'job' && (
          <JobComposer
            categories={JOB_CATEGORIES}
            onClose={() => setComposer(null)}
            onPosted={(j) => {
              setComposer(null);
              setJobs((prev) => [j, ...prev]);
              dispatchToast('Job posted', 'success');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── One publishing surface: news or jobs ── */
function Section({
  icon: Icon, title, blurb, canPost, applyTo, applyLabel,
  onCompose, composeLabel, items, emptyLabel, renderItem,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/25 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-[#CDFF00]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              {title}
              {canPost && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" title="Verified publisher" />}
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{blurb}</p>
          </div>
        </div>

        {canPost ? (
          <button
            type="button"
            onClick={onCompose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#E0FF4D] transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" /> {composeLabel}
          </button>
        ) : (
          /* Not approved yet. The link is the honest offer — a greyed-out compose button
             would say "no" without saying how to get to "yes". */
          <Link
            to={applyTo}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-black tracking-widest hover:border-white/30 transition-colors shrink-0"
          >
            <ShieldCheck className="w-3 h-3" /> {applyLabel}
          </Link>
        )}
      </div>

      {canPost && (
        items.length === 0 ? (
          <p className="text-[11px] text-gray-600 py-2">{emptyLabel}</p>
        ) : (
          <div className="space-y-1.5">{items.slice(0, 5).map(renderItem)}</div>
        )
      )}
    </div>
  );
}

function PublishedRow({ title, meta, to, icon: Icon = Eye }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 transition-colors group"
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold text-white truncate">{title}</span>
        <span className="block text-[10px] font-bold tracking-widest text-gray-500 truncate">
          {meta.filter(Boolean).join(' · ')}
        </span>
      </span>
      <Icon className="w-3.5 h-3.5 text-gray-600 group-hover:text-white transition-colors shrink-0" />
    </Link>
  );
}
