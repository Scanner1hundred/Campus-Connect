import '@/app/landing.css'

export default function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <span>&copy; University of Fort Hare. All rights reserved.</span>
        <span className="lp-powered"><i className="lp-dot" /> Powered by Netlify</span>
      </div>
    </footer>
  )
}
