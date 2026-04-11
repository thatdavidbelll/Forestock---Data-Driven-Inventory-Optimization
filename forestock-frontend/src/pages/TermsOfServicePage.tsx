import { Link } from 'react-router-dom'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Forestock Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="mt-3 text-sm text-slate-600">
            These terms describe the commercial and operational terms that apply when merchants use Forestock, including the Shopify-connected workflow.
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
            <h2 className="text-lg font-semibold text-slate-900">Data processing and privacy</h2>
            <p className="mt-2">
              By using Forestock, merchants authorize Forestock to process merchant and Shopify-connected operational data as described in the Privacy Policy for the limited purpose of delivering inventory forecasting, reorder planning, security, support, and related service operations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Availability and changes</h2>
            <p className="mt-2">
              Forestock may change product capabilities, onboarding requirements, support processes, and integrations as the service evolves, provided that material changes to data use or service commitments will be reflected in the legal and support documentation made available to merchants.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Data requests and deletion</h2>
            <p className="mt-2">
              Merchants may submit privacy, deletion, or support requests through Forestock support. Forestock will process verified requests in accordance with applicable law, Shopify platform requirements, and the Privacy Policy.
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
