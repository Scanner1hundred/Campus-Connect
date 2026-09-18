import LoginCard from '@/components/LoginCard'

export default function LoginPage({ searchParams }) {
  return (
    <main className="auth-page">
      <LoginCard message={searchParams?.message} error={searchParams?.error} />
    </main>
  )
}