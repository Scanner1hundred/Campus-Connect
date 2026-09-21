// DEMO card helpers. Only brand / last4 / expiry are ever sent to the database.
// The full number and CVV stay in browser memory and are discarded.

export function detectBrand(number) {
  const d = number.replace(/\D/g, "")
  if (/^4/.test(d)) return "Visa"
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard"
  if (/^3[47]/.test(d)) return "Amex"
  return "Card"
}

export function formatCardNumber(value) {
  const d = value.replace(/\D/g, "").slice(0, 16)
  return d.replace(/(.{4})/g, "$1 ").trim()
}

export function formatExpiry(value) {
  const d = value.replace(/\D/g, "").slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export function luhnValid(number) {
  const d = number.replace(/\D/g, "")
  if (d.length < 13) return false
  let sum = 0
  let alt = false
  for (let i = d.length - 1; i >= 0; i--) {
    let x = Number(d[i])
    if (alt) {
      x *= 2
      if (x > 9) x -= 9
    }
    sum += x
    alt = !alt
  }
  return sum % 10 === 0
}

// "MM/YY" -> { month, year } or null if invalid / expired
export function parseExpiry(value) {
  const m = /^(\d{2})\/(\d{2})$/.exec(value)
  if (!m) return null
  const month = Number(m[1])
  const year = 2000 + Number(m[2])
  if (month < 1 || month > 12) return null
  if (new Date(year, month, 1) <= new Date()) return null
  return { month, year }
}

export const money = (n) =>
  `R${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
