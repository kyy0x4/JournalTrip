import { supabase } from '../lib/supabase';

export interface LeadTimeData {
  id: number;
  tanggal: string;
  area: string;
  no_polisi: string;
  no_lambung: string;
  driver: string;
  assistant: string;
  shift: string;
  ritase_ke: string;
  checkpoints: Record<string, any>;
  status_info: Record<string, any>;
  keterangan_umum: string;
  driver_id: string;
}

export const leadtimeService = {
  async getLeadTimes(startDate?: string, endDate?: string, area?: string) {
    const PAGE_SIZE = 1000;
    let allData: LeadTimeData[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('leadtimes')
        .select('*')
        .order('tanggal', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (startDate) query = query.gte('tanggal', startDate);
      if (endDate)   query = query.lte('tanggal', endDate);
      if (area && area !== 'ALL') {
        if (area === 'TAM') {
          query = query.in('area', ['JBK', 'NGORO', 'SUMATERA', 'SINGLE CARRIER', 'DOUBLE DECK']);
        } else {
          query = query.eq('area', area);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data as LeadTimeData[]);
        hasMore = data.length === PAGE_SIZE;
        page++;
      }
    }

    return allData;
  }
};
