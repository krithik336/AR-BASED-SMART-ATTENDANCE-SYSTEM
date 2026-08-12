import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('TEACHER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(name, email, password, role)
      navigate(data.role === 'ADMIN' ? '/admin' : '/teacher')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create Account</h1>
          <p className="text-text-secondary text-sm mt-1">Admin and Teacher accounts only</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-danger text-sm rounded-lg px-3 py-2 border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@school.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Min. 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input"
            >
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
