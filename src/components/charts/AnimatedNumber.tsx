"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import { duration, useReducedMotion } from "@/lib/charts/motion";

/** A number that counts to each new value and briefly tints green (up) or red (down) when it changes. */
export function AnimatedNumber({ value, format, className }: { value: number | null | undefined; format: (v: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value ?? null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value ?? null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value ?? null;
    if (value == null || from == null || from === value) {
      setShown(value ?? null);
      return;
    }
    setFlash(value > from ? "up" : "down");
    const interp = d3.interpolateNumber(from, value);
    const ms = duration(700, reduced);
    const t = d3.timer((elapsed) => {
      const k = ms === 0 ? 1 : Math.min(1, d3.easeCubicOut(elapsed / ms));
      setShown(interp(k));
      if (k >= 1) t.stop();
    });
    const clear = setTimeout(() => setFlash(null), 1200);
    return () => {
      t.stop();
      clearTimeout(clear);
    };
  }, [value, reduced]);

  return (
    <span className={clsx("tabular rounded px-0.5 transition-colors duration-700", flash === "up" && "bg-up-wash", flash === "down" && "bg-down-wash", className)}>
      {shown == null ? "—" : format(shown)}
    </span>
  );
}
