import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketHeader from '@/components/MarketHeader'
import SiteFooter from '@/components/SiteFooter'
import ImageGallery from '@/components/ImageGallery'
import ListingActions from '@/components/ListingActions'
import Stars from '@/components/Stars'
import Icon from '@/components/Icon'
import '@/app/market/market-pages.css'

export default async function ListingPage({ params, searchParams }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Where this listing was opened from — so Back returns there with its
  // filters and scroll position intact, instead of always going to Home.
  const backHref = searchParams?.from || '/market'
  // This page's own URL, so a link further in (to the seller) can find its way back here.
  const selfUrl = `/market/${params.id}${searchParams?.from ? `?from=${encodeURIComponent(searchParams.from)}` : ''}`

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email

  const { data: listing } = await supabase
    .from('listings')
    .select(`
      *,
      subcategories (
        sub_category_name,
        rent_eligible,
        rent_min_months,
        categories ( category_name )
      ),
      listing_images ( image_id, image_url, is_primary )
    `)
    .eq('listing_id', params.id)
    .maybeSingle()

  // Also covers invalid ids: the query errors and returns null
  if (!listing) notFound()

  // Seller details + the seller's overall rating (reviews are for the SELLER, not the item)
  const [{ data: seller }, { data: rating }] = await Promise.all([
    supabase
      .from('public_profiles')
      .select('id, full_name, profile_image_url, created_at')
      .eq('id', listing.seller_id)
      .maybeSingle(),
    supabase
      .from('seller_ratings')
      .select('avg_rating, review_count')
      .eq('seller_id', listing.seller_id)
      .maybeSingle(),
  ])

  const images = [...(listing.listing_images || [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((img) => img.image_url)

  const price = Number(listing.price)
  const priceText = price.toLocaleString('en-ZA', {
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  })

  const categoryName = listing.subcategories?.categories?.category_name
  const subCategoryName = listing.subcategories?.sub_category_name
  const isAvailable = listing.status === 'active'
  const isOwner = user.id === listing.seller_id
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  const isAdmin = roleRow?.role === 'admin'
  const sellerName = seller?.full_name || 'Campus seller'
  const joined = seller?.created_at
    ? new Date(seller.created_at).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
    : null
  const avg = rating ? Number(rating.avg_rating) : null
  const count = rating ? Number(rating.review_count) : 0

  const badgeText = isAvailable
    ? 'In Stock'
    : listing.status === 'sold'
      ? 'Sold'
      : listing.status === 'rented'
        ? 'Rented out'
        : 'Unavailable'

  return (
    <div className="lp market-shell">
      <MarketHeader displayName={displayName} backHref={backHref} backLabel="Back" />

      <main className="ld-main">
        <div className="lp-container">
          <div className="ld-content">
            <nav className="ld-breadcrumb">
              <Link href={backHref}>Marketplace</Link>
              {categoryName && <><span>›</span><span>{categoryName}</span></>}
              {subCategoryName && <><span>›</span><span>{subCategoryName}</span></>}
            </nav>

            <section className="ld-top">
              <ImageGallery images={images} title={listing.title} />

              <div className="ld-info">
                <h1>{listing.title}</h1>
                <p className="ld-price">R{priceText}</p>

                <span className={isAvailable ? 'ld-badge ok' : 'ld-badge off'}>
                  {isAvailable && <Icon name="check" size={16} />}
                  {badgeText}
                </span>

                <ListingActions
                  listing={listing}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  messageHref={`/market/messages?listing=${listing.listing_id}&with=${listing.seller_id}&from=${encodeURIComponent(selfUrl)}`}
            
                />
              </div>
            </section>

            <section className="ld-two">
              <div className="ld-card">
                <h2>Description</h2>
                <p className="ld-desc">{listing.description || 'No description provided.'}</p>

                <div className="ld-meta">
                  <div>
                    <Icon name="tag" size={22} />
                    <div><small>Condition</small><p>{listing.condition || 'Used'}</p></div>
                  </div>
                  <div>
                    <Icon name="folder" size={22} />
                    <div><small>Category</small><p>{categoryName || 'Other'}</p></div>
                  </div>
                </div>
              </div>

              <div className="ld-card">
                <h2>Seller Information</h2>
                <div className="ld-seller">
                  {seller?.profile_image_url ? (
                    <img src={seller.profile_image_url} alt={sellerName} className="ld-avatar" />
                  ) : (
                    <span className="ld-avatar ld-avatar-default"><Icon name="user" size={38} /></span>
                  )}
                  <div>
                    <strong>{sellerName}</strong>
                    {avg !== null ? (
                      <div className="ld-seller-rating">
                        <Stars value={avg} size={16} />
                        <b>{avg.toFixed(1)}</b>
                        <span>({count} review{count === 1 ? '' : 's'})</span>
                      </div>
                    ) : (
                      <div className="ld-seller-rating muted">No reviews yet</div>
                    )}
                  </div>
                </div>

                <p className="ld-seller-line"><Icon name="pin" size={18} /> University of Fort Hare</p>
                {joined && <p className="ld-seller-line"><Icon name="calendar" size={18} /> Joined: {joined}</p>}

                <Link href={`/market/seller/${listing.seller_id}?from=${encodeURIComponent(selfUrl)}`} className="ld-btn outline ld-btn-sm">
                  View Seller Profile
                </Link>
                <p className="ld-note">
                  Ratings are for the seller&apos;s service, left by buyers after a completed purchase.
                </p>
              </div>
            </section>

            <section className={isAvailable ? 'ld-available' : 'ld-available off'}>
              <span className="ld-available-icon"><Icon name="check" size={26} /></span>
              <div>
                <h3>{isAvailable ? 'Available' : 'No longer available'}</h3>
                <p>
                  {isAvailable
                    ? 'This item is currently in stock and ready for pickup or delivery (where available).'
                    : 'This item has been sold, is rented out, or is not currently available.'}
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
