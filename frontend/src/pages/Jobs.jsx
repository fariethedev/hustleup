import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, DollarSign, Clock, Search, Factory, Baby,
  GraduationCap, Stethoscope, TrendingUp, Users, Zap, Check, LayoutGrid
} from 'lucide-react';
import { dispatchToast } from '../api/client';
import HeroBrief from '../components/HeroBrief';

const STATS = [
  { label: 'Active Roles', value: '2,800+', icon: Briefcase },
  { label: 'Hired This Month', value: '430', icon: TrendingUp },
  { label: 'Companies', value: '190+', icon: Users },
];

const JOB_CATEGORIES = [
  { id: 'factory', name: 'Industrial & Factory', icon: Factory },
  { id: 'babysitting', name: 'Family & Childcare', icon: Baby },
  { id: 'teaching', name: 'Education & Tutoring', icon: GraduationCap },
  { id: 'nursing', name: 'Graduate Nursing', icon: Stethoscope },
];

const INITIAL_JOBS = [
  {
    id: 1,
    title: 'Senior Assembly Specialist',
    company: 'GigaFactory Hub',
    category: 'factory',
    location: 'Industrial Zone A',
    salary: '$28 - $35 / hr',
    type: 'Full-time',
    posted: '2h ago',
    description: 'Lead assembly lines for next-gen energy storage units. Requires precision and team coordination.',
    tags: ['Safety First', 'Night Shift', 'Overtime']
  },
  {
    id: 2,
    title: 'Bilingual Private Tutor',
    company: 'Elite Scholars',
    category: 'teaching',
    location: 'Remote / West Side',
    salary: '$45 - $60 / hr',
    type: 'Contract',
    posted: '5h ago',
    description: 'Provide high-quality mathematics and physics tutoring for A-level students.',
    tags: ['Flexible', 'Bonus Pay', 'Remote']
  },
  {
    id: 3,
    title: 'Registered Nurse (L1)',
    company: 'St. Mary’s Care',
    category: 'nursing',
    location: 'Central Medical Plaza',
    salary: '$85k - $110k / yr',
    type: 'Full-time',
    posted: '1d ago',
    description: 'Post-graduate opportunity for licensed RNs looking to specialize in pediatric care.',
    tags: ['Health Benefits', 'Relocation', 'Sign-on Bonus']
  },
  {
    id: 4,
    title: 'Evening Chaperone',
    company: 'Nexus Family Services',
    category: 'babysitting',
    location: 'Greenwood Heights',
    salary: '$22 - $26 / hr',
    type: 'Part-time',
    posted: '3h ago',
    description: 'Reliable childcare for two school-aged children. Light meal prep and homework assistance required.',
    tags: ['Background Check', 'Quiet Environment']
  }
];

export default function Jobs() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [applied, setApplied] = useState(() => new Set());

  const filteredJobs = INITIAL_JOBS.filter(job =>
    (activeCategory === 'all' || job.category === activeCategory) &&
    (job.title.toLowerCase().includes(searchQuery.toLowerCase()) || job.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const apply = (job) => {
    if (applied.has(job.id)) return;
    setApplied((prev) => new Set(prev).add(job.id));
    dispatchToast(`Application sent to ${job.company}!`, 'success');
  };

  return (
    <div className="min-h-screen text-white pb-16">
      <HeroBrief
        pillText="Marketplace of Opportunities"
        title="Hustle Jobs"
        subtitle="Direct connections to high-impact roles — no middlemen, no static."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
              <Icon className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <div>
                <div className="text-sm font-black text-white leading-tight">{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 leading-tight">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 focus-within:border-[#CDFF00]/50 rounded-xl px-4 py-2.5 mb-4 transition-colors">
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
              {filteredJobs.length} found
            </span>
          )}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
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

        {/* Job Feed */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => {
                const isApplied = applied.has(job.id);
                const catInfo = JOB_CATEGORIES.find(c => c.id === job.category);
                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="bg-white/[0.02] border border-white/10 hover:border-[#CDFF00]/30 rounded-2xl p-5 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-black text-[#CDFF00] bg-[#CDFF00]/10 px-2.5 py-1 rounded-md uppercase tracking-widest border border-[#CDFF00]/20">
                            {catInfo?.name}
                          </span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{job.type}</span>
                        </div>
                        <h2 className="text-base font-black text-white mb-1.5 leading-tight">{job.title}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 font-semibold mb-3">
                          <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-gray-600" /> {job.company}</span>
                          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-600" /> {job.location}</span>
                          <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-gray-600" /> {job.salary}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-600" /> {job.posted}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-2.5 line-clamp-2">{job.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {job.tags.map(tag => (
                            <span key={tag} className="text-[9px] font-bold text-gray-500 bg-white/5 border border-white/5 px-2 py-1 rounded-md uppercase tracking-widest">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => apply(job)}
                          disabled={isApplied}
                          className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            isApplied
                              ? 'bg-white/5 border border-white/10 text-gray-500'
                              : 'bg-[#CDFF00] text-black hover:scale-105 active:scale-95'
                          }`}
                        >
                          {isApplied ? <><Check className="w-3.5 h-3.5" /> Applied</> : <><Zap className="w-3.5 h-3.5" /> Apply Now</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-20 text-center flex flex-col items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  <Search className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">No openings found</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5">Try a different search or category</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
