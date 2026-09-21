import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Stars from '@/components/Stars'
import Icon from '@/components/Icon'
import '@/app/market/market-pages.css'

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export default async function SellerPage({ params }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: seller }, { data: rating }, { data: listings }] = await Promise.all([
    supabase
      .from('public_profiles')
      .select('id, full_name, profile_image_url, created_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('seller_ratings')
      .select('avg_rating, review_count')
      .eq('seller_id', params.id)
      .maybeSingle(),
    supabase
      .from('listings')
      .select(`
        listing_id, title, description, condition, price, rent_price_monthly, created_at,
        subcategories ( sub_category_name, categories ( category_name ) ),
        listing_images ( image_url, is_primary )
      `)
      .eq('seller_id', params.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  if (!seller) notFound()

  // Arrange this seller's listings by category ("Other" always last)
  const groups = {}
  for (const listing of listings || []) {
    const name = listing.subcategories?.categories?.category_name || 'Other'
    if (!groups[name]) groups[name] = []
    groups[name].push(listing)
  }
  const categoryNames = Object.keys(groups).sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b)
  })

  const isMe = user.id === seller.id
  const sellerName = seller.full_name || 'Campus seller'
  const joined = new Date(seller.created_at).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
  const avg = rating ? Number(rating.avg_rating) : null
  const count = rating ? Number(rating.review_count) : 0
  const total = listings?.length || 0

  return (
    <div className="lp">
      <SiteHeader />

      <main className="ld-main">
        <div className="lp-container">
          <div className="ld-content" style={{ maxWidth: 'none' }}>
            <nav className="ld-breadcrumb">
              <Link href="/market">Marketplace</Link>
              <span>›</span>
              <span>{isMe ? 'My listings' : sellerName}</span>
            </nav>

            <section className="sp-hero">
              {seller.profile_image_url ? (
                <img src={seller.profile_image_url} alt={sellerName} className="ld-avatar" />
              ) : (
                <span className="ld-avatar ld-avatar-default"><Icon name="user" size={38} /></span>
              )}
              <div>
                <h1>{isMe ? `${sellerName} (you)` : sellerName}</h1>
                <div className="sp-meta">
                  {avg !== null ? (
                    <span><Stars value={avg} size={16} /> <b>{avg.toFixed(1)}</b> ({count} review{count === 1 ? '' : 's'})</span>
                  ) : (
                    <span>No reviews yet</span>
                  )}
                  <span><Icon name="pin" size={16} /> University of Fort Hare</span>
                  <span><Icon name="calendar" size={16} /> Joined {joined}</span>
                  <span><Icon name="tag" size={16} /> {total} active listing{total === 1 ? '' : 's'}</span>
                </div>
              </div>
            </section>

            {total === 0 ? (
              <div className="sp-empty">No active listings right now.</div>
            ) : (
              <>
                <div className="sp-chips">
                  {categoryNames.map((name) => (
                    <a key={name} href={`#cat-${slugify(name)}`} className="sp-chip">
                      {name}<span>{groups[name].length}</span>
                    </a>
                  ))}
                </div>

                {categoryNames.map((name) => (
                  <section key={name} id={`cat-${slugify(name)}`} className="sp-group">
                    <h2>{name}<span>{groups[name].length} item{groups[name].length === 1 ? '' : 's'}</span></h2>

                    <div className="listing-grid">
                      {groups[name].map((listing) => {
                        const image =
                          listing.listing_images?.find((i) => i.is_primary) || listing.listing_images?.[0]
                        return (
                          <article className="listing-card" key={listing.listing_id}>
                            <div className="listing-image">
                              {image ? (
                                <img src={image.image_url} alt={listing.title} />
                              ) : (
                                <div className="no-image">📷<span>No image</span></div>
                              )}
                            </div>
                            <div className="listing-content">
                              <h3>{listing.title}</h3>
                              <p className="listing-description">
                                {listing.description || 'No description provided.'}
                              </p>
                              <div className="listing-bottom">
                                <div className="price-area">
                                  <strong>R{Number(listing.price).toFixed(2)}</strong>
                                  <span>{listing.condition || 'Used'}</span>
                                  {listing.rent_price_monthly && (
                                    <span className="rent-tag">
                                      Rent R{Number(listing.rent_price_monthly).toFixed(0)}/mo
                                    </span>
                                  )}
                                </div>
                                <Link href={`/market/${listing.listing_id}`} className="view-button">View</Link>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
