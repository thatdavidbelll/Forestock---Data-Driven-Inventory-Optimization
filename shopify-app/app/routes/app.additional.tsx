export default function AdditionalPage() {
  return (
    <s-page heading="Using Forestock in Shopify">
      <s-section heading="Shopify-first merchant workflow">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            For Shopify merchants, Forestock is intended to be used primarily through this embedded Shopify app.
          </s-paragraph>
          <s-paragraph>
            Installing the app links your Shopify store, prepares your Forestock workspace, and starts bringing product, inventory, and order data into Forestock.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="What merchants should expect">
        <s-unordered-list>
          <s-list-item>Shopify is the primary entry point for setup and sync status.</s-list-item>
          <s-list-item>Forestock prepares a linked workspace behind the scenes for forecasting and restocking logic.</s-list-item>
          <s-list-item>Manual support may still be used during the pilot if setup or sync needs intervention.</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Current pilot note">
        <s-paragraph>
          The Shopify flow is being hardened as a dedicated readiness track. During the current pilot phase, support may still help merchants complete setup if sync or provisioning needs attention.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
