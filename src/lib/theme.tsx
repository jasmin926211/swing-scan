"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<() => void>();

/** Runs before first paint (inlined in the root layout) so a dark-mode visitor never sees a white flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Follow the OS setting until the visitor picks a theme here.
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    let stored = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    if (!stored) apply(mq.matches ? "dark" : "light");
  };
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Synchronously, so charts (which pick colors in React) repaint inside the transition snapshot.
  flushSync(() => listeners.forEach((l) => l()));
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}

/** Switch theme; the new one is revealed as a circle growing from (x, y), usually the toggle button. */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(theme);
  if (!document.startViewTransition) {
    root.classList.add("theme-fade");
    apply(theme);
    window.setTimeout(() => root.classList.remove("theme-fade"), 400);
    return;
  }
  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? 0;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(() => apply(theme));
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
}
