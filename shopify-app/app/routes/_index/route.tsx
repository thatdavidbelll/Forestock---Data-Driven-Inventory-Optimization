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
            <h1 className={styles.heading}>Run replenishment decisions from inside Shopify Admin.</h1>
            <p className={styles.text}>
              Forestock turns your products, inventory, and order history into a calmer operating surface for setup, sync verification, and reorder review without leaving Shopify.
            </p>
            <ul className={styles.heroList}>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>1</div>
                <div>
                  <p className={styles.heroListTitle}>Connect the store</p>
                  <p className={styles.heroListBody}>Start from Shopify Admin so the shop context and app frame are already in place.</p>
                </div>
              </li>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>2</div>
                <div>
                  <p className={styles.heroListTitle}>Validate the data flow</p>
                  <p className={styles.heroListBody}>Import catalog, inventory, and order history so the forecasting pipeline has usable commercial data.</p>
                </div>
              </li>
              <li className={styles.heroListItem}>
                <div className={styles.heroBullet}>3</div>
                <div>
                  <p className={styles.heroListTitle}>Review recommendations</p>
                  <p className={styles.heroListBody}>Open the restock list, confirm suggested quantities, and export the next purchase order.</p>
                </div>
              </li>
            </ul>
          </section>

          <aside className={`${styles.panel} ${styles.formPanel}`}>
            <h2 className={styles.formHeading}>Open Forestock from Shopify Admin</h2>
            <p className={styles.formText}>
              The embedded app is designed to start from Shopify Admin, where the shop context is already known.
            </p>
            <div className={styles.infoStack}>
              <div className={styles.infoCard}>
                <p className={styles.infoTitle}>Normal path</p>
                <p className={styles.infoBody}>Apps and sales channels {"->"} Forestock {"->"} Open app</p>
              </div>
              <div className={styles.infoCard}>
                <p className={styles.infoTitle}>Why this matters</p>
                <p className={styles.infoBody}>The app should identify the store automatically. Manual shop-domain entry is only a fallback and should not be the primary merchant experience.</p>
              </div>
            </div>
            <p className={styles.smallPrint}>
              Forecasting stays on the same backend logic used by Forestock on the web. This app is the Shopify operating surface for setup, sync, and reorder review.
            </p>
            {showForm ? (
              <p className={styles.smallPrint}>
                If Shopify Admin keeps redirecting here, that points to an auth or config issue we should fix rather than asking the merchant for extra steps.
              </p>
            ) : null}
          </aside>
        </div>

        <div className={styles.proofGrid}>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Billing gate first</h3>
            <p className={styles.proofBody}>
              Merchants should understand the billing requirement immediately, then move into setup and recommendations without hunting for the next step.
            </p>
          </section>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Shared forecast engine</h3>
            <p className={styles.proofBody}>
              The Shopify app surfaces the same recommendation pipeline used by the main Forestock product rather than a simplified fork.
            </p>
          </section>
          <section className={`${styles.panel} ${styles.proofCard}`}>
            <h3 className={styles.proofTitle}>Operational trust</h3>
            <p className={styles.proofBody}>
              Setup proof, sync evidence, and reorder urgency should be visible enough that merchants know what to do next without guessing.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
