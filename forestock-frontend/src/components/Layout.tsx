import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const storeNavItems = [
  { to: '/dashboard',   label: 'Dashboard' },
  { to: '/suggestions', label: 'Suggestions' },
  { to: '/products',    label: 'Products' },
  { to: '/inventory',   label: 'Inventory' },
  { to: '/sales',       label: 'Sales' },
  { to: '/import',      label: 'Import' },
]

const adminNavItems = [
  { to: '/users',    label: 'Users' },
  { to: '/settings', label: 'Settings' },
]

const superAdminNavItems = [
  { to: '/admin', label: 'Platform Admin' },
]

export default function Layout() {
  const { username, role, logout } = useAuth()
  const navigate = useNavigate()

  const isSuperAdmin = role === 'ROLE_SUPER_ADMIN'
  const isAdmin = role === 'ROLE_ADMIN'
  const isManager = role === 'ROLE_MANAGER'

  // Choose nav items based on role
  const navItems = isSuperAdmin
    ? superAdminNavItems
    : [
        ...storeNavItems,
        ...((isAdmin || isManager) ? [{ to: '/slow-movers', label: 'Slow Movers' }] : []),
        ...(isAdmin ? adminNavItems : [{ to: '/settings', label: 'Settings' }]),
      ]

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-indigo-600 tracking-tight">Forestock</span>
          {isSuperAdmin && (
            <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              PLATFORM ADMIN
            </span>
          )}
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{username}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
