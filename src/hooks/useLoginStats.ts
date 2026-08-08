import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchLoginStats, LoginStats, getMonthRangeWIB } from '../services/dataFetcher';

export function useLoginStats() {
  const [stats, setStats] = useState<LoginStats>({
    activeFleet: 0,
    onTimeRate: 0,
    liveTrips: 0,
    totalDrivers: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchLoginStats();
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // Realtime: refresh whenever trips/drivers change within current month
    const { start, end } = getMonthRangeWIB();
    const channel = supabase
      .channel('login-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row || !row.tanggal) return;
        if (row.tanggal >= start && row.tanggal <= end) refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { stats, loading };
}
