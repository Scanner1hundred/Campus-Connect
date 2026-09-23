"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useScrollRestore } from "@/lib/useScrollRestore"
import Marketplace from "@/components/Marketplace"
import MyListings from "@/components/MyListings"
import Wishlist from "@/components/Wishlist"

const VALID_VIEWS = ["home", "market", "myListings", "wishlist"]

/* ---------- small inline icon set (no extra dependency) ---------- */
const ICONS = {
  logo: (
    <>
      <circle cx="9" cy="12" r="7" />
      <circle cx="15" cy="12" r="7" />
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
  listings: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z" />
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
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
function MarketHome({ browseHref, selfUrl, isAdmin }) {
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useScrollRestore(selfUrl, !loading)

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
        <Link href={browseHref} className="ms-action ms-action-browse">
          <span className="ms-action-icon">
            <Icon name="store" size={40} />
          </span>
          <span className="ms-action-text">
            <strong>Browse Marketplace</strong>
            <span>Find what you need</span>
          </span>
          <Icon name="chevron" size={26} />
        </Link>

        {/* Same .sell-button as the marketplace view, just enlarged */}
        {!isAdmin && (
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
         )}
      </div>

      <section className="ms-recent">
        <div className="ms-section-head">
          <h2>Recent listings</h2>
          <Link href={browseHref} className="ms-link-button">
            View all
          </Link>
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
                  <Link
                    href={`/market/${listing.listing_id}?from=${encodeURIComponent(selfUrl)}`}
                    className="recent-link"
                  >
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The tab, search text and (inside Marketplace) category all live in the
  // URL now, not component state — so leaving to a listing and coming back
  // (or hitting the browser Back button) lands exactly where you were.
  const rawView = searchParams.get("view") || "home"
  const view = VALID_VIEWS.includes(rawView) ? rawView : "home"
  const search = searchParams.get("q") || ""

  // The current /market URL, used as the "from" a listing link remembers
  // so its own Back button returns here — filters and all.
  const qs = searchParams.toString()
  const selfUrl = qs ? `${pathname}?${qs}` : pathname

  const [userId, setUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myListingsCount, setMyListingsCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)

  const initial = displayName?.trim()?.[0]?.toUpperCase() || "?"

  useEffect(() => {
    const supabase = createClient()

    async function loadUserAndCounts() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)

      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      setIsAdmin(roleRow?.role === 'admin')

      const [{ count: listingsCount }, { count: favoritesCount }] = await Promise.all([
        supabase
          .from("listings")
          .select("listing_id", { count: "exact", head: true })
          .eq("seller_id", user.id),
        supabase
          .from("favorites")
          .select("favorite_id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ])

      setMyListingsCount(listingsCount || 0)
      setWishlistCount(favoritesCount || 0)
    }

    loadUserAndCounts()
  }, [])

  function hrefForView(next) {
    return next === "home" ? "/market" : `/market?view=${next}`
  }

  function handleSearch(e) {
    const value = e.target.value
    const next = new URLSearchParams(searchParams)
    if (value) next.set("q", value)
    else next.delete("q")
    // Searching from anywhere jumps straight to the full marketplace results
    next.set("view", "market")
    // A fresh search starts from "all categories" so results aren't hidden
    // behind a category picked on a previous visit
    if (view !== "market") next.delete("cat")
    router.replace(`/market?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="market-shell">
      <header className="ms-header">
        <Link href="/" className="ms-brand">
          <Icon name="logo" size={30} />
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

        <Link href={`/profile?from=${encodeURIComponent(pathname)}`} className="ms-user">
          <span className="ms-avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="ms-user-name">{displayName}</span>
        </Link>
      </header>

      <div className="ms-body">
        <nav className="ms-sidebar" aria-label="Marketplace navigation">
          <Link href="/" className="ms-back">
            <Icon name="back" size={16} />
            All services
          </Link>

          <Link
            href={hrefForView("home")}
            className={view === "home" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "home" ? "page" : undefined}
          >
            <Icon name="home" />
            <span>Home</span>
          </Link>

          <Link
            href={hrefForView("market")}
            className={view === "market" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "market" ? "page" : undefined}
          >
            <Icon name="store" />
            <span>Marketplace</span>
          </Link>

          <Link
            href={hrefForView("myListings")}
            className={view === "myListings" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "myListings" ? "page" : undefined}
          >
            <Icon name="listings" />
            <span>My Listings</span>
            {myListingsCount > 0 && <em className="ms-count">{myListingsCount}</em>}
          </Link>

          <Link
            href={hrefForView("wishlist")}
            className={view === "wishlist" ? "ms-nav active" : "ms-nav"}
            aria-current={view === "wishlist" ? "page" : undefined}
          >
            <Icon name="heart" />
            <span>Wishlist</span>
            {wishlistCount > 0 && <em className="ms-count">{wishlistCount}</em>}
          </Link>
           <Link href="/market/rentals" className="ms-nav">
           <Icon name="listings" />
           <span>My Rentals</span>
           </Link>



          
           <Link href="/market/notifications" className="ms-nav">
             <Icon name="bell" />
             <span>Notifications</span>
           </Link>

           <Link href="/market/messages" className="ms-nav">
             <Icon name="message" />
             <span>Messages</span>
           </Link>
           <Link href="/market/messages" className="ms-nav">
             <Icon name="message" />
             <span>Messages</span>
           </Link>

           {isAdmin && (
             <Link href="/market/admin" className="ms-nav">
               <Icon name="bell" />
               <span>Admin view</span>
             </Link>
           )}
           </nav>

        <main className="ms-main">
          {view === "home" && (
            <MarketHome browseHref={hrefForView("market")} selfUrl={hrefForView("home")} isAdmin={isAdmin} />
          )}
          {view === "market" && <Marketplace selfUrl={selfUrl} />}
          {view === "myListings" && (
            <MyListings
              userId={userId}
              onCountChange={setMyListingsCount}
              selfUrl={hrefForView("myListings")}
              isAdmin={isAdmin}
            />
          )}
          {view === "wishlist" && (
            <Wishlist
              userId={userId}
              onCountChange={setWishlistCount}
              selfUrl={hrefForView("wishlist")}
            />
          )}
        </main>
      </div>
    </div>
  )
}