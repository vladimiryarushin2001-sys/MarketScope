import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AnalysisRun, ClientRequest } from '../types';

export function useClientRequests() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [{ data: reqs, error: eReqs }, { data: rns, error: eRuns }] = await Promise.all([
          supabase.from('client_requests').select('*').order('created_at', { ascending: false }),
          supabase.from('analysis_runs').select('*').order('created_at', { ascending: false }),
        ]);
        const err = eReqs || eRuns;
        if (err) throw err;
        if (cancelled) return;
        setRequests((reqs ?? []) as ClientRequest[]);
        setRuns((rns ?? []) as AnalysisRun[]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки запросов');
          setRequests([]);
          setRuns([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const runsByRequestId = useMemo(() => {
    const map = new Map<number, AnalysisRun[]>();
    runs.forEach((r) => {
      const list = map.get(r.request_id) ?? [];
      list.push(r);
      map.set(r.request_id, list);
    });
    return map;
  }, [runs]);

  const latestRunId = useMemo(() => runs[0]?.id, [runs]);
  const latestRequestId = useMemo(() => requests[0]?.id, [requests]);

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      const [{ data: reqs, error: eReqs }, { data: rns, error: eRuns }] = await Promise.all([
        supabase.from('client_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('analysis_runs').select('*').order('created_at', { ascending: false }),
      ]);
      const err = eReqs || eRuns;
      if (err) throw err;
      setRequests((reqs ?? []) as ClientRequest[]);
      setRuns((rns ?? []) as AnalysisRun[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки запросов');
    } finally {
      setLoading(false);
    }
  };

  return { requests, runs, runsByRequestId, latestRunId, latestRequestId, loading, error, reload };
}

