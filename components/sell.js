"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateListingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadCategories() {
      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .order("category_name");

      const { data: subCategoryData } = await supabase
        .from("subcategories")
        .select("*")
        .order("sub_category_name");

      setCategories(categoryData || []);
      setSubcategories(subCategoryData || []);
    }

    loadCategories();
  }, []);

  const filteredSubcategories = subcategories.filter(
    (sub) => sub.category_id === categoryId
  );

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");

    const form = event.target;
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const price = form.price.value;
    const condition = form.condition.value;

    if (!imageFile) {
      setErrorMsg("Please add a product image.");
      return;
    }
    if (!subCategoryId) {
      setErrorMsg("Please select a category and subcategory.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // 1. Create the listing row
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          sub_category_id: subCategoryId,
          title,
          description,
          condition,
          price,
          status: "active",
        })
        .select()
        .single();

      if (listingError) throw listingError;

      // 2. Upload the image to Storage
      const filePath = `${user.id}/${listing.listing_id}-${imageFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(filePath);

      // 3. Link the image to the listing
      const { error: imageError } = await supabase
        .from("listing_images")
        .insert({
          listing_id: listing.listing_id,
          image_url: urlData.publicUrl,
          is_primary: true,
        });

      if (imageError) throw imageError;

      router.push("/market");
    } catch (err) {
      console.error("Error creating listing:", err);
      setErrorMsg("Something went wrong while posting your listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="sell-container">
        <div className="sell-header">
          <h1>Sell an Item</h1>
          <p>Create a listing for other students on campus.</p>
        </div>

        {errorMsg && <p className="notice error">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="sell-form">
          <div className="form-group">
            <label htmlFor="image">Product image</label>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required
            />
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Product preview" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="title">Item title</label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Accounting textbook"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows="5"
              placeholder="Describe your item..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubCategoryId("");
              }}
              required
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="subcategory">Subcategory</label>
            <select
              id="subcategory"
              value={subCategoryId}
              onChange={(e) => setSubCategoryId(e.target.value)}
              disabled={!categoryId}
              required
            >
              <option value="">
                {categoryId ? "Select a subcategory" : "Choose a category first"}
              </option>
              {filteredSubcategories.map((sub) => (
                <option key={sub.sub_category_id} value={sub.sub_category_id}>
                  {sub.sub_category_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="price">Price</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 250"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="condition">Condition</label>
            <select id="condition" name="condition" required>
              <option value="">Select condition</option>
              <option value="new">New</option>
              <option value="like-new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="used">Used</option>
            </select>
          </div>

          <button type="submit" className="post-listing-button" disabled={submitting}>
            {submitting ? "Posting..." : "Post Listing"}
          </button>
        </form>
      </div>
    </main>
  );
}