import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

export default function RequestStandaloneAccessPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/standalone-access/request', { email })
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#38BDF8] px-6 py-6 text-white">
          <h1 className="text-2xl font-bold">Enable Forestock web access</h1>
          <p className="mt-2 text-sm text-white/90">
            Shopify is the primary way to use Forestock. If you also need standalone Forestock web access, request an activation link below.
          </p>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-xl text-sky-600">
                ✉️
              </div>
              <p className="text-sm text-slate-700">
                If this Shopify-linked account is eligible for standalone Forestock access, we’ve sent an activation link to the email address on file.
              </p>
              <p className="text-xs text-slate-500">
                If you only plan to use Forestock through Shopify, you can ignore the email.
              </p>
              <Link to="/login" className="inline-flex text-sm font-medium text-[#4F46E5] hover:text-[#7C3AED] hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Shopify-first access:</span> request this only if you need Forestock outside Shopify for support, administration, or expanded workflows.
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="merchant@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {loading ? 'Sending activation link…' : 'Send activation link'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-slate-500">
                <Link to="/login" className="font-medium text-[#4F46E5] hover:text-[#7C3AED] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
