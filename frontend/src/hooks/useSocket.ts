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
  const retryCount = useRef(0);
  const maxRetries = 5;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (retryCount.current >= maxRetries) {
      console.warn('[Socket] Maximum reconnection attempts reached. Falling back to HTTP polling.');
      return;
    }

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryCount.current = 0; // reset on success
      };
      
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };
      
      ws.onerror = () => {
        setConnected(false);
        // Error will naturally trigger onclose
      };
      
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeEvent;
          onEventRef.current?.(parsed);
        } catch {
          /* ignore */
        }
      };
    } catch (err) {
      console.error('[Socket] Connection error:', err);
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (retryCount.current < maxRetries) {
      retryCount.current++;
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000); // Exponential backoff up to 30s
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

  return { connected, reconnect: connect, isFallback: retryCount.current >= maxRetries };
}
