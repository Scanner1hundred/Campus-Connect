import { login, signup } from './actions'

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
          <button type="submit" className="btn-primary">
            Log In
          </button>
        </form>

        <div className="divider">or, if you&apos;re new here</div>

        <form action={signup} className="auth-form">
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" required minLength={6} />
          </label>
          <button type="submit" className="btn-secondary">
            Create Account
          </button>
        </form>
      </div>
    </main>
  )
}
