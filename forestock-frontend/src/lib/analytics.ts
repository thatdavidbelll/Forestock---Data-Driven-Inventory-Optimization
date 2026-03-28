type PostHogProperties = Record<string, string | number | boolean | null | undefined>

type PostHogClient = {
  capture: (eventName: string, properties?: PostHogProperties) => void
  identify: (distinctId: string, properties?: PostHogProperties) => void
  reset: () => void
}

declare global {
  interface Window {
    posthog?: PostHogClient
  }
}

function getPostHog(): PostHogClient | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.posthog ?? null
}

export function captureEvent(eventName: string, properties?: PostHogProperties) {
  getPostHog()?.capture(eventName, properties)
}

export function identifyUser(distinctId: string, properties?: PostHogProperties) {
  getPostHog()?.identify(distinctId, properties)
}

export function resetAnalytics() {
  getPostHog()?.reset()
}
