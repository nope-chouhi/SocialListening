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
  return `${wsBase}/api/realtime/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function useSocket(onEvent?: (evt: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as RealtimeEvent;
        onEventRef.current?.(parsed);
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    connect();
    const interval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }, 10000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, reconnect: connect };
}
