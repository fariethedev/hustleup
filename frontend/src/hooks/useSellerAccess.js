import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';

/** Kept for existing callers; subscriptions were retired, so it is a no-op. */
export function invalidateSellerAccess() {}

/**
 * Whether the current account may sell. Memberships were retired: every signed-in account
 * can sell, use Bond and see leaderboards. HustleSpace only earns its fee on each transaction.
 */
export function useSellerAccess() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  return {
    canSell: !!isAuthenticated,
    premium: false,
    grandfathered: false,
    subscription: null,
    loading: false,
    refresh: () => {},
  };
}
