import { login, signup } from './actions'
import SubmitButton from '@/components/SubmitButton'

export default function LoginPage({ searchParams }) {
  const error = searchParams?.error
  const message = searchParams?.message

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Campus App</h1>
        <p className="subtitle">Log in or create an account to continue</p>

        {message && <p className="notice success">{message}</p>}
        {error && <p className="notice error">{error}</p>}

        <form action={login} className="auth-form">
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" required minLength={6} />
          </label>
          <SubmitButton className="btn-primary" pendingText="Logging in...">
            Log In
          </SubmitButton>
        </form>

        <div className="divider">or, if you&apos;re new here</div>

        <form action={signup} className="auth-form">
          <label>
            First Name
            <input type="text" name="name" required />
          </label>
          <label>
            Surname
            <input type="text" name="surname" required />
          </label>
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" required minLength={6} />
          </label>
          <SubmitButton className="btn-secondary" pendingText="Creating account...">
            Create Account
          </SubmitButton>
        </form>
      </div>
    </main>
  )
}