"use client"

import { useEffect } from "react"

/**
 * Remembers the scroll position for a given key (normally the current
 * pathname + query string) in sessionStorage, and restores it once `ready`
 * is true (e.g. once the list it belongs to has finished loading).
 *
 * Session-scoped on purpose: it should forget once the tab closes, same as
 * everything else under the "cc:" prefix.
 */
export function useScrollRestore(key, ready = true) {
  useEffect(() => {
    if (!ready || !key) return

    const saved = sessionStorage.getItem(`cc:scroll:${key}`)
    if (saved) {
      const y = Number(saved)
      requestAnimationFrame(() => window.scrollTo(0, y))
    }

    function onScroll() {
      sessionStorage.setItem(`cc:scroll:${key}`, String(window.scrollY))
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])
}
