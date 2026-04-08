import { Link } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Forestock Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-600">
            This policy describes how Forestock handles merchant and operational data in the current MVP and Shopify-connected workflow.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
            <p className="mt-2">
              Forestock stores account details, store configuration, product data, inventory history, sales history, forecast outputs, reorder suggestions, and audit activity needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Shopify-connected data</h2>
            <p className="mt-2">
              In the current Shopify app flow, Forestock reads product, inventory, and order data from Shopify. The embedded app is currently designed to operate on the recent 60 days of Shopify order history under the app&apos;s present scope set.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">How we use data</h2>
            <p className="mt-2">
              Forestock uses operational data to prepare forecasting, restocking recommendations, reporting exports, onboarding support, and security/audit logs. Data is used for merchant operations, not ad targeting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">How long we keep data</h2>
            <p className="mt-2">
              Forestock retains operational data for as long as it is needed to provide the service, investigate incidents, satisfy contractual obligations, or comply with applicable law. Retention periods may change as launch policies mature.
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
              Forestock uses authentication, role-based access, store-scoped authorization, and audit logging to reduce unauthorized access risk. No system is risk-free, and merchants should contact support immediately if they suspect misuse.
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
