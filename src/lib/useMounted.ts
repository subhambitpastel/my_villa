"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// Hydration gate: false during SSR + first client render, true after.
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
