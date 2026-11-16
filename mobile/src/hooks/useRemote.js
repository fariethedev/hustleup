import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '../utils/marketplace';

// A focus/foreground refresh also reconciles payments and ticket admission after returning.
// A generation guard prevents late responses updating an unfocused/replaced screen.
export function useRemote(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    try {
      const next = await fetcher();
      if (id === generation.current) { setData(next); setError(''); }
    } catch (e) {
      if (id === generation.current) setError(errorMessage(e, 'Could not load this page. Please try again.'));
    } finally { if (id === generation.current) setLoading(false); }
  }, [fetcher]);
  useFocusEffect(useCallback(() => {
    reload();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') reload(); });
    return () => { generation.current++; listener.remove(); };
  }, [reload]));
  return { data, loading, error, reload };
}
