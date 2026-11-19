import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useRole } from '../lib/roles'
import RoleDash from './RoleDash'
import { card } from '../ui'

export default function Dashboard() {
  const { companies } = useAuth()
  const role = useRole()
  const company = companies[0]
  const verified = company?.verification_status === 'verified'
  return (
    <div className="space-y-3">
      <RoleDash role={role} />
      <Link to="/verification" className={`${card} flex items-center gap-3 text-sm`}>
        <BadgeCheck className={verified ? 'text-emerald' : 'text-amber-500'} size={20} />
        <span className="flex-1"><b>{company?.name ?? 'Your business'}</b><span className="block text-xs text-muted">{verified ? 'Business verified' : 'Verify your business to build trust'}</span></span>
        <span className="text-xs font-semibold text-emerald">Manage ›</span>
      </Link>
    </div>
  )
}
