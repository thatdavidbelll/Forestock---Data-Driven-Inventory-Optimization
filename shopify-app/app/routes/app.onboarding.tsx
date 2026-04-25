import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

function settingsRedirect(url: URL) {
  return `/app/settings${url.search}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  throw redirect(settingsRedirect(new URL(request.url)));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  throw redirect(settingsRedirect(new URL(request.url)));
};

export default function OnboardingPage() {
  return null;
}
