"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function Marketplace({ search = "" }) {
  const supabase = createClient()

  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [favorites, setFavorites] = useState([])

  const [selectedCategory, setSelectedCategory] = useState("all")

  const [searchInput, setSearchInput] = useState(search || "")
  const [activeSearch, setActiveSearch] = useState(search || "")

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadMarketplace()
  }, [])

  useEffect(() => {
    setSearchInput(search || "")
    setActiveSearch(search || "")
  }, [search])

  async function loadMarketplace() {
    setLoading(true)
    setError("")

    try {
      /*
       * Get current logged-in user
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("User error:", userError)
      }

      setUser(user || null)

      /*
       * Load categories
       */
      const { data: categoryData, error: categoryError } =
        await supabase
          .from("categories")
          .select("*")
          .order("category_name", {
            ascending: true,
          })

      if (categoryError) {
        console.error(
          "Category loading error:",
          categoryError
        )
      }

      setCategories(categoryData || [])

      /*
       * Load active marketplace listings
       */
      const { data: listingData, error: listingError } =
        await supabase
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
        console.error(
          "Listing loading error:",
          listingError
        )

        setError(
          "Unable to load marketplace listings."
        )
      }

      setListings(listingData || [])

      /*
       * Load user's favourites
       */
      if (user) {
        const {
          data: favoriteData,
          error: favoriteError,
        } = await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)

        if (favoriteError) {
          console.error(
            "Favourite loading error:",
            favoriteError
          )
        }

        setFavorites(
          favoriteData?.map(
            (favorite) => favorite.listing_id
          ) || []
        )
      }
    } catch (err) {
      console.error(
        "Marketplace loading error:",
        err
      )

      setError(
        "Something went wrong while loading the marketplace."
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * Get the category safely from the Supabase relationship.
   */
  function getCategory(listing) {
    const subcategory = Array.isArray(
      listing.subcategories
    )
      ? listing.subcategories[0]
      : listing.subcategories

    const category = Array.isArray(
      subcategory?.categories
    )
      ? subcategory.categories[0]
      : subcategory?.categories

    return category
  }

  /*
   * Search
   */
  function handleSearch(event) {
    event.preventDefault()

    setActiveSearch(
      searchInput.trim()
    )
  }

  function clearSearch() {
    setSearchInput("")
    setActiveSearch("")
  }

  /*
   * Favourite / unfavourite a listing
   */
  async function toggleFavorite(listingId) {
    if (!user) {
      alert(
        "Please login to save favourites."
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

        if (error) {
          throw error
        }

        setFavorites((current) =>
          current.filter(
            (id) => id !== listingId
          )
        )
      } else {
        const { error } =
          await supabase
            .from("favorites")
            .insert({
              user_id: user.id,
              listing_id: listingId,
            })

        if (error) {
          throw error
        }

        setFavorites((current) => [
          ...current,
          listingId,
        ])
      }
    } catch (err) {
      console.error(
        "Favourite error:",
        err
      )

      alert(
        "Unable to update favourite."
      )
    }
  }

  /*
   * Filter listings by search and category
   */
  const filteredListings = useMemo(() => {
    const searchText =
      activeSearch.toLowerCase().trim()

    return listings.filter((listing) => {
      const category =
        getCategory(listing)

      const title =
        listing.title?.toLowerCase() || ""

      const description =
        listing.description?.toLowerCase() || ""

      const matchesSearch =
        !searchText ||
        title.includes(searchText) ||
        description.includes(searchText)

      const matchesCategory =
        selectedCategory === "all" ||
        category?.category_id ===
          selectedCategory

      return (
        matchesSearch &&
        matchesCategory
      )
    })
  }, [
    listings,
    activeSearch,
    selectedCategory,
  ])

  return (
    <section className="marketplace">

      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <div className="market-hero">

        <p className="eyebrow">
          UNIVERSITY MARKETPLACE
        </p>

        <h2>
          Buy, sell and connect
          <br />
          <span>on campus.</span>
        </h2>

        <p className="hero-description">
          Find affordable textbooks,
          electronics, clothing and other
          items from students in your
          campus community.
        </p>

      </div>

      {/* ==================================================
          ACTIONS
      ================================================== */}

      <div className="market-actions">
        <Link
    href="/market/browse"
    className="browse-button"
  >
    <span className="browse-button-icon">🛍️</span>

    <span className="browse-button-text">
      <strong>Browse Marketplace</strong>
      <small>Find items being sold by students</small>
    </span>

    <span className="browse-button-arrow">→</span>
  </Link>

        <Link
          href="/market/create"
          className="sell-button"
        >
          + Sell an item
        </Link>

      </div>

      {/* ==================================================
          SEARCH
      ================================================== */}

      <section className="market-search-section">

        <form
          onSubmit={handleSearch}
          className="market-search"
        >

          <div className="search-input-wrapper">

            <span className="search-icon">
              🔍
            </span>

            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
              placeholder="Search marketplace..."
            />

            {searchInput && (
              <button
                type="button"
                className="clear-search"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

          </div>

          <button
            type="submit"
            className="search-button"
          >
            Search
          </button>

        </form>

      </section>

      {/* ==================================================
          CATEGORIES
      ================================================== */}

      <section className="categories-section">

        <div className="section-heading">

          <div>

            <p className="eyebrow">
              SHOP BY
            </p>

            <h2>
              Categories
            </h2>

          </div>

        </div>

        <div className="category-list">

          {/* ALL */}
          <button
            type="button"
            className={
              selectedCategory === "all"
                ? "category active"
                : "category"
            }
            onClick={() =>
              setSelectedCategory("all")
            }
          >
            <span>🛍️</span>
            All items
          </button>

          {/* DATABASE CATEGORIES */}
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
                    ? "category active"
                    : "category"
                }
                onClick={() =>
                  setSelectedCategory(
                    category.category_id
                  )
                }
              >
                <span>📦</span>

                {
                  category.category_name
                }
              </button>
            )
          )}

        </div>

      </section>

      {/* ==================================================
          LISTINGS
      ================================================== */}

      <section className="listings-section">

        <div className="section-heading">

          <div>

            <p className="eyebrow">
              DISCOVER
            </p>

            <h2>
              {activeSearch
                ? `Search results`
                : selectedCategory ===
                  "all"
                ? "Latest Listings"
                : "Marketplace Items"}
            </h2>

          </div>

          <span className="listing-count">
            {filteredListings.length}{" "}
            {filteredListings.length === 1
              ? "item"
              : "items"}
          </span>

        </div>

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="error-state">

            <div className="empty-icon">
              ⚠️
            </div>

            <h3>
              Something went wrong
            </h3>

            <p>
              {error}
            </p>

            <button
              type="button"
              className="retry-button"
              onClick={
                loadMarketplace
              }
            >
              Try again
            </button>

          </div>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && !error && (
          <div className="loading-state">

            <div className="loading-spinner"></div>

            <p>
              Loading marketplace...
            </p>

          </div>
        )}

        {/* ==================================================
            EMPTY
        ================================================== */}

        {!loading &&
          !error &&
          filteredListings.length ===
            0 && (
            <div className="empty-state">

              <div className="empty-icon">
                🔍
              </div>

              <h3>
                No listings found
              </h3>

              <p>
                {activeSearch
                  ? `No items match "${activeSearch}".`
                  : "There are currently no items in this category."}
              </p>

              {(activeSearch ||
                selectedCategory !==
                  "all") && (
                <button
                  type="button"
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchInput("")
                    setActiveSearch("")
                    setSelectedCategory(
                      "all"
                    )
                  }}
                >
                  Clear filters
                </button>
              )}

            </div>
          )}

        {/* ==================================================
            LISTING GRID
        ================================================== */}

        {!loading &&
          !error &&
          filteredListings.length >
            0 && (

            <div className="listing-grid">

              {filteredListings.map(
                (listing) => {

                  const category =
                    getCategory(
                      listing
                    )

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
                    <article
                      className="listing-card"
                      key={
                        listing.listing_id
                      }
                    >

                      {/* IMAGE */}
                      <div className="listing-image">

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
                          <div className="no-image">

                            <span>
                              📷
                            </span>

                            <p>
                              No image
                            </p>

                          </div>
                        )}

                        {/* FAVOURITE */}
                        <button
                          type="button"
                          className="favorite-button"
                          onClick={() =>
                            toggleFavorite(
                              listing.listing_id
                            )
                          }
                          aria-label={
                            isFavorite
                              ? "Remove from favourites"
                              : "Add to favourites"
                          }
                        >
                          {isFavorite
                            ? "❤️"
                            : "♡"}
                        </button>

                      </div>

                      {/* CONTENT */}
                      <div className="listing-content">

                        <p className="listing-category">
                          {category?.category_name ||
                            "Other"}
                        </p>

                        <h3>
                          {listing.title}
                        </h3>

                        <p className="listing-description">
                          {listing.description ||
                            "No description provided."}
                        </p>

                        <div className="listing-bottom">

                          <div className="price-area">

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
                            className="view-button"
                          >
                            View
                          </Link>

                        </div>

                      </div>

                    </article>
                  )
                }
              )}

            </div>
          )}

      </section>

    </section>
  )
}
