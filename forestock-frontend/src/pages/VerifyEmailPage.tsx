import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }

    let cancelled = false
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(({ data }) => {
        if (cancelled) return
        setStatus('success')
        setMessage(data.message ?? 'Email verified successfully.')
      })
      .catch((error) => {
        if (cancelled) return
        setStatus('error')
        setMessage(extractErrorMessage(error, 'Failed to verify email.'))
      })

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-indigo-600 mb-3">Verify Email</h1>
        <p className={`text-sm rounded-lg px-4 py-3 ${
          status === 'success'
            ? 'text-green-700 bg-green-50'
            : status === 'error'
              ? 'text-red-700 bg-red-50'
              : 'text-gray-600 bg-gray-50'
        }`}>
          {message}
        </p>
        <Link
          to="/login"
          className="inline-flex mt-6 text-sm font-medium text-indigo-600 hover:underline"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  )
}
