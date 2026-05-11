export function resolvePlanChoiceRedirect({
  pathname,
  search = "",
  planChoiceConfirmed,
}: {
  pathname: string;
  search?: string;
  planChoiceConfirmed: boolean;
}) {
  if (!planChoiceConfirmed && pathname !== "/app/plan") {
    return `/app/plan${search}`;
  }

  if (planChoiceConfirmed && pathname === "/app/plan") {
    return `/app${search}`;
  }

  return null;
}
