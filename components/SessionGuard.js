'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000 // 10 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

export default function SessionGuard() {
  const supabase = createClient()
  const router = useRouter()
  const timerRef = useRef(null)

  useEffect(() => {
    // Tab-close detection: sessionStorage survives a refresh but is wiped
    // when the tab/window is actually closed. Missing flag on mount = this
    // tab was just (re)opened after being closed -> force logout.
    const isFreshTab = !sessionStorage.getItem('cc_session_open')

    if (isFreshTab) {
      sessionStorage.setItem('cc_session_open', 'true')
      supabase.auth.signOut().then(() => {
        router.replace('/login')
      })
      return
    }

    // Inactivity timeout
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        await supabase.auth.signOut()
        router.replace('/login?message=' + encodeURIComponent('Logged out due to inactivity'))
      }, INACTIVITY_LIMIT_MS)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return null
}