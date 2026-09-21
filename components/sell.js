"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import MarketHeader from "@/components/MarketHeader"
import "@/app/market/sell.css"

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like-new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "used", label: "Used" },
]
const MAX_IMAGES = 4
const MAX_MB = 5
const RENT_TO_BUY_MIN_PRICE = 2000 // items ABOVE this can offer rent-to-buy (also enforced in the database)

export default function CreateListingPage({ displayName = "" }) {
  const supabase = createClient()
  const router = useRouter()

  const [images, setImages] = useState([]) // [{ file, url }]
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [subCategoryId, setSubCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [condition, setCondition] = useState("good")
  const [offerRent, setOfferRent] = useState(false)
  const [rentPrice, setRentPrice] = useState("")
  const [rentToBuy, setRentToBuy] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function loadCategories() {
      const [{ data: cats }, { data: subs }] = await Promise.all([
        supabase.from("categories").select("*").order("category_name"),
        supabase.from("subcategories").select("*").order("sub_category_name"),
      ])
      setCategories(cats || [])
      setSubcategories(subs || [])
    }
    loadCategories()
  }, [])

  const filteredSubs = subcategories.filter((s) => s.category_id === categoryId)
  const selectedSub = subcategories.find((s) => s.sub_category_id === subCategoryId)
  const rentAllowed = !!selectedSub?.rent_eligible
  const minMonths = selectedSub?.rent_min_months || 1

  const priceNum = Number(price)
  const rentNum = Number(rentPrice)
  const rentToBuyAllowed = rentAllowed && offerRent && priceNum > RENT_TO_BUY_MIN_PRICE

  // Rent is only for the rentable appliances: switch it off if the subcategory doesn't allow it
  useEffect(() => {
    if (!rentAllowed) {
      setOfferRent(false)
      setRentPrice("")
      setRentToBuy(false)
    }
  }, [rentAllowed])

  // Rent-to-buy only above R2000
  useEffect(() => {
    if (!rentToBuyAllowed) setRentToBuy(false)
  }, [rentToBuyAllowed])

  function handleImages(event) {
    const picked = Array.from(event.target.files || [])
    event.target.value = ""
    setErrorMsg("")

    const next = [...images]
    for (const file of picked) {
      if (next.length >= MAX_IMAGES) break
      if (!file.type.startsWith("image/")) continue
      if (file.size > MAX_MB * 1024 * 1024) {
        setErrorMsg(`Each photo must be under ${MAX_MB}MB.`)
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    setImages(next)
  }

  function removeImage(index) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].url)
      return current.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMsg("")

    if (images.length === 0) return setErrorMsg("Please add at least one photo.")
    if (!subCategoryId) return setErrorMsg("Please choose a category and subcategory.")
    if (price === "" || !(priceNum >= 0)) return setErrorMsg("Please enter a valid price.")
    if (offerRent && !(rentNum > 0)) return setErrorMsg("Please enter a monthly rent.")

    setSubmitting(true)
    let createdListingId = null

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          sub_category_id: subCategoryId,
          title: title.trim(),
          description: description.trim(),
          condition,
          price: priceNum,
          rent_price_monthly: offerRent ? rentNum : null,
          rent_to_buy_enabled: offerRent && rentToBuy,
          status: "active",
        })
        .select()
        .single()

      if (listingError) throw listingError
      createdListingId = listing.listing_id

      for (let i = 0; i < images.length; i++) {
        const file = images[i].file
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const filePath = `${user.id}/${listing.listing_id}-${i}-${safeName}`

        const { error: uploadError } = await supabase.storage.from("listing-images").upload(filePath, file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(filePath)

        const { error: imageError } = await supabase.from("listing_images").insert({
          listing_id: listing.listing_id,
          image_url: urlData.publicUrl,
          is_primary: i === 0,
        })
        if (imageError) throw imageError
      }

      router.push("/market")
    } catch (err) {
      console.error("Error creating listing:", err)
      // Don't leave a half-created listing (no photos) behind
      if (createdListingId) {
        await supabase.from("listings").delete().eq("listing_id", createdListingId)
      }
      setErrorMsg(err?.message || "Something went wrong while posting your listing. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const tenMonths = rentNum * 10
  const tenMonthsPct = priceNum > 0 ? Math.round((tenMonths / priceNum) * 100) : null

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} />

      <main className="sf-wrap">
        <div className="sf-head">
          <h1>Sell an item</h1>
          <p>Create a listing for other students on campus. One listing = one physical item.</p>
        </div>

        {errorMsg && <p className="notice error">{errorMsg}</p>}

        <form onSubmit={handleSubmit}>
          {/* 1. PHOTOS */}
          <section className="sf-card">
            <h2>Photos</h2>
            <p className="sf-hint">
              Add up to {MAX_IMAGES} clear photos of the actual item. The first one is the cover.
            </p>

            <div className="sf-photos">
              {images.map((img, i) => (
                <div className="sf-thumb" key={img.url}>
                  <img src={img.url} alt={`Photo ${i + 1}`} />
                  {i === 0 && <span className="sf-cover">Cover</span>}
                  <button type="button" onClick={() => removeImage(i)} aria-label="Remove photo">
                    ×
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <label className="sf-drop">
                  <input type="file" accept="image/*" multiple onChange={handleImages} />
                  <span className="sf-drop-plus">+</span>
                  <span>Add photo</span>
                </label>
              )}
            </div>
          </section>

          {/* 2. DETAILS */}
          <section className="sf-card">
            <h2>Item details</h2>

            <label className="sf-field">
              Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Defy 250L fridge-freezer"
                maxLength={120}
                required
              />
            </label>

            <label className="sf-field">
              Description
              <textarea
                rows="5"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Condition, what's included, any scratches or faults..."
                required
              />
            </label>
          </section>

          {/* 3. CATEGORY (fixed set, managed in the database) */}
          <section className="sf-card">
            <h2>Category</h2>
            <p className="sf-hint">Pick where your item belongs. Food and drink are not allowed on the marketplace.</p>

            <div className="sf-chips">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.category_id}
                  className={categoryId === c.category_id ? "sf-chip active" : "sf-chip"}
                  onClick={() => {
                    setCategoryId(c.category_id)
                    setSubCategoryId("")
                  }}
                >
                  {c.category_name}
                </button>
              ))}
            </div>

            <label className="sf-field" style={{ marginTop: 16 }}>
              Subcategory
              <select
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                disabled={!categoryId}
                required
              >
                <option value="">{categoryId ? "Select a subcategory" : "Choose a category first"}</option>
                {filteredSubs.map((s) => (
                  <option key={s.sub_category_id} value={s.sub_category_id}>
                    {s.sub_category_name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* 4. PRICE + CONDITION */}
          <section className="sf-card">
            <h2>Price &amp; condition</h2>

            <label className="sf-field">
              Price (R) — the full amount you want for the item
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 2500"
                required
              />
            </label>

            <div className="sf-field">
              Condition
              <div className="sf-chips">
                {CONDITIONS.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    className={condition === c.value ? "sf-chip active" : "sf-chip"}
                    onClick={() => setCondition(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 5. RENT (fridges, microwaves, ovens, deep fryers, air fryers only) */}
          {rentAllowed && (
            <section className="sf-card sf-rent">
              <label className="sf-toggle">
                <input type="checkbox" checked={offerRent} onChange={(e) => setOfferRent(e.target.checked)} />
                <span>
                  <strong>Also offer this for rent</strong>
                  <em>
                    Available for fridges/freezers, microwaves, ovens, deep fryers and air fryers.
                    {minMonths > 1 ? ` This item is rented for a minimum of ${minMonths} months.` : ""}
                  </em>
                </span>
              </label>

              {offerRent && (
                <>
                  <label className="sf-field" style={{ marginTop: 16 }}>
                    Monthly rent (R)
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={rentPrice}
                      onChange={(e) => setRentPrice(e.target.value)}
                      placeholder="e.g. 200"
                    />
                  </label>

                  <label className={rentToBuyAllowed ? "sf-toggle" : "sf-toggle disabled"}>
                    <input
                      type="checkbox"
                      checked={rentToBuy}
                      disabled={!rentToBuyAllowed}
                      onChange={(e) => setRentToBuy(e.target.checked)}
                    />
                    <span>
                      <strong>Allow rent-to-buy</strong>
                      <em>
                        {priceNum > RENT_TO_BUY_MIN_PRICE
                          ? "Renters can rent for 7–10 months, and after month 6 they can buy the item for your price minus the rent already paid."
                          : `Only for items priced above R${RENT_TO_BUY_MIN_PRICE}.`}
                      </em>
                    </span>
                  </label>

                  {rentNum > 0 && tenMonthsPct !== null && (
                    <div className="sf-callout">
                      Over 10 months, R{rentNum.toFixed(0)}/month adds up to R{tenMonths.toFixed(0)} — about{" "}
                      {tenMonthsPct}% of your asking price.
                    </div>
                  )}

                  <ul className="sf-rules">
                    <li>Rentals of 3+ months: the renter pays 3 months upfront, and the last month is always prepaid.</li>
                    <li>1–2 month rentals: each month is paid in full at the start of that month.</li>
                    <li>Standard rentals run up to 6 months{rentToBuy ? "; with rent-to-buy, up to 10" : ""}.</li>
                    <li>Campus Connect holds the money and pays you each month&apos;s rent at the end of that month.</li>
                    <li>If the appliance breaks, the renter gets back the money not yet paid out to you.</li>
                  </ul>
                </>
              )}
            </section>
          )}

          {selectedSub && !rentAllowed && (
            <p className="sf-note">
              Renting is only available for fridges/freezers, microwaves, ovens, deep fryers and air fryers.
            </p>
          )}

          <div className="sf-actions">
            <button type="button" className="sf-cancel" onClick={() => router.push("/market")}>
              Cancel
            </button>
            <button type="submit" className="sf-submit" disabled={submitting}>
              {submitting ? "Posting..." : "Post listing"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
