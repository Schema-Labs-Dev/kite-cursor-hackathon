import { useSyncExternalStore } from 'react';

/**
 * Tiny on-device logger for blockchain interactions. In-memory ring buffer
 * (last 200 entries), mirrored to console for Metro/Xcode/adb. The `/debug`
 * screen subscribes via `useLogEntries()` to render them live.
 *
 * Use `log.info` for normal events, `log.warn` for things that recovered or
 * are unusual but expected, `log.error` for failures the user might see.
 *
 * Tag convention: `<area>.<step>` — e.g. `wallet.send`, `swap.approve`,
 * `treasury.deposit`, `userop.receipt`. Keep tags stable so filtering and
 * grep-ability stay useful.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogEntry = {
  id: number;
  ts: number;
  level: LogLevel;
  tag: string;
  msg: string;
  data?: unknown;
};

const BUFFER_SIZE = 200;
let nextId = 1;
let buffer: LogEntry[] = [];
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) fn();
}

function safeSerialize(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'function') return '[fn]';
  if (typeof v !== 'object') return v;
  try {
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
    return v;
  } catch {
    return String(v);
  }
}

function push(level: LogLevel, tag: string, msg: string, data?: unknown): void {
  const entry: LogEntry = {
    id: nextId++,
    ts: Date.now(),
    level,
    tag,
    msg,
    data: data !== undefined ? safeSerialize(data) : undefined,
  };
  buffer = [entry, ...buffer].slice(0, BUFFER_SIZE);

  const tagged = `[${tag}] ${msg}`;
  if (level === 'error') console.error(tagged, data ?? '');
  else if (level === 'warn') console.warn(tagged, data ?? '');
  else console.log(tagged, data ?? '');

  notify();
}

export const log = {
  info: (tag: string, msg: string, data?: unknown) => push('info', tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown) => push('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => push('error', tag, msg, data),
};

export function getEntries(): LogEntry[] {
  return buffer;
}

export function clearEntries(): void {
  buffer = [];
  notify();
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** React hook — re-renders the consumer whenever a new entry is pushed. */
export function useLogEntries(): LogEntry[] {
  return useSyncExternalStore(subscribe, getEntries, getEntries);
}
