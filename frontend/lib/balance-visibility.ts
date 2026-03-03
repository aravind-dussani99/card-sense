"use client";

import { useEffect, useRef, useState } from "react";

const VISIBILITY_KEY = "cardsense_balance_visible";
const DURATION_KEY = "cardsense_balance_duration";
const EVENT_NAME = "cardsense-balance-visibility";

export const getStoredVisibility = () => {
  if (typeof window === "undefined") return { visible: false, duration: 30 };
  const visible = localStorage.getItem(VISIBILITY_KEY) === "true";
  const durationRaw = localStorage.getItem(DURATION_KEY);
  const duration = durationRaw ? Number(durationRaw) : 30;
  return { visible, duration: Number.isFinite(duration) ? duration : 30 };
};

export const setStoredDuration = (seconds: number) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(DURATION_KEY, String(seconds));
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { duration: seconds } })
  );
};

export const setStoredVisible = (visible: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(VISIBILITY_KEY, String(visible));
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { visible } })
  );
};

export const useBalanceVisibility = () => {
  const [visible, setVisible] = useState(() => getStoredVisibility().visible);
  const [duration, setDuration] = useState(() => getStoredVisibility().duration);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      return;
    }
    if (duration > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setStoredVisible(false);
        setVisible(false);
      }, duration * 1000);
    }
  }, [visible, duration]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (typeof detail.visible === "boolean") setVisible(detail.visible);
      if (typeof detail.duration === "number") setDuration(detail.duration);
    };
    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
  }, []);

  return {
    visible,
    duration,
    setDuration: (seconds: number) => {
      setDuration(seconds);
      setStoredDuration(seconds);
    },
    show: () => {
      setVisible(true);
      setStoredVisible(true);
    },
    hide: () => {
      setVisible(false);
      setStoredVisible(false);
    },
    toggle: () => {
      const next = !visible;
      setVisible(next);
      setStoredVisible(next);
    },
  };
};
