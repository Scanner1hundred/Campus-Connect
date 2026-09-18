import LoginCard from '@/components/LoginCard'

export default function SignupPage({ searchParams }) {
  return (
    <main className="auth-page">
      <LoginCard
        defaultMode="signup"
        message={searchParams?.message}
        error={searchParams?.error}
      />
    </main>
  )
}