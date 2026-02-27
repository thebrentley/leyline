import { useSyncExternalStore } from "react";

export interface ScanEntry {
  id: string;
  timestamp: number;
  ocrText: string;
  matched: boolean;
  matchedCardName?: string;
  matchedCardImage?: string;
}

let entries: ScanEntry[] = [];
let listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function addScanEntry(entry: Omit<ScanEntry, "id" | "timestamp">) {
  entries = [
    { ...entry, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() },
    ...entries,
  ];
  emit();
}

export function clearScanLog() {
  entries = [];
  emit();
}

function getSnapshot() {
  return entries;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScanLog() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
