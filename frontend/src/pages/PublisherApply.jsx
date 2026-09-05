import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase, Newspaper, BadgeCheck, Loader2, AlertCircle, Upload, Clock,
  CheckCircle2, XCircle, ShieldAlert, ArrowLeft
} from 'lucide-react';
import { publishersApi, dispatchToast } from '../api/client';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';

const TYPES = [
  {
    id: 'HIRING_COMPANY',
    name: 'Hiring company',
    icon: Briefcase,
    blurb: 'Post jobs and gigs, and receive applications from the HustleSpace community.',
  },
  {
    id: 'NEWS_OUTLET',
    name: 'News outlet',
    icon: Newspaper,
    blurb: 'Publish articles to the News desk under your masthead.',
  },
];

const STATUS_UI = {
  PENDING:   { icon: Clock,       tone: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Under review' },
  APPROVED:  { icon: CheckCircle2, tone: 'text-[#CDFF00] bg-[#CDFF00]/10 border-[#CDFF00]/20', label: 'Verified' },
  REJECTED:  { icon: XCircle,     tone: 'text-red-400 bg-red-400/10 border-red-400/20',       label: 'Not approved' },
  SUSPENDED: { icon: ShieldAlert, tone: 'text-red-400 bg-red-400/10 border-red-400/20',       label: 'Suspended' },
};

/**
 * Apply to become a verified publisher, and see where an existing application stands.
 *
 * <p>Deliberately one page for both: someone arriving here has either not applied or wants
 * to know why they still cannot post, and splitting those into two routes would mean the
 * second question has no obvious home.
 */
export default function PublisherApply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [type, setType] = useState(params.get('type') === 'NEWS_OUTLET' ? 'NEWS_OUTLET' : 'HIRING_COMPANY');
  const [form, setForm] = useState({
    companyName: '', registrationNumber: '', website: '', description: '',
    contactEmail: '', contactPhone: '',
  });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [document, setDocument] = useState(null);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const logoRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    publishersApi.me()
      .then((res) => setExisting(res.data?.profiles || []))
      .catch(() => setExisting([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const current = existing.find((p) => p.type === type);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Prefill from a previous application so a rejected applicant only edits what changed.
  useEffect(() => {
    if (!current) return;
    setForm({
      companyName: current.companyName || '',
      registrationNumber: current.registrationNumber || '',
      website: current.website || '',
      description: current.description || '',
      contactEmail: current.contactEmail || '',
      contactPhone: current.contactPhone || '',
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickLogo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('The logo must be an image'); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogo(f);
    setLogoPreview(URL.createObjectURL(f));
    setError(null);
  };

  const submit = async () => {
    if (!form.companyName.trim()) { setError('Company or outlet name is required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await publishersApi.apply({ ...form, type, logo, document });
      setExisting((prev) => {
        const others = prev.filter((p) => p.type !== type);
        return [...others, res.data];
      });
      dispatchToast('Application submitted — we will review it shortly', 'success');
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.message
        || (err.response?.status ? `Could not submit (server said ${err.response.status})` : 'Could not reach the server'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 transition-colors';
  const label = 'text-[10px] font-black tracking-widest text-gray-500 mb-1.5 block';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#CDFF00]" />
      </div>
    );
  }

  const statusUi = current ? STATUS_UI[current.status] : null;
  const isApproved = current?.status === 'APPROVED';

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <BadgeCheck className="w-7 h-7 text-[#CDFF00]" />
        <h1 className="text-2xl font-black tracking-tight">Get verified</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Jobs and News are restricted to verified organisations. Tell us who you are and we will review it.
      </p>

      {/* Type picker */}
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {TYPES.map((t) => {
          const mine = existing.find((p) => p.type === t.id);
          return (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                type === t.id
                  ? 'bg-[#CDFF00]/10 border-[#CDFF00]/40'
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <t.icon className={`w-5 h-5 ${type === t.id ? 'text-[#CDFF00]' : 'text-gray-500'}`} />
                {mine && STATUS_UI[mine.status] && (
                  <span className={`text-[9px] font-black tracking-widest px-2 py-1 rounded-md border ${STATUS_UI[mine.status].tone}`}>
                    {STATUS_UI[mine.status].label}
                  </span>
                )}
              </div>
              <p className="text-sm font-black text-white mb-1">{t.name}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{t.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Current status for the selected type */}
      {current && statusUi && (
        <div className={`p-4 rounded-2xl border mb-6 ${statusUi.tone}`}>
          <div className="flex items-center gap-2 mb-1">
            <statusUi.icon className="w-4 h-4" />
            <span className="text-xs font-black tracking-widest">{statusUi.label}</span>
          </div>
          {current.status === 'PENDING' && (
            <p className="text-xs opacity-80">
              Your application for <strong>{current.companyName}</strong> is with our review team.
            </p>
          )}
          {isApproved && (
            <p className="text-xs opacity-80">
              <strong>{current.companyName}</strong> is verified. You can publish from the{' '}
              {type === 'HIRING_COMPANY'
                ? <Link to="/jobs" className="underline">Jobs board</Link>
                : <Link to="/news" className="underline">News desk</Link>}.
            </p>
          )}
          {current.reviewNote && (
            <p className="text-xs opacity-80 mt-1.5">Reviewer note: {current.reviewNote}</p>
          )}
        </div>
      )}

      {/* The form — hidden once approved, since resubmitting would only risk the
          verification they already hold. */}
      {!isApproved && (
        <div className="space-y-4">
          <div>
            <label className={label}>{type === 'NEWS_OUTLET' ? 'Outlet name' : 'Company name'} *</label>
            <input className={field} value={form.companyName} onChange={(e) => set('companyName', e.target.value)}
                   placeholder={type === 'NEWS_OUTLET' ? 'Warsaw Business Daily' : 'GigaFactory Hub'} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Registration number</label>
              <input className={field} value={form.registrationNumber}
                     onChange={(e) => set('registrationNumber', e.target.value)} placeholder="KRS / NIP / press ID" />
            </div>
            <div>
              <label className={label}>Website</label>
              <input className={field} value={form.website} onChange={(e) => set('website', e.target.value)}
                     placeholder="https://…" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Contact email</label>
              <input className={field} type="email" value={form.contactEmail}
                     onChange={(e) => set('contactEmail', e.target.value)} placeholder="Defaults to your account email" />
            </div>
            <div>
              <label className={label}>Contact phone</label>
              <input className={field} value={form.contactPhone}
                     onChange={(e) => set('contactPhone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>What will you post?</label>
            <textarea className={`${field} min-h-[90px] resize-none`} value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="A sentence or two about your organisation and what you plan to publish." />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Logo</label>
              <button onClick={() => logoRef.current?.click()}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/50 flex items-center justify-center overflow-hidden transition-colors group">
                {logoPreview
                  ? <img src={logoPreview} alt="" className="w-full h-full object-contain p-2" />
                  : <span className="flex flex-col items-center gap-1.5 text-gray-500 group-hover:text-[#CDFF00] transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-[9px] font-bold tracking-widest">Upload logo</span>
                    </span>}
              </button>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={pickLogo} />
            </div>
            <div>
              <label className={label}>Proof document</label>
              <button onClick={() => docRef.current?.click()}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/50 flex items-center justify-center px-3 text-center transition-colors group">
                <span className="flex flex-col items-center gap-1.5 text-gray-500 group-hover:text-[#CDFF00] transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-[9px] font-bold tracking-widest truncate max-w-full">
                    {document ? document.name : 'Registration / credential'}
                  </span>
                </span>
              </button>
              {/* The server's upload allowlist is images and video, so a photo or scan of
                  the certificate is what to attach here — a PDF is refused with a message. */}
              <input ref={docRef} type="file" accept="image/*" hidden
                     onChange={(e) => { setDocument(e.target.files?.[0] || null); e.target.value = ''; }} />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={submit} disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><BadgeCheck className="w-4 h-4" /> {current ? 'Resubmit application' : 'Submit application'}</>}
          </motion.button>
        </div>
      )}
    </div>
  );
}
