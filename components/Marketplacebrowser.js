"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function MarketplaceBrowser() {
  const supabase = createClient()

  const [user, setUser] = useState(null)

  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [categories, setCategories] = useState([])
  const [favorites, setFavorites] = useState([])

  const [activeTab, setActiveTab] = useState("browse")

  const [selectedCategory, setSelectedCategory] =
    useState("all")

  const [searchInput, setSearchInput] =
    useState("")

  const [search, setSearch] =
    useState("")

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  useEffect(() => {
    loadMarketplace()
  }, [])

  async function loadMarketplace() {
    setLoading(true)
    setError("")

    try {
      /*
       * --------------------------------
       * CURRENT USER
       * --------------------------------
       */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error(userError)
      }

      setUser(user || null)

      /*
       * --------------------------------
       * CATEGORIES
       * --------------------------------
       */

      const {
        data: categoryData,
        error: categoryError,
      } = await supabase
        .from("categories")
        .select("*")
        .order("category_name")

      if (categoryError) {
        console.error(categoryError)
      }

      setCategories(categoryData || [])

      /*
       * --------------------------------
       * ALL ACTIVE LISTINGS
       * --------------------------------
       */

      const {
        data: listingData,
        error: listingError,
      } = await supabase
        .from("listings")
        .select(`
          *,
          subcategories (
            sub_category_id,
            sub_category_name,
            categories (
              category_id,
              category_name
            )
          ),
          listing_images (
            image_id,
            image_url,
            is_primary
          )
        `)
        .eq("status", "active")
        .order("created_at", {
          ascending: false,
        })

      if (listingError) {
        console.error(listingError)

        setError(
          "Unable to load marketplace listings."
        )
      }

      setListings(listingData || [])

      /*
       * --------------------------------
       * MY LISTINGS
       * --------------------------------
       */

      if (user) {
        const {
          data: myListingData,
          error: myListingError,
        } = await supabase
          .from("listings")
          .select(`
            *,
            subcategories (
              sub_category_id,
              sub_category_name,
              categories (
                category_id,
                category_name
              )
            ),
            listing_images (
              image_id,
              image_url,
              is_primary
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })

        if (myListingError) {
          console.error(
            "My listings error:",
            myListingError
          )
        }

        setMyListings(
          myListingData || []
        )

        /*
         * --------------------------------
         * WISHLIST
         * --------------------------------
         */

        const {
          data: favoriteData,
          error: favoriteError,
        } = await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)

        if (favoriteError) {
          console.error(
            "Favorites error:",
            favoriteError
          )
        }

        const favoriteIds =
          favoriteData?.map(
            (item) => item.listing_id
          ) || []

        setFavorites(favoriteIds)
      }
    } catch (err) {
      console.error(err)

      setError(
        "Something went wrong while loading the marketplace."
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * --------------------------------
   * GET CATEGORY
   * --------------------------------
   */

  function getCategory(listing) {
    const subcategory =
      Array.isArray(
        listing.subcategories
      )
        ? listing.subcategories[0]
        : listing.subcategories

    const category =
      Array.isArray(
        subcategory?.categories
      )
        ? subcategory.categories[0]
        : subcategory?.categories

    return category
  }

  /*
   * --------------------------------
   * SEARCH
   * --------------------------------
   */

  function handleSearch(event) {
    event.preventDefault()

    setSearch(
      searchInput.trim()
    )
  }

  function clearSearch() {
    setSearchInput("")
    setSearch("")
  }

  /*
   * --------------------------------
   * FAVORITE / UNFAVORITE
   * --------------------------------
   */

  async function toggleFavorite(listingId) {
    if (!user) {
      alert(
        "Please login to use your wishlist."
      )
      return
    }

    const isFavorite =
      favorites.includes(listingId)

    try {
      if (isFavorite) {
        const { error } =
          await supabase
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq(
              "listing_id",
              listingId
            )

        if (error) throw error

        setFavorites(
          (current) =>
            current.filter(
              (id) =>
                id !== listingId
            )
        )
      } else {
        const { error } =
          await supabase
            .from("favorites")
            .insert({
              user_id: user.id,
              listing_id:
                listingId,
            })

        if (error) throw error

        setFavorites(
          (current) => [
            ...current,
            listingId,
          ]
        )
      }
    } catch (err) {
      console.error(err)

      alert(
        "Unable to update wishlist."
      )
    }
  }

  /*
   * --------------------------------
   * FILTER BROWSE LISTINGS
   * --------------------------------
   */

  const filteredListings =
    useMemo(() => {
      const searchText =
        search
          .toLowerCase()
          .trim()

      return listings.filter(
        (listing) => {
          const category =
            getCategory(
              listing
            )

          const title =
            listing.title
              ?.toLowerCase() ||
            ""

          const description =
            listing.description
              ?.toLowerCase() ||
            ""

          const matchesSearch =
            !searchText ||
            title.includes(
              searchText
            ) ||
            description.includes(
              searchText
            )

          const matchesCategory =
            selectedCategory ===
              "all" ||
            category?.category_id ===
              selectedCategory

          return (
            matchesSearch &&
            matchesCategory
          )
        }
      )
    }, [
      listings,
      search,
      selectedCategory,
    ])

  /*
   * --------------------------------
   * WISHLIST ITEMS
   * --------------------------------
   */

  const wishlistListings =
    listings.filter(
      (listing) =>
        favorites.includes(
          listing.listing_id
        )
    )

  /*
   * --------------------------------
   * LISTING CARD
   * --------------------------------
   */

  function ListingCard({
    listing,
    showStatus = false,
  }) {
    const category =
      getCategory(listing)

    const primaryImage =
      listing.listing_images?.find(
        (image) =>
          image.is_primary
      ) ||
      listing.listing_images?.[0]

    const isFavorite =
      favorites.includes(
        listing.listing_id
      )

    return (
      <article className="browser-listing-card">

        {/* IMAGE */}

        <div className="browser-listing-image">

          {primaryImage?.image_url ? (
            <img
              src={
                primaryImage.image_url
              }
              alt={
                listing.title
              }
            />
          ) : (
            <div className="browser-no-image">
              <span>📷</span>
              <p>No image</p>
            </div>
          )}

          {/* WISHLIST BUTTON */}

          <button
            type="button"
            className="browser-favorite"
            onClick={() =>
              toggleFavorite(
                listing.listing_id
              )
            }
          >
            {isFavorite
              ? "❤️"
              : "♡"}
          </button>

        </div>

        {/* DETAILS */}

        <div className="browser-listing-content">

          <div className="browser-listing-top">

            <span className="browser-category">
              {category?.category_name ||
                "Other"}
            </span>

            {showStatus && (
              <span
                className={
                  listing.status ===
                  "active"
                    ? "status-active"
                    : "status-other"
                }
              >
                {listing.status}
              </span>
            )}

          </div>

          <h3>
            {listing.title}
          </h3>

          <p className="browser-description">
            {listing.description ||
              "No description provided."}
          </p>

          <div className="browser-card-footer">

            <div className="browser-price">

              <strong>
                R
                {Number(
                  listing.price ||
                    0
                ).toFixed(2)}
              </strong>

              <span>
                {listing.condition ||
                  "Used"}
              </span>

            </div>

            <Link
              href={`/market/${listing.listing_id}`}
              className="browser-view-button"
            >
              View
            </Link>

          </div>

        </div>

      </article>
    )
  }

  return (
    <main className="market-browser">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="market-browser-header">

        <div>

          <Link
            href="/market"
            className="back-to-market"
          >
            ← Marketplace
          </Link>

          <p className="eyebrow">
            CAMPUS CONNECT MARKETPLACE
          </p>

          <h1>
            Browse Marketplace
          </h1>

          <p>
            Find items being sold by
            students on campus.
          </p>

        </div>

        <Link
          href="/market/create"
          className="browser-sell-button"
        >
          + Sell an item
        </Link>

      </header>

      {/* =================================================
          MAIN NAVIGATION
      ================================================= */}

      <nav className="market-browser-tabs">

        <button
          type="button"
          className={
            activeTab === "browse"
              ? "browser-tab active"
              : "browser-tab"
          }
          onClick={() =>
            setActiveTab("browse")
          }
        >
          🛍️
          <span>Browse Items</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "my-listings"
              ? "browser-tab active"
              : "browser-tab"
          }
          onClick={() =>
            setActiveTab(
              "my-listings"
            )
          }
        >
          📋
          <span>My Listings</span>

          <small>
            {myListings.length}
          </small>
        </button>

        <button
          type="button"
          className={
            activeTab === "wishlist"
              ? "browser-tab active"
              : "browser-tab"
          }
          onClick={() =>
            setActiveTab(
              "wishlist"
            )
          }
        >
          ❤️
          <span>Wishlist</span>

          <small>
            {favorites.length}
          </small>
        </button>

        <button
          type="button"
          className={
            activeTab === "categories"
              ? "browser-tab active"
              : "browser-tab"
          }
          onClick={() =>
            setActiveTab(
              "categories"
            )
          }
        >
          📦
          <span>Categories</span>
        </button>

      </nav>

      {/* =================================================
          SEARCH
      ================================================= */}

      {activeTab ===
        "browse" && (
        <section className="browser-search">

          <form
            onSubmit={
              handleSearch
            }
          >

            <div className="browser-search-input">

              <span>
                🔍
              </span>

              <input
                type="text"
                value={
                  searchInput
                }
                onChange={(event) =>
                  setSearchInput(
                    event.target
                      .value
                  )
                }
                placeholder="Search for textbooks, laptops, clothes..."
              />

              {searchInput && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                >
                  ×
                </button>
              )}

            </div>

            <button
              type="submit"
              className="browser-search-button"
            >
              Search
            </button>

          </form>

        </section>
      )}

      {/* =================================================
          CATEGORY FILTERS
      ================================================= */}

      {activeTab ===
        "browse" && (
        <section className="browser-category-filter">

          <div className="browser-section-heading">

            <div>
              <p className="eyebrow">
                SHOP BY
              </p>

              <h2>
                Categories
              </h2>
            </div>

          </div>

          <div className="browser-category-list">

            <button
              type="button"
              className={
                selectedCategory ===
                "all"
                  ? "browser-category active"
                  : "browser-category"
              }
              onClick={() =>
                setSelectedCategory(
                  "all"
                )
              }
            >
              🛍️ All
            </button>

            {categories.map(
              (category) => (
                <button
                  type="button"
                  key={
                    category.category_id
                  }
                  className={
                    selectedCategory ===
                    category.category_id
                      ? "browser-category active"
                      : "browser-category"
                  }
                  onClick={() =>
                    setSelectedCategory(
                      category.category_id
                    )
                  }
                >
                  📦{" "}
                  {
                    category.category_name
                  }
                </button>
              )
            )}

          </div>

        </section>
      )}

      {/* =================================================
          CONTENT
      ================================================= */}

      <section className="market-browser-content">

        {/* LOADING */}

        {loading && (
          <div className="browser-loading">
            <div className="loading-spinner"></div>

            <p>
              Loading marketplace...
            </p>
          </div>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <div className="browser-empty">
              <div>⚠️</div>

              <h3>
                Something went wrong
              </h3>

              <p>
                {error}
              </p>

              <button
                onClick={
                  loadMarketplace
                }
              >
                Try again
              </button>
            </div>
          )}

        {/* =================================================
            BROWSE
        ================================================= */}

        {!loading &&
          !error &&
          activeTab ===
            "browse" && (
            <>
              <div className="browser-section-heading">

                <div>
                  <p className="eyebrow">
                    DISCOVER
                  </p>

                  <h2>
                    Items for sale
                  </h2>
                </div>

                <span>
                  {
                    filteredListings.length
                  } items
                </span>

              </div>

              {filteredListings.length ===
              0 ? (
                <div className="browser-empty">

                  <div>
                    🔍
                  </div>

                  <h3>
                    No items found
                  </h3>

                  <p>
                    Try another search
                    or category.
                  </p>

                </div>
              ) : (
                <div className="browser-listing-grid">

                  {filteredListings.map(
                    (listing) => (
                      <ListingCard
                        key={
                          listing.listing_id
                        }
                        listing={
                          listing
                        }
                      />
                    )
                  )}

                </div>
              )}
            </>
          )}

        {/* =================================================
            MY LISTINGS
        ================================================= */}

        {!loading &&
          !error &&
          activeTab ===
            "my-listings" && (
            <>
              <div className="browser-section-heading">

                <div>
                  <p className="eyebrow">
                    YOUR ACCOUNT
                  </p>

                  <h2>
                    My Listings
                  </h2>
                </div>

                <Link
                  href="/market/create"
                  className="small-sell-button"
                >
                  + Add listing
                </Link>

              </div>

              {!user ? (
                <div className="browser-empty">

                  <div>
                    🔐
                  </div>

                  <h3>
                    Login required
                  </h3>

                  <p>
                    Please login to see
                    your listings.
                  </p>

                </div>
              ) : myListings.length ===
                0 ? (
                <div className="browser-empty">

                  <div>
                    📦
                  </div>

                  <h3>
                    You have no listings
                  </h3>

                  <p>
                    Items you put up for
                    sale will appear here.
                  </p>

                  <Link
                    href="/market/create"
                    className="empty-action-button"
                  >
                    Sell your first item
                  </Link>

                </div>
              ) : (
                <div className="browser-listing-grid">

                  {myListings.map(
                    (listing) => (
                      <ListingCard
                        key={
                          listing.listing_id
                        }
                        listing={
                          listing
                        }
                        showStatus
                      />
                    )
                  )}

                </div>
              )}
            </>
          )}

        {/* =================================================
            WISHLIST
        ================================================= */}

        {!loading &&
          !error &&
          activeTab ===
            "wishlist" && (
            <>
              <div className="browser-section-heading">

                <div>
                  <p className="eyebrow">
                    SAVED ITEMS
                  </p>

                  <h2>
                    My Wishlist
                  </h2>
                </div>

                <span>
                  {
                    wishlistListings.length
                  } saved
                </span>

              </div>

              {!user ? (
                <div className="browser-empty">

                  <div>
                    🔐
                  </div>

                  <h3>
                    Login required
                  </h3>

                  <p>
                    Please login to use
                    your wishlist.
                  </p>

                </div>
              ) : wishlistListings.length ===
                0 ? (
                <div className="browser-empty">

                  <div>
                    ❤️
                  </div>

                  <h3>
                    Your wishlist is empty
                  </h3>

                  <p>
                    Click the heart on an
                    item to save it here.
                  </p>

                  <button
                    onClick={() =>
                      setActiveTab(
                        "browse"
                      )
                    }
                    className="empty-action-button"
                  >
                    Browse items
                  </button>

                </div>
              ) : (
                <div className="browser-listing-grid">

                  {wishlistListings.map(
                    (listing) => (
                      <ListingCard
                        key={
                          listing.listing_id
                        }
                        listing={
                          listing
                        }
                      />
                    )
                  )}

                </div>
              )}
            </>
          )}

        {/* =================================================
            CATEGORIES
        ================================================= */}

        {!loading &&
          !error &&
          activeTab ===
            "categories" && (
            <>
              <div className="browser-section-heading">

                <div>
                  <p className="eyebrow">
                    EXPLORE
                  </p>

                  <h2>
                    Marketplace Categories
                  </h2>

                  <p>
                    Choose a category to
                    find what you need.
                  </p>
                </div>

              </div>

              <div className="large-category-grid">

                {categories.map(
                  (category) => {

                    const count =
                      listings.filter(
                        (listing) =>
                          getCategory(
                            listing
                          )?.category_id ===
                          category.category_id
                      ).length

                    return (
                      <button
                        type="button"
                        key={
                          category.category_id
                        }
                        className="large-category-card"
                        onClick={() => {
                          setSelectedCategory(
                            category.category_id
                          )

                          setActiveTab(
                            "browse"
                          )
                        }}
                      >

                        <div className="large-category-icon">
                          📦
                        </div>

                        <div>

                          <h3>
                            {
                              category.category_name
                            }
                          </h3>

                          <p>
                            {count}{" "}
                            {count === 1
                              ? "item"
                              : "items"}
                          </p>

                        </div>

                        <span>
                          →
                        </span>

                      </button>
                    )
                  }
                )}

              </div>
            </>
          )}

      </section>

    </main>
  )
}
