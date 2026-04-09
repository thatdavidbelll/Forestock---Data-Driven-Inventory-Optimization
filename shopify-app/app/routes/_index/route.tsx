import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import {
  embeddedAppRedirectTarget,
  hasShopifyEmbeddedContext,
  logEmbeddedAuthContext,
} from "../../embedded-auth.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  logEmbeddedAuthContext(request, "entry");
  const url = new URL(request.url);

  if (hasShopifyEmbeddedContext(url)) {
    throw redirect(embeddedAppRedirectTarget(url));
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
            <h2 className={styles.formHeading}>Open Forestock from Shopify Admin</h2>
            <p className={styles.formText}>
              Forestock is designed to start from the Shopify Admin app entry, where the shop context is already known.
            </p>
            <div className={styles.infoStack}>
              <div className={styles.infoCard}>
                <p className={styles.infoTitle}>Normal path</p>
                <p className={styles.infoBody}>Apps and sales channels {"->"} Forestock {"->"} Open app</p>
              </div>
              <div className={styles.infoCard}>
                <p className={styles.infoTitle}>Why this matters</p>
                <p className={styles.infoBody}>The embedded app should identify the store automatically. Manual shop-domain entry is only a fallback and should not be the primary experience.</p>
              </div>
            </div>
            <p className={styles.smallPrint}>
              Forecasting stays on the same backend logic used by Forestock on the web. This app is the Shopify operating surface for setup, sync, and recommendations.
            </p>
            {showForm ? (
              <p className={styles.smallPrint}>
                If Shopify Admin still redirects here unexpectedly, that indicates an auth/config issue we should fix rather than asking the merchant for a store link.
              </p>
            ) : null}
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
