export default function Stars({ value, size = 22 }) {
  const filled = Math.round(value)
  return (
    <span className="ld-stars" style={{ fontSize: size }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= filled ? 'on' : ''}>★</span>
      ))}
    </span>
  )
}
