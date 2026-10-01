import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { payoutsApi } from '../api/client';
import { useSellerAccess } from '../hooks/useSellerAccess';

const errorMessage = (error) => error.response?.data?.error || error.response?.data?.message
  || error.message || 'Stripe is unavailable. Please try again.';

export default function BankConnection() {
  const [params] = useSearchParams();
  const { canSell, loading: checkingAccess } = useSellerAccess();
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
    if (checkingAccess || !canSell) return;
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
  }, [canSell, checkingAccess, refresh, checkStatus]);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await payoutsApi.connect();
      window.location.assign(data.url);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  if (checkingAccess) return <p className="p-8 text-gray-400">Checking seller access…</p>;
  if (!canSell) return (
    <div className="max-w-xl mx-auto p-8 text-gray-300">
      <p>A seller account is required to connect a bank account.</p>
      <Link to="/dashboard" className="text-[#CDFF00] underline">Back to dashboard</Link>
    </div>
  );

  return (
    <section className="max-w-xl mx-auto my-8 p-6 rounded-2xl border border-white/10 bg-[#111] text-white">
      <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Back to dashboard</Link>
      <h1 className="text-2xl font-bold mt-5">Bank connection</h1>
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
      <div className="flex flex-wrap gap-3">
        {!status?.payoutsEnabled && <button type="button" onClick={connect} disabled={busy || loading}
          className="rounded-xl px-5 py-3 bg-[#CDFF00] text-black font-bold disabled:opacity-50">
          {busy ? 'Opening Stripe…' : status?.connected ? 'Continue setup on Stripe' : 'Connect bank account'}
        </button>}
        <button type="button" onClick={checkStatus} disabled={busy || loading}
          className="rounded-xl px-5 py-3 border border-white/20 text-white disabled:opacity-50">
          Refresh status
        </button>
      </div>
    </section>
  );
}
