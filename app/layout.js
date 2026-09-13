import './globals.css'

export const metadata = {
  title: 'UFH Campus Connect',
  description: 'Marketplace + Laundry booking for campus students',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
