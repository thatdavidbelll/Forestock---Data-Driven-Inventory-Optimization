import { Link } from 'react-router-dom'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Forestock Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="mt-3 text-sm text-slate-600">
            These terms describe the current MVP service posture for Forestock and the expectations around use, support, and launch maturity.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Service scope</h2>
            <p className="mt-2">
              Forestock provides inventory planning support, forecast visibility, and reorder recommendations. The service is decision support, not autonomous purchasing or financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Merchant responsibility</h2>
            <p className="mt-2">
              Merchants remain responsible for validating demand assumptions, purchase decisions, supplier terms, inventory adjustments, and store operations. Forestock recommendations should be reviewed before action.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Account access</h2>
            <p className="mt-2">
              Merchants are responsible for safeguarding credentials, approving authorized users, and notifying Forestock of suspected unauthorized access or data issues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Availability and changes</h2>
            <p className="mt-2">
              Forestock may change product capabilities, onboarding requirements, support processes, and integrations as the service moves from controlled launch toward broader availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Pilot and MVP limitations</h2>
            <p className="mt-2">
              Some workflows may still require manual support, validation, or operational supervision during the MVP phase. These limitations should be treated as part of the current service posture.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
            <p className="mt-2">
              Questions about service terms, support expectations, or account issues can be sent through the support page.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link to="/support" className="font-medium text-indigo-700 hover:text-indigo-800 hover:underline">
            Contact support
          </Link>
          <Link to="/privacy-policy" className="font-medium text-indigo-700 hover:text-indigo-800 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/login" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
