import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, DollarSign, Clock, Filter, Search, ChevronRight, Factory, Baby, GraduationCap, Stethoscope, TrendingUp, Users, Zap } from 'lucide-react';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80', // team collab
  'https://images.unsplash.com/photo-1573496799515-eebbb63814f2?w=400&q=80', // professional woman
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', // business man
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&q=80', // office worker
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80', // team meeting
];

const STATS = [
  { label: 'Active Roles', value: '2,800+', icon: Briefcase },
  { label: 'Hired This Month', value: '430', icon: TrendingUp },
  { label: 'Companies', value: '190+', icon: Users },
];

const JOB_CATEGORIES = [
  { id: 'factory', name: 'Industrial & Factory', icon: Factory, count: 124, color: '#CDFF00' },
  { id: 'babysitting', name: 'Family & Childcare', icon: Baby, count: 86, color: '#FF71C5' },
  { id: 'teaching', name: 'Education & Tutoring', icon: GraduationCap, count: 52, color: '#7000FF' },
  { id: 'nursing', name: 'Graduate Nursing', icon: Stethoscope, count: 19, color: '#00F0FF' },
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

  const filteredJobs = INITIAL_JOBS.filter(job => 
    (activeCategory === 'all' || job.category === activeCategory) &&
    (job.title.toLowerCase().includes(searchQuery.toLowerCase()) || job.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">

      {/* ── HERO ── */}
      <section className="relative min-h-[88vh] flex flex-col justify-end overflow-hidden">

        {/* Background image collage */}
        <div className="absolute inset-0">
          {/* Main large image */}
          <img
            src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1400&q=80"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center scale-105"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-[#050505]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-transparent" />
        </div>

        {/* Floating profile cards — right side */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 z-10">
          {HERO_IMAGES.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 * i, duration: 0.6, ease: 'easeOut' }}
              style={{ marginLeft: i % 2 === 0 ? 0 : '2rem' }}
              className="w-20 h-20 rounded-[20px] overflow-hidden border-2 border-white/10 shadow-2xl"
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </motion.div>
          ))}
        </div>

        {/* Accent glow */}
        <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-[#CDFF00]/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 pb-20 pt-40">

          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-[#CDFF00] border border-[#CDFF00]/30 bg-[#CDFF00]/5 mb-6"
          >
            <Zap className="w-3 h-3 fill-[#CDFF00]" /> Marketplace of Opportunities
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-7xl sm:text-[7rem] lg:text-[9rem] font-black text-white uppercase tracking-tighter leading-[0.88] mb-8 max-w-4xl"
          >
            HUSTLE<br /><span className="text-[#CDFF00]">JOBS.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl text-gray-300 font-medium max-w-lg mb-12 leading-relaxed"
          >
            The next chapter of your career starts here. Direct connections to high-impact roles — no middlemen, no static.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap gap-6"
          >
            {STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <Icon className="w-5 h-5 text-[#CDFF00]" />
                <div>
                  <div className="text-xl font-black text-white">{value}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SEARCH + CONTENT ── */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-20">
        {/* Search & Filter Bar */}
        <div className="glass bg-black/60 border border-white/10 rounded-[3rem] p-4 flex flex-col md:flex-row items-center gap-4 shadow-2xl backdrop-blur-3xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search roles, companies or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-16 pr-6 text-sm placeholder-gray-600 focus:border-[#CDFF00] transition-colors outline-none font-bold" 
            />
          </div>
          <button className="flex items-center gap-3 px-8 py-5 rounded-2xl bg-white/5 border border-white/10 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {JOB_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
              className={`p-6 rounded-[2rem] border transition-all duration-300 text-left group relative overflow-hidden ${
                activeCategory === cat.id 
                ? 'bg-[#CDFF00] border-[#CDFF00] text-black shadow-[0_0_40px_rgba(205,255,0,0.2)]' 
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <cat.icon className={`w-8 h-8 mb-4 ${activeCategory === cat.id ? 'text-black' : 'text-[#CDFF00]'}`} />
              <div className="font-black uppercase tracking-tighter text-sm leading-tight">{cat.name}</div>
              <div className={`text-[10px] font-bold mt-1 uppercase ${activeCategory === cat.id ? 'text-black/60' : 'text-gray-500'}`}>
                {cat.count} Postings
              </div>
            </button>
          ))}
        </div>

        {/* Job Feed */}
        <div className="mt-12 space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-white/[0.02] border border-white/5 hover:border-[#CDFF00]/30 rounded-[2.5rem] p-8 transition-all hover:bg-white/[0.04] relative"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-[#CDFF00] bg-[#CDFF00]/10 px-3 py-1 rounded-full uppercase tracking-widest border border-[#CDFF00]/20">
                          {JOB_CATEGORIES.find(c => c.id === job.category)?.name}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{job.type}</span>
                      </div>
                      <h2 className="text-2xl font-heading font-black text-white group-hover:text-[#CDFF00] transition-colors mb-2 uppercase tracking-tight">
                        {job.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-gray-400 font-bold mb-6 italic">
                        <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-600" /> {job.company}</div>
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-600" /> {job.location}</div>
                        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-600" /> {job.salary}</div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-600" /> {job.posted}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-black text-gray-500 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-8 py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#CDFF00]/10">
                        Apply Now
                      </button>
                      <button className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-32 text-center flex flex-col items-center gap-6 glass bg-black/20 rounded-[3rem]">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <Search className="w-10 h-10 text-gray-700" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">No openings found</h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mt-2">Try expanding your search criteria</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
