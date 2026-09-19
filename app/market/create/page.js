"use client";

import { useState } from "react";

export default function CreateListingPage() {
  const [imagePreview, setImagePreview] = useState(null);

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    // Supabase connection will be added in the next step.
    alert("Listing form submitted!");
  }

  return (
    <main className="page">
      <div className="sell-container">

        <div className="sell-header">
          <h1>Sell an Item</h1>
          <p>
            Create a listing for other students on campus.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="sell-form">

          {/* Product Image */}
          <div className="form-group">
            <label htmlFor="image">
              📷 Product image
            </label>

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
                <img
                  src={imagePreview}
                  alt="Product preview"
                />
              </div>
            )}
          </div>

          {/* Item Title */}
          <div className="form-group">
            <label htmlFor="title">
              🏷️ Item title
            </label>

            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Accounting textbook"
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">
              📝 Description
            </label>

            <textarea
              id="description"
              name="description"
              rows="5"
              placeholder="Describe your item..."
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label htmlFor="category">
              📂 Category
            </label>

            <select
              id="category"
              name="category"
              required
            >
              <option value="">
                Select a category
              </option>

              <option value="textbooks">
                Textbooks
              </option>

              <option value="electronics">
                Electronics
              </option>

              <option value="clothing">
                Clothing
              </option>

              <option value="furniture">
                Furniture
              </option>

              <option value="stationery">
                Stationery
              </option>

              <option value="other">
                Other
              </option>
            </select>
          </div>

          {/* Price */}
          <div className="form-group">
            <label htmlFor="price">
              💰 Price
            </label>

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

          {/* Condition */}
          <div className="form-group">
            <label htmlFor="condition">
              📦 Condition
            </label>

            <select
              id="condition"
              name="condition"
              required
            >
              <option value="">
                Select condition
              </option>

              <option value="new">
                New
              </option>

              <option value="like-new">
                Like New
              </option>

              <option value="good">
                Good
              </option>

              <option value="fair">
                Fair
              </option>

              <option value="used">
                Used
              </option>
            </select>
          </div>

          {/* Campus / Location */}
          <div className="form-group">
            <label htmlFor="campus">
              📍 Campus / Location
            </label>

            <input
              id="campus"
              name="campus"
              type="text"
              placeholder="e.g. Alice Campus"
              required
            />
          </div>

          {/* Contact Information */}
          <div className="form-group">
            <label htmlFor="contact">
              📞 Contact information
            </label>

            <input
              id="contact"
              name="contact"
              type="text"
              placeholder="Phone number or email"
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="post-listing-button"
          >
            Post Listing
          </button>

        </form>
      </div>
    </main>
  );
}

