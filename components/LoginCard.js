'use client'

import { useState } from 'react'
import { login, signup } from '@/app/login/actions'
import SubmitButton from '@/components/SubmitButton'

export default function LoginCard({ message, error, defaultMode = 'login' }) {
  const [mode, setMode] = useState(defaultMode)

  return (
    <div className="login-card">
      <div className="login-visual">
        <div className="login-brand">
          <img src="/crest.png" alt="University crest" className="crest-logo" />
          <h1>Campus Connect</h1>
        </div>

        <div className="login-tagline">
          <h2>Your campus, your resources,<br />all in one place.</h2>
          <p>
            Buy and sell with other students, keep track of your bookings, and
            get everything your campus has to offer — all from one account.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        {mode === 'login' ? (
          <>
            <h2 className="form-heading">Welcome back!</h2>
            <p className="form-subheading">Log in to your Campus Connect account</p>

            {message && <p className="notice success">{message}</p>}
            {error && <p className="notice error">{error}</p>}

            <form action={login} className="styled-auth-form">
              <label className="input-with-icon">
                              <input type="email" name="email" placeholder="Email address" required />
              </label>
              <label className="input-with-icon">
                                <input type="password" name="password" placeholder="Password" required minLength={6} />
              </label>

              <div className="form-row">
                <label className="checkbox-row">
                  <input type="checkbox" defaultChecked />
                  Remember me
                </label>
                <a href="#" className="link-muted">Forgot password?</a>
              </div>

              <SubmitButton className="btn-primary btn-block" pendingText="Logging in...">
                Log In →
              </SubmitButton>
            </form>

            <div className="divider">or</div>

            <button type="button" className="btn-secondary btn-block" onClick={() => setMode('signup')}>
              Create Account
            </button>
          </>
        ) : (
          <>
            <h2 className="form-heading">Create your account</h2>
            <p className="form-subheading">Join Campus Connect with your student details</p>

            {message && <p className="notice success">{message}</p>}
            {error && <p className="notice error">{error}</p>}

            <form action={signup} className="styled-auth-form">
              <label className="input-with-icon">
                
                <input type="text" name="name" placeholder="First Name" required />
              </label>
              <label className="input-with-icon">
                
                <input type="text" name="surname" placeholder="Surname" required />
              </label>
              <label className="input-with-icon">
                
                <input type="email" name="email" placeholder="Email address" required />
              </label>
              <label className="input-with-icon">
                
                <input type="password" name="password" placeholder="Password" required minLength={6} />
              </label>

              <SubmitButton className="btn-primary btn-block" pendingText="Creating account...">
                Create Account →
              </SubmitButton>
            </form>

            <div className="divider">or</div>

            <button type="button" className="btn-secondary btn-block" onClick={() => setMode('login')}>
              Back to Log In
            </button>
          </>
        )}
      </div>
    </div>
  )
}