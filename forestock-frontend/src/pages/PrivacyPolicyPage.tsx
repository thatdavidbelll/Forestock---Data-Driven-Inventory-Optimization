import { Link } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Forestock Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-600">
            This policy describes how Forestock handles merchant data and Shopify-connected operational data when merchants use the Forestock service.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
            <p className="mt-2">
              Forestock stores merchant account details, store configuration, product data, inventory history, sales history, forecast outputs, reorder suggestions, audit activity, and support-related records needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Shopify-connected data</h2>
            <p className="mt-2">
              Forestock reads product, inventory, and order data from Shopify to provide inventory forecasting and reorder recommendations. Forestock retains operational order fields such as order identifiers, order dates, line items, quantities, totals, currency, and product matching metadata. Forestock does not retain direct customer name, email, billing address, shipping address, or phone fields from Shopify order payloads.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">How we use data</h2>
            <p className="mt-2">
              Forestock uses operational data to provide forecasting, inventory planning, reorder recommendations, reporting exports, onboarding support, service security, and audit logging. Forestock does not use merchant or Shopify-connected data for advertising, customer profiling, or cross-merchant personalization.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Purpose limitation</h2>
            <p className="mt-2">
              Forestock processes merchant and Shopify-connected data only to provide the service requested by the merchant, secure the service, investigate incidents, satisfy legal obligations, and respond to verified support or privacy requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">How long we keep data</h2>
            <p className="mt-2">
              Forestock keeps merchant operational records for the period needed to provide the service while a merchant account is active. GDPR request logs and related privacy request records are retained for up to 12 months. Security and audit records are retained for up to 12 months unless a longer retention period is required by law or for an active security investigation. When data is no longer needed for these purposes, Forestock deletes it or anonymizes it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Data sharing</h2>
            <p className="mt-2">
              Forestock does not sell merchant data. Data may be processed by infrastructure and service providers that support application hosting, storage, logging, or communication workflows.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Security</h2>
            <p className="mt-2">
              Forestock uses HTTPS in transit, authenticated access controls, role-based permissions, store-scoped authorization, and audit logging to reduce unauthorized access risk. Forestock limits access to merchant data to personnel and service providers that need it to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Merchant responsibilities and agreements</h2>
            <p className="mt-2">
              Merchants use Forestock subject to Forestock&apos;s Terms of Service and this Privacy Policy. These documents describe Forestock&apos;s data handling commitments, the merchant&apos;s responsibilities, and how privacy or support requests can be submitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Questions and requests</h2>
            <p className="mt-2">
              Privacy, deletion, or support requests can be sent through the support page.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link to="/support" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
            Contact support
          </Link>
          <Link to="/terms-of-service" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
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
