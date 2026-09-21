'use client'

import { useState } from 'react'
import Icon from '@/components/Icon'

export default function ImageGallery({ images, title }) {
  const [index, setIndex] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className="ld-gallery">
        <div className="ld-main-image ld-no-image">📷<span>No image</span></div>
      </div>
    )
  }

  const prev = () => setIndex((index - 1 + images.length) % images.length)
  const next = () => setIndex((index + 1) % images.length)

  return (
    <div className="ld-gallery">
      <div className="ld-main-image">
        <img src={images[index]} alt={title} />
        <span className="ld-counter">{index + 1} / {images.length}</span>
        {images.length > 1 && (
          <>
            <button type="button" className="ld-arrow left" onClick={prev} aria-label="Previous image">
              <Icon name="left" size={20} />
            </button>
            <button type="button" className="ld-arrow right" onClick={next} aria-label="Next image">
              <Icon name="right" size={20} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="ld-thumbs">
          {images.map((url, i) => (
            <button
              type="button"
              key={url + i}
              className={i === index ? 'ld-thumb active' : 'ld-thumb'}
              onClick={() => setIndex(i)}
            >
              <img src={url} alt={`${title} ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
