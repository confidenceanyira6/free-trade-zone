import { useEffect, useState } from 'react'
import { Home, ClipboardList, Wallet, User, MessageSquare, LayoutDashboard, ListChecks, Truck, Coins } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from './auth'

export type Role = 'buyer' | 'seller' | 'agent'

// Existing backend `account_type` values that each role maps onto.
export const ROLE_TYPE: Record<Role, string> = { buyer: 'importer', seller: 'supplier', agent: 'logistics' }

const KEY = 'saage_preview_role'
const listeners = new Set<() => void>()

function readOverride(): Role | null {
  try { return localStorage.getItem(KEY) as Role | null } catch { return null }
}

/** Lets a signed-in user preview the buyer / seller / agent experience. */
export function setPreviewRole(r: Role) {
  try { localStorage.setItem(KEY, r) } catch { /* storage unavailable */ }
  listeners.forEach((l) => l())
}

export function useRole(): Role {
  const { session } = useAuth()
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  const meta = session?.user?.user_metadata?.saage_role as Role | undefined
  return readOverride() || meta || 'buyer'
}

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

// Bottom navigation, matching the app mock-up.
export const NAV: Record<Role, NavItem[]> = {
  buyer: [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    { to: '/wallet', label: 'Wallet', icon: Wallet },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/profile', label: 'Profile', icon: User },
  ],
  seller: [
    { to: '/dashboard', label: 'Home', icon: Home },
    { to: '/seller/orders', label: 'Orders', icon: ClipboardList },
    { to: '/wallet', label: 'Wallet', icon: Wallet },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/profile', label: 'Profile', icon: User },
  ],
  agent: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/agent/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/agent/deliveries', label: 'Deliveries', icon: Truck },
    { to: '/agent/earnings', label: 'Earnings', icon: Coins },
    { to: '/profile', label: 'Profile', icon: User },
  ],
}

// Slide-out menu (hamburger) per role.
export const MENU: Record<Role, [string, string][]> = {
  buyer: [['Dashboard', '/dashboard'], ['Browse Products', '/marketplace'], ['My Orders', '/orders'], ['Inspection Agents', '/order/agent'], ['Wallet', '/wallet'], ['Messages', '/messages'], ['Disputes', '/disputes'], ['Notifications', '/notifications'], ['Business Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
  seller: [['Dashboard', '/dashboard'], ['My Products', '/seller/products'], ['Manage Orders', '/seller/orders'], ['Wallet', '/wallet'], ['Messages', '/messages'], ['Disputes', '/disputes'], ['Notifications', '/notifications'], ['Business Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
  agent: [['Dashboard', '/dashboard'], ['Tasks', '/agent/tasks'], ['Deliveries', '/agent/deliveries'], ['Earnings', '/agent/earnings'], ['Messages', '/messages'], ['Notifications', '/notifications'], ['Agent Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
}
