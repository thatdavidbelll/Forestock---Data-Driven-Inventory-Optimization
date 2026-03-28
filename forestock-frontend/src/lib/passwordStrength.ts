export interface PasswordRule {
  label: string
  met: boolean
}

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'lowercase letter', met: /[a-z]/.test(password) },
    { label: 'number', met: /\d/.test(password) },
    { label: 'special character (@$!%*?&_-#)', met: /[@$!%*?&_\-#]/.test(password) },
  ]
}

export function isStrongPassword(password: string): boolean {
  return getPasswordRules(password).every((rule) => rule.met)
}
