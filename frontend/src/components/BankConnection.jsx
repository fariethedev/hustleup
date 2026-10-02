import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { payoutsApi } from '../api/client';
import { Building2, ShieldCheck, ArrowUpRight } from 'lucide-react';

const errorMessage = (error) => error.response?.data?.error || error.response?.data?.message
  || error.message || 'Stripe is unavailable. Please try again.';

export default function BankConnection({ embedded = false }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refreshLink = useRef(null);
  const refresh = params.get('payout') === 'refresh';
  const returned = ['return', 'complete'].includes(params.get('payout'));

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await payoutsApi.status();
      if (typeof data?.connected !== 'boolean' || typeof data?.payoutsEnabled !== 'boolean') {
        throw new Error('Could not verify your bank connection. Please retry.');
      }
      setStatus(data);
    } catch (failure) {
      setStatus(null);
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!refresh) {
      checkStatus();
      return;
    }
    // An expired single-use link needs a new authenticated server request. Share it
    // across StrictMode effect replays, and never infer success from the return URL.
    let cancelled = false;
    setBusy(true);
    setLoading(false);
    if (!refreshLink.current) refreshLink.current = payoutsApi.connect();
    refreshLink.current.then(({ data }) => {
      if (!cancelled) window.location.replace(data.url);
    }).catch((failure) => {
      if (!cancelled) { setError(errorMessage(failure)); setBusy(false); }
    });
    return () => { cancelled = true; };
  }, [refresh, checkStatus]);

  const connect = async (dashboard = false) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await (dashboard ? payoutsApi.dashboard() : payoutsApi.connect());
      window.location.assign(data.url);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto my-8 p-5 sm:p-8 rounded-3xl border border-white/10 bg-[#111] text-white">
      {!embedded && <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Back to dashboard</Link>}
      <div className="mt-6 flex items-center gap-4"><div className="rounded-2xl bg-[#CDFF00] p-3 text-black"><Building2 size={28} /></div><div><p className="uppercase text-[10px] tracking-[.2em] text-gray-400">Seller payments</p><h1 className="text-3xl font-black">Your money. Your bank.</h1></div></div>
      <p className="mt-2 text-sm text-gray-400">Stripe securely collects your bank details and verifies your identity. HustleSpace does not collect bank account numbers.</p>
      {returned && <p className="mt-4 text-sm text-gray-300">You have returned from Stripe. Your current payout status is checked below.</p>}
      <div aria-live="polite" className="my-5 text-sm">
        {loading ? <p>Checking your bank connection…</p> : status ? (
          <p className={status.payoutsEnabled ? 'text-[#CDFF00]' : 'text-gray-300'}>
            {status.payoutsEnabled ? 'Bank connected. Stripe has enabled payouts.'
              : status.detailsSubmitted ? 'Details submitted. Stripe has not enabled payouts yet; verification or more information may be needed.'
              : status.connected ? 'Setup started. Finish your bank and identity details on Stripe.'
              : 'No bank account connected yet.'}
          </p>
        ) : <p>Bank connection status has not been verified.</p>}
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl p-3 bg-red-500/10 text-red-300 text-sm">{error}</p>}
      {status?.requirementsDue?.length > 0 && <p className="mb-4 rounded-xl p-3 bg-amber-500/10 text-amber-200 text-sm">Action needed: Stripe is requesting additional information. Continue setup to review and submit the required details.</p>}
      {status?.pendingVerification?.length > 0 && <p className="mb-4 text-sm text-gray-300">Stripe is reviewing your information. Check back here or open Stripe for updates.</p>}
      {status?.connected && status?.transfersEnabled === false && <p className="mb-4 text-sm text-amber-200">Receiving marketplace transfers is not enabled yet. Complete Stripe’s requirements before your earnings can be released.</p>}
      <div className="flex flex-wrap gap-3">
        {(!status?.payoutsEnabled || status?.requirementsDue?.length > 0 || status?.transfersEnabled === false) && <button type="button" onClick={() => connect(false)} disabled={busy || loading || !status}
          className="rounded-xl px-5 py-3 bg-[#CDFF00] text-black font-bold disabled:opacity-50">
          {busy ? 'Opening Stripe…' : status?.connected ? 'Continue setup on Stripe' : 'Connect bank account'}
        </button>}
        {status?.connected && <button type="button" onClick={() => connect(true)} disabled={busy || loading}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-[#CDFF00] text-black font-bold disabled:opacity-50">
          {busy ? 'Opening Stripe…' : 'Manage bank & view payouts'}<ArrowUpRight size={16} />
        </button>}
        <button type="button" onClick={checkStatus} disabled={busy || loading}
          className="rounded-xl px-5 py-3 border border-white/20 text-white disabled:opacity-50">
          Refresh status
        </button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-8">
        {[
          ['01', 'Connect your bank', status?.connected ? 'Stripe account created. You can resume setup at any time.' : 'Use your own bank account. Your bank and identity details are entered securely on Stripe.'],
          ['02', 'Complete verification', status?.payoutsEnabled ? 'Stripe has enabled bank payouts for your account.' : 'Submit the details Stripe requests. Returning to this page does not mean verification is complete.'],
          ['03', 'Track your payments', 'Open your Stripe dashboard to see your balance, payout schedule and bank details.'],
        ].map(([number, title, copy]) => <div key={number} className="rounded-2xl border border-white/10 p-4"><span className="text-[#CDFF00] text-xs font-bold">{number}</span><h2 className="font-bold text-sm mt-3">{title}</h2><p className="text-xs text-gray-400 mt-2 leading-relaxed">{copy}</p></div>)}
      </div>
      <div className="border-t border-white/10 mt-8 pt-6">
        <h2 className="font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-[#CDFF00]" />From a sale to your bank</h2>
        {status?.platformFeePercent != null && <p className="text-sm text-gray-300 mt-3">Marketplace fee: {Number(status.platformFeePercent)}% of the goods or service price. Shipping is passed through in full.</p>}
        <ol className="mt-4 space-y-3 text-sm text-gray-400 list-decimal pl-5">
          <li>The buyer pays securely. Their payment is held while you fulfil the order.</li>
          <li>Funds become eligible for release after the buyer confirms receipt, or the order’s protection period ends. Open disputes can delay release.</li>
          <li>Your share, after marketplace fees, is transferred to your Stripe balance. A transfer is not yet a bank deposit.</li>
          <li>Stripe sends available funds to your bank on your payout schedule. Check Stripe for arrival estimates or verification issues.</li>
        </ol>
        <p className="text-xs text-gray-500 mt-5">Your subscription and your earned money are separate. You can manage your payout account even after your plan expires.</p>
      </div>
    </section>
  );
}
