import Link from 'next/link'
import { signOut } from './actions'
import './landing.css'

function MarketplaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function LaundryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <line x1="7" y1="6" x2="8" y2="6" />
      <line x1="11" y1="6" x2="12" y2="6" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <div className="lp-brand">
            <img src="/crest.png" alt="University of Fort Hare crest" className="lp-crest" /> 
            <div>
              <p className="lp-brand-name">University of Fort Hare</p>
              <p className="lp-brand-tagline">TOGETHER IN EXCELLENCE</p>
            </div>
          </div>

          <nav className="lp-nav">
            <Link href="/" className="lp-nav-link active">Home</Link>
            <Link href="/profile" className="lp-nav-link">Profile</Link>
            <form action={signOut}>
              <button type="submit" className="lp-logout">Log Out</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="lp-main">
        <div className="lp-container lp-hero">
          <div className="lp-hero-text">
            <h1>Welcome to Campus Connect</h1>
            <p>
              Find great deals on laptops, fridges and electronics from fellow students
              and trusted campus traders. Buy, sell and upgrade your student essentials,
              all in one place.
            </p>
          </div>

          <div className="lp-cards">
            <Link href="/market" className="lp-card">
              <span className="lp-card-icon"><MarketplaceIcon /></span>
              <span className="lp-card-title">Marketplace</span>
              <span className="lp-card-sub">Buy &amp; sell student essentials</span>
            </Link>

            <Link href="/laundry" className="lp-card">
              <span className="lp-card-icon"><LaundryIcon /></span>
              <span className="lp-card-title">Laundry Booking</span>
              <span className="lp-card-sub">Book a campus laundry slot</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span>&copy; University of Fort Hare. All rights reserved.</span>
          <span className="lp-powered"><i className="lp-dot" /> Powered by Netlify</span>
        </div>
      </footer>
    </div>
  )
}