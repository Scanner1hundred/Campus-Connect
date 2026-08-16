import './globals.css'

export const metadata = {
  title: 'Campus App',
  description: 'Marketplace + Laundry booking for campus students',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
