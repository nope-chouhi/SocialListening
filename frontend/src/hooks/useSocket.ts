'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';

export type RealtimeEvent = {
  event: string;
  data: Record<string, unknown>;
};

function getWsUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  // NOTE: token is appended but NEVER logged to console
  return `${wsBase}/api/realtime/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function useSocket(onEvent?: (evt: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const retryCount = useRef(0);
  const maxRetries = 3; // Reduced: after 3 fails, silently switch to polling
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedFallback = useRef(false);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('access_token');
    if (!token) return; // Do not connect if not logged in

    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (retryCount.current >= maxRetries) {
      // Silent fallback — only warn once, never mention token
      if (!hasLoggedFallback.current) {
        console.warn('[Realtime] WebSocket unavailable, using HTTP polling fallback.');
        hasLoggedFallback.current = true;
      }
      setIsFallback(true);
      return;
    }

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setIsFallback(false);
        retryCount.current = 0;
        hasLoggedFallback.current = false;
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Error triggers onclose — no need to log here to avoid noise
        setConnected(false);
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeEvent;
          onEventRef.current?.(parsed);
        } catch {
          /* ignore malformed messages */
        }
      };
    } catch {
      // Silent — scheduleReconnect handles logging after max retries
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (retryCount.current < maxRetries) {
      retryCount.current++;
      const delay = Math.min(2000 * Math.pow(2, retryCount.current - 1), 30000); // 2s, 4s, 8s
      timeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, isFallback, reconnect: connect };
}
