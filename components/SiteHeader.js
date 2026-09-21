import Link from 'next/link'
import { signOut } from '@/app/actions'
import '@/app/landing.css'

// Same header as the landing page: crest + university name on the left,
// Home / Profile / Log Out on the right.  `active` can be 'home' or 'profile'.
export default function SiteHeader({ active }) {
  return (
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
          <Link href="/" className={active === 'home' ? 'lp-nav-link active' : 'lp-nav-link'}>Home</Link>
          <Link href="/profile" className={active === 'profile' ? 'lp-nav-link active' : 'lp-nav-link'}>Profile</Link>
          <form action={signOut}>
            <button type="submit" className="lp-logout">Log Out</button>
          </form>
        </nav>
      </div>
    </header>
  )
}
