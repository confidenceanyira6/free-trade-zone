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

/** Lets a signed-in test user preview the buyer / seller / agent experience. */
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
  buyer: [['Dashboard', '/dashboard'], ['My Agents', '/agents'], ['My Assignments', '/assignments'], ['Active Transactions', '/orders'], ['Escrow Wallet', '/escrow'], ['Browse Products', '/marketplace'], ['Disputes', '/disputes'], ['Reviews', '/reviews'], ['My Locations', '/locations'], ['Notifications', '/notifications'], ['Business Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
  seller: [['Dashboard', '/dashboard'], ['Incoming Orders', '/seller/orders'], ['My Products', '/seller/products'], ['Escrow Status', '/escrow'], ['Wallet', '/wallet'], ['Disputes', '/disputes'], ['Buyer Reviews', '/reviews'], ['My Locations', '/locations'], ['Messages', '/messages'], ['Notifications', '/notifications'], ['Business Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
  agent: [['Dashboard', '/dashboard'], ['My Buyer', '/agent/buyer'], ['Assigned Tasks', '/agent/tasks'], ['Buyer Chat & Fees', '/agent/chat'], ['Deliveries', '/agent/deliveries'], ['Secured Payments', '/escrow'], ['Earnings', '/agent/earnings'], ['Reviews', '/reviews'], ['My Locations', '/locations'], ['Notifications', '/notifications'], ['Agent Verification', '/verification'], ['Settings', '/settings'], ['Help & Support', '/support']],
}
