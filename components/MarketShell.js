"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import Marketplace from "@/components/Marketplace"

/* ---------- small inline icon set (no extra dependency) ---------- */
const ICONS = {
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  store: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  chevron: <polyline points="9 18 15 12 9 6" />,
  back: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
}

function Icon({ name, size = 22 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

/* ---------- Home view: two action cards + recent listings ---------- */
function MarketHome({ onBrowse }) {
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function loadRecent() {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          listing_id,
          title,
          price,
          condition,
          subcategories ( categories ( category_name ) ),
          listing_images ( image_url, is_primary )
        `
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4)

      if (error) console.error("Error loading recent listings:", error)

      if (!cancelled) {
        setRecent(data || [])
        setLoading(false)
      }
    }

    loadRecent()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <div className="ms-actions">
        <button type="button" className="ms-action ms-action-browse" onClick={onBrowse}>
          <span className="ms-action-icon">
            <Icon name="store" size={40} />
          </span>
          <span className="ms-action-text">
            <strong>Browse Marketplace</strong>
            <span>Find what you need</span>
          </span>
          <Icon name="chevron" size={26} />
        </button>

        {/* Same .sell-button as the marketplace view, just enlarged */}
        <Link href="/market/create" className="sell-button sell-button--large">
          <span className="ms-action-icon">
            <Icon name="plus" size={40} />
          </span>
          <span className="ms-action-text">
            <strong>Sell an item</strong>
            <span>List something you no longer need</span>
          </span>
          <Icon name="chevron" size={26} />
        </Link>
      </div>

      <section className="ms-recent">
        <div className="ms-section-head">
          <h2>Recent listings</h2>
          <button type="button" className="ms-link-button" onClick={onBrowse}>
            View all
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading listings...</div>
        ) : recent.length === 0 ? (
          <div className="empty-state">
            <h3>No listings yet</h3>
            <p>Be the first to list something for other students.</p>
          </div>
        ) : (
          <div className="listing-grid">
            {recent.map((listing) => {
              const image =
                listing.listing_images?.find((i) => i.is_primary) ||
                listing.listing_images?.[0]
              const category =
                listing.subcategories?.categories?.category_name || "Other"

              return (
                <article className="listing-card" key={listing.listing_id}>
                  <Link href={`/market/${listing.listing_id}`} className="recent-link">
                    <div className="listing-image">
                      {image ? (
                        <img src={image.image_url} alt={listing.title} />
                      ) : (
                        <div className="no-image">📷</div>
                      )}
                    </div>
                    <div className="recent-body">
                      <h3>{listing.title}</h3>
                      <strong>R{Number(listing.price).toFixed(2)}</strong>
                      <span>
                        {listing.condition || "Used"} · {category}
                      </span>
                    </div>
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Shell: header + sidebar + switchable content ---------- */
export default function MarketShell({ displayName }) {
  const [view, setView] = useState("home") // "home" | "market"
  const [search, setSearch] = useState("")

  const initial = displayName?.trim()?.[0]?.toUpperCase() || "?"

  function showView(next) {
    setView(next)
    if (next === "home") setSearch("")
  }

  function handleSearch(e) {
    const value = e.target.value
    setSearch(value)
    // Searching from Home jumps straight to the full marketplace results
    if (value.trim() && view !== "market") setView("market")
  }

  return (
    <div className="market-shell">
      <header className="ms-header">
        <Link href="/" className="ms-brand">
          <Icon name="cap" size={34} />
          <span className="ms-brand-text">Campus Connect</span>
        </Link>

        <div className="ms-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="Search marketplace"
            placeholder="Search marketplace..."
            value={search}
            onChange={handleSearch}
          />
        </div>

        <div className="ms-user">
          <span className="ms-avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="ms-user-name">{displayName}</span>
        </div>
      </header>

      <div className="ms-body">
        <nav className="ms-sidebar" aria-label="Marketplace navigation">
          <Link href="/" className="ms-back">
            <Icon name="back" size={16} />
            All services
          </Link>

          <button
            type="button"
            className={view === "home" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "home" ? "page" : undefined}
            onClick={() => showView("home")}
          >
            <Icon name="home" />
            <span>Home</span>
          </button>

          <button
            type="button"
            className={view === "market" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "market" ? "page" : undefined}
            onClick={() => showView("market")}
          >
            <Icon name="store" />
            <span>Marketplace</span>
          </button>

          {/* Not built yet: shown but not clickable, so nobody lands on a 404 */}
          <span className="ms-nav ms-nav-disabled" aria-disabled="true">
            <Icon name="bell" />
            <span>Notifications</span>
            <em className="ms-soon">Soon</em>
          </span>

          <span className="ms-nav ms-nav-disabled" aria-disabled="true">
            <Icon name="message" />
            <span>Messages</span>
            <em className="ms-soon">Soon</em>
          </span>

          <Link href="/profile" className="ms-nav">
            <Icon name="user" />
            <span>Profile</span>
          </Link>
        </nav>

        <main className="ms-main">
          {view === "home" ? (
            <MarketHome onBrowse={() => showView("market")} />
          ) : (
            <Marketplace search={search} />
          )}
        </main>
      </div>
    </div>
  )
}