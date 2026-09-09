"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const supabase = createClient();

export default function MarketPage() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadMarketplace();
  }, []);

  async function loadMarketplace() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    // Get categories
    const { data: categoryData } = await supabase
      .from("categories")
      .select("*")
      .order("category_name");

    setCategories(categoryData || []);

    // Get active listings
    const { data: listingData, error } = await supabase
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading listings:", error);
    } else {
      setListings(listingData || []);
    }

    // Get user's favourites
    if (user) {
      const { data: favoriteData } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id);

      setFavorites(
        favoriteData?.map((favorite) => favorite.listing_id) || []
      );
    }

    setLoading(false);
  }

  async function toggleFavorite(listingId) {
    if (!user) {
      alert("Please login to save favourites.");
      return;
    }

    const isFavorite = favorites.includes(listingId);

    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);

      setFavorites(
        favorites.filter((id) => id !== listingId)
      );
    } else {
      await supabase
        .from("favorites")
        .insert({
          user_id: user.id,
          listing_id: listingId,
        });

      setFavorites([...favorites, listingId]);
    }
  }

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.title
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      listing.description
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const categoryName =
      listing.subcategories?.categories?.category_name;

    const matchesCategory =
      selectedCategory === "all" ||
      categoryName === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="market-page">

      {/* HEADER */}
      <header className="market-header">
        <Link href="/" className="logo">
          Campus<span>Connect</span>
        </Link>

        <nav>
          <Link href="/market">Marketplace</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/laundry">Laundry</Link>
        </nav>

        <Link href="/profile" className="profile-button">
          👤
        </Link>
      </header>


      {/* HERO */}
      <section className="market-hero">

        <div>
          <p className="eyebrow">
            UNIVERSITY MARKETPLACE
          </p>

          <h1>
            Buy, sell and connect
            <br />
            <span>on campus.</span>
          </h1>

          <p className="hero-description">
            Find affordable textbooks, electronics, clothing
            and other items from students in your campus
            community.
          </p>
        </div>

      </section>


      {/* SEARCH */}
      <section className="search-section">

        <div className="search-box">

          <span>🔍</span>

          <input
            type="text"
            placeholder="Search textbooks, laptops, clothes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>

        <Link href="/market/create" className="sell-button">
          + Sell an item
        </Link>

      </section>


      {/* CATEGORIES */}
      <section className="categories-section">

        <div className="section-heading">
          <h2>Categories</h2>
        </div>

        <div className="category-list">

          <button
            className={
              selectedCategory === "all"
                ? "category active"
                : "category"
            }
            onClick={() => setSelectedCategory("all")}
          >
            🛍️
            <span>All</span>
          </button>

          {categories.map((category) => (

            <button
              key={category.category_id}
              className={
                selectedCategory === category.category_name
                  ? "category active"
                  : "category"
              }
              onClick={() =>
                setSelectedCategory(category.category_name)
              }
            >
              📦
              <span>{category.category_name}</span>
            </button>

          ))}

        </div>

      </section>


      {/* LISTINGS */}
      <section className="listings-section">

        <div className="section-heading">

          <div>
            <p className="eyebrow">DISCOVER</p>
            <h2>Latest Listings</h2>
          </div>

          <span className="listing-count">
            {filteredListings.length} items
          </span>

        </div>


        {loading ? (

          <div className="loading">
            Loading marketplace...
          </div>

        ) : filteredListings.length === 0 ? (

          <div className="empty-state">
            <div>🔍</div>
            <h3>No listings found</h3>
            <p>
              Try a different search or category.
            </p>
          </div>

        ) : (

          <div className="listing-grid">

            {filteredListings.map((listing) => {

              const primaryImage =
                listing.listing_images?.find(
                  (image) => image.is_primary
                ) ||
                listing.listing_images?.[0];

              const isFavorite =
                favorites.includes(listing.listing_id);

              return (

                <article
                  className="listing-card"
                  key={listing.listing_id}
                >

                  <div className="listing-image">

                    {primaryImage ? (

                      <img
                        src={primaryImage.image_url}
                        alt={listing.title}
                      />

                    ) : (

                      <div className="no-image">
                        📷
                        <span>No image</span>
                      </div>

                    )}

                    <button
                      className="favorite-button"
                      onClick={() =>
                        toggleFavorite(listing.listing_id)
                      }
                    >
                      {isFavorite ? "❤️" : "♡"}
                    </button>

                  </div>


                  <div className="listing-content">

                    <p className="listing-category">
                      {listing.subcategories?.categories
                        ?.category_name || "Other"}
                    </p>

                    <h3>{listing.title}</h3>

                    <p className="listing-description">
                      {listing.description ||
                        "No description provided."}
                    </p>

                    <div className="listing-bottom">

                      <div>
                        <strong>
                          R{Number(listing.price).toFixed(2)}
                        </strong>

                        <span>
                          {listing.condition || "Used"}
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

              );

            })}

          </div>

        )}

      </section>

    </main>
  );
}
