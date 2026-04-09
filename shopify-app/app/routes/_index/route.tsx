import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <section className={`${styles.panel} ${styles.heroPanel}`}>
            <div className={styles.eyebrow}>Forestock for Shopify</div>
            <h1 className={styles.heading}>Prevent stockouts without leaving Shopify admin.</h1>
            <p className={styles.text}>
              Forestock turns your Shopify products, inventory, and order history into a clearer restocking workflow. The embedded app focuses on setup, sync verification, and recommendation review while keeping forecast logic aligned with the core Forestock platform.
            </p>
            <ul className={styles.heroList}>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>1</div>
                <div>
                  <p className={styles.heroListTitle}>Connect the store</p>
                  <p className={styles.heroListBody}>Link your Shopify shop to a Forestock workspace with a merchant-friendly first-run flow.</p>
                </div>
              </li>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>2</div>
                <div>
                  <p className={styles.heroListTitle}>Validate the data pipeline</p>
                  <p className={styles.heroListBody}>Import catalog, inventory, and order history so the existing forecast engine has usable commercial data.</p>
                </div>
              </li>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>3</div>
                <div>
                  <p className={styles.heroListTitle}>Review reorder priorities</p>
                  <p className={styles.heroListBody}>See high-risk products, setup gaps, and recommendation readiness directly inside Shopify.</p>
                </div>
              </li>
            </ul>
          </section>

          <aside className={`${styles.panel} ${styles.formPanel}`}>
            <h2 className={styles.formHeading}>Open your store</h2>
            <p className={styles.formText}>
              Enter the shop domain for a store where Forestock is installed.
            </p>
            {showForm && (
              <Form className={styles.form} method="post" action="/auth/login">
                <label className={styles.label}>
                  <span>Shop domain</span>
                  <input className={styles.input} type="text" name="shop" placeholder="example.myshopify.com" autoComplete="on" />
                  <span className={styles.details}>Use the full `myshopify.com` domain.</span>
                </label>
                <button className={styles.button} type="submit">
                  Continue to Shopify
                </button>
              </Form>
            )}
            <p className={styles.smallPrint}>
              Forecasting stays on the same backend logic used by Forestock on the web. This app is the Shopify operating surface for setup, sync, and recommendations.
            </p>
          </aside>
        </div>

        <div className={styles.proofGrid}>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Shopify-first setup</h3>
            <p className={styles.proofBody}>
              Merchants should not need a separate operational console just to understand whether the catalog is synced and the app is ready.
            </p>
          </section>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Shared forecast engine</h3>
            <p className={styles.proofBody}>
              The Shopify app does not use a forked algorithm. It displays the same forecast and recommendation pipeline used by the main Forestock product.
            </p>
          </section>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Operational trust</h3>
            <p className={styles.proofBody}>
              Setup proof, sync evidence, and reorder urgency should be visible enough that a merchant knows what to do next without guessing.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
