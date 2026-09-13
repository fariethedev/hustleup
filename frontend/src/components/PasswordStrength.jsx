import { motion, AnimatePresence } from 'framer-motion';
import { CircleCheck, CircleX } from 'lucide-react';
import { PASSWORD_RULES, checkRules, passwordStrength } from '../utils/password';

/**
 * Live feedback on a password as it is typed: a strength bar and a ticking checklist.
 *
 * <h3>Why it animates</h3>
 * Not decoration. A rule that snaps from grey to green the instant you satisfy it tells you
 * *which keystroke did it*, which is the whole difference between a form that teaches the
 * policy and one that recites it. A static list you have to re-read after every attempt
 * teaches nothing — you find out what was wrong only after being rejected.
 *
 * <h3>Why the checklist appears on focus, not on error</h3>
 * The rules are shown from the moment the field is touched, before anything can be wrong.
 * Requirements that only surface on failure are a trap: the user has already committed to a
 * password by then, and is being asked to go back and change it.
 */
export default function PasswordStrength({ value = '', visible = true }) {
  const met = checkRules(value);
  const { score, label, tone } = passwordStrength(value);

  const barColour = {
    weak: 'bg-red-500',
    good: 'bg-amber-400',
    strong: 'bg-[#CDFF00]',
    excellent: 'bg-emerald-400',
    idle: 'bg-white/10',
  }[tone];

  const labelColour = {
    weak: 'text-red-400',
    good: 'text-amber-300',
    strong: 'text-[#CDFF00]',
    excellent: 'text-emerald-400',
    idle: 'text-gray-500',
  }[tone];

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pt-3 space-y-3">
            {/* Four segments rather than one filling bar: a discrete jump is legible at a
                glance, where a continuous width change reads as noise while typing. */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ scaleX: i < score ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{ originX: 0 }}
                      className={`h-full w-full rounded-full ${barColour}`}
                    />
                  </div>
                ))}
              </div>
              <AnimatePresence mode="wait">
                {label && (
                  <motion.span
                    key={label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className={`text-[10px] font-black tracking-widest shrink-0 ${labelColour}`}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* The checklist. Two columns on anything above a phone — five stacked rows
                pushes the rest of the form off the screen on a laptop. */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {PASSWORD_RULES.map((rule, i) => {
                const ok = met[rule.id];
                return (
                  <motion.li
                    key={rule.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <motion.span
                      initial={false}
                      animate={ok
                        ? { scale: [1, 1.35, 1], backgroundColor: 'rgba(205,255,0,0.15)' }
                        : { scale: 1, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      transition={{ duration: 0.3 }}
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 border border-white/10"
                    >
                      {ok
                        ? <CircleCheck className="w-2.5 h-2.5 text-[#CDFF00]" strokeWidth={4} />
                        : <CircleX className="w-2.5 h-2.5 text-gray-600" strokeWidth={3} />}
                    </motion.span>
                    <span className={ok ? 'text-gray-300 font-semibold' : 'text-gray-500'}>
                      {rule.label}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
