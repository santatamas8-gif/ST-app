"use client";

import { useEffect } from "react";
import { OfflineBanner } from "./OfflineBanner";

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {})
      .catch(() => {});
  }, []);

  return <OfflineBanner />;
}
