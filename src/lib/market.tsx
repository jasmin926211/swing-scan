"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MarketId } from "./api";

const STORAGE_KEY = "ct.market";

const MarketContext = createContext<{ market: MarketId; setMarket: (m: MarketId) => void }>({
  market: "in",
  setMarket: () => {},
});

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarketState] = useState<MarketId>("in");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "in" || saved === "us") setMarketState(saved);
    } catch {
      // storage unavailable (private mode): keep the default
    }
  }, []);

  const setMarket = useCallback((m: MarketId) => {
    setMarketState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  return <MarketContext.Provider value={{ market, setMarket }}>{children}</MarketContext.Provider>;
}

export const useMarket = () => useContext(MarketContext);
