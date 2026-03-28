import { getPasswordRules } from '../lib/passwordStrength'

export default function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) {
    return null
  }

  const rules = getPasswordRules(password)

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
      <p className="text-xs font-medium text-gray-600 mb-2">Password requirements</p>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {rules.map((rule) => (
          <div
            key={rule.label}
            className={`text-xs flex items-center gap-1 ${rule.met ? 'text-green-700' : 'text-red-600'}`}
          >
            <span aria-hidden="true">{rule.met ? '\u2713' : '\u2717'}</span>
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
