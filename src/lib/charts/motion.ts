"use client";

import { useEffect, useState } from "react";

/** True when the visitor asked their OS to reduce motion; charts then render without animation. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Animation length in ms, or 0 when motion is reduced. */
export const duration = (ms: number, reduced: boolean) => (reduced ? 0 : ms);
