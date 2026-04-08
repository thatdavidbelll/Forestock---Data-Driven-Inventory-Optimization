import { Link } from 'react-router-dom'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Forestock Support</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Support</h1>
          <p className="mt-3 text-sm text-slate-600">
            Use this page as the merchant-facing support destination for onboarding, setup issues, sync failures, and account questions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">Email support</h2>
            <p className="mt-2 text-sm text-slate-700">
              `support@forestock.app`
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Use for onboarding questions, account access issues, Shopify setup problems, or data concerns.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">What to include</h2>
            <p className="mt-2 text-sm text-slate-600">
              Include your store name, Shopify domain if relevant, what you expected, what happened instead, and any screenshots or timestamps that help reproduce the issue.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Typical support topics</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Shopify install, setup, or reconnect issues</li>
              <li>Catalog or order-history import failures</li>
              <li>Forecasting or recommendation questions</li>
              <li>Standalone access activation and account recovery</li>
              <li>Privacy or data deletion requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Response expectations</h2>
            <p className="mt-2">
              During MVP and pilot phases, some issues may be resolved with manual support intervention rather than fully self-serve recovery flows.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy-policy" className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms-of-service" className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
            Terms of Service
          </Link>
          <Link to="/login" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
