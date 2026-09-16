import './globals.css'
import SessionGuard from '@/components/SessionGuard'

export const metadata = {
  title: 'Campus App',
  description: 'Marketplace + Laundry booking for campus students',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionGuard />
        {children}
      </body>
    </html>
  )
}