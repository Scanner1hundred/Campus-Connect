import Link from "next/link"
import "@/app/market/header.css"

// Same navy header as MarketShell, for standalone market pages (sell form, My Rentals, admin).
// Pass showAdminToggle to render a small "Switch to student view" link —
// use on any admin page so an admin account can jump back to /market.
export default function MarketHeader({ displayName = "", backHref = "/market", backLabel = "Back to marketplace", showAdminToggle = false, studentHref = "/market" }) {
  const initial = (displayName || "?").trim().charAt(0).toUpperCase()

  return (
    <header className="ms-header">
      <Link href="/" className="ms-brand">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="12" r="7" />
          <circle cx="15" cy="12" r="7" />
        </svg>
        <span className="ms-brand-text">Campus Connect</span>
      </Link>

      <Link href={backHref} className="mh-back">&larr; {backLabel}</Link>

      {showAdminToggle && (
        <Link href={studentHref} className="mh-view-toggle">Switch to student view</Link>
      )}

      {displayName && (
        <Link href="/profile" className="ms-user">
          <span className="ms-avatar" aria-hidden="true">{initial}</span>
          <span className="ms-user-name">{displayName}</span>
        </Link>
      )}
    </header>
  )
}
