import { useCallback, useEffect, useRef, useState } from 'react';
import { addReading, economySchema, POLL_INTERVAL, readEndpoint, REQUEST_TIMEOUT, statusSchema, type EconomyResponse, type Reading, type Resource, type StatusData } from './api';

const emptyResource = <T,>(): Resource<T> => ({ data: null, error: null, receivedAt: null });

export function useTelemetry() {
  const [status, setStatus] = useState<Resource<StatusData>>(emptyResource);
  const [economy, setEconomy] = useState<Resource<EconomyResponse>>(emptyResource);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pending, setPending] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [nextAt, setNextAt] = useState(() => Date.now() + POLL_INTERVAL);
  const [online, setOnline] = useState(navigator.onLine);
  const [announcement, setAnnouncement] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    if (manual) setAnnouncement('');
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const [statusResult, economyResult] = await Promise.allSettled([
      readEndpoint('/v1/status', statusSchema, controller.signal),
      readEndpoint('/v1/economy/state', economySchema, controller.signal),
    ]);
    clearTimeout(timeout);
    if (!mounted.current) return;
    const receivedAt = Date.now();
    const errorMessage = (reason: unknown) => reason instanceof Error && reason.name !== 'AbortError' ? reason.message : 'The request timed out.';
    if (statusResult.status === 'fulfilled') {
      setStatus({ data: statusResult.value, error: null, receivedAt });
      setReadings((previous) => addReading(previous, statusResult.value.measurement, receivedAt));
    } else {
      setStatus((previous) => ({ ...previous, error: errorMessage(statusResult.reason) }));
    }
    if (economyResult.status === 'fulfilled') {
      setEconomy({ data: economyResult.value, error: null, receivedAt });
    } else {
      setEconomy((previous) => ({ ...previous, error: errorMessage(economyResult.reason) }));
    }
    if (manual) {
      const failures = Number(statusResult.status === 'rejected') + Number(economyResult.status === 'rejected');
      setAnnouncement(failures === 0 ? 'Readings refreshed.' : failures === 1 ? 'One data source could not refresh. Last available readings are shown.' : 'Unable to refresh. Check your connection and try again.');
    }
    activeRequest.current = null;
    setPending(false);
    setNow(receivedAt);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const connected = () => { setOnline(true); void refresh(); };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      activeRequest.current?.abort();
      activeRequest.current = null;
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    setNextAt(Date.now() + POLL_INTERVAL);
    const timer = setInterval(() => {
      setNextAt(Date.now() + POLL_INTERVAL);
      void refresh();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const toggleAutoRefresh = () => {
    if (!autoRefresh) void refresh();
    setAutoRefresh((previous) => !previous);
  };

  return { status, economy, readings, pending, now, online, autoRefresh, refresh, toggleAutoRefresh, announcement, nextIn: Math.max(0, Math.ceil((nextAt - now) / 1000)) };
}
