export type Verification = 'verified' | 'pending' | 'unverified'

export type AgentRec = {
  id: string
  name: string
  contact: string
  channel: 'phone' | 'email' | 'link'
  status: 'invited' | 'accepted' | 'declined'
  verification: Verification
  active: boolean
  rating: number
  completed: number
  area: string
  joined: string
  synced?: boolean
}

export type FeeState = 'proposed' | 'accepted' | 'rejected' | 'countered'
export type ChatMsg = {
  id: string
  from: 'buyer' | 'agent'
  kind: 'text' | 'image' | 'fee'
  text: string
  attach?: string
  fee?: { amount: number; state: FeeState }
  time: string
}

export const TASK_STATUSES = ['Pending', 'Accepted', 'In Progress', 'Inspection Completed', 'Approved', 'Rejected', 'Cancelled'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export type Report = {
  quality: string
  quantity: string
  measurements: string
  comments: string
  recommendation: 'approve' | 'reject'
  photos: string[]
  videos: string[]
  docs: string[]
  submittedAt: string
  clarifications: string[]
}

export type Assignment = {
  id: string
  txRef?: string
  agentId: string
  kind: string
  desc: string
  seller: string
  goods: string
  location: string
  deadline: string
  fee: number
  /** 'reserved' can only be set by the server when the buyer's escrow is funded. */
  feeStatus: 'none' | 'agreed' | 'reserved'
  status: TaskStatus
  synced: boolean
  created: string
  report?: Report
  deliveryEvidence?: string[]
}

export type Note = { id: string; type: string; text: string; to: string; time: string; read: boolean }

export type Review = {
  id: string
  txRef: string
  target: 'seller' | 'agent' | 'buyer'
  targetId: string
  targetName: string
  stars: number
  text: string
  date: string
  by: string
  synced: boolean
}

export type LocationRec = { id: string; role: string; label: string; precise: string; approx: string; synced: boolean }

export type Dispute = {
  id: string
  txRef: string
  type: string
  text: string
  evidence: string[]
  refund: boolean
  status: string
  synced: boolean
  date: string
}

export const DELIVERY_STATUSES = ['Awaiting Dispatch', 'Dispatched', 'In Transit', 'Arrived at Destination', 'Awaiting Buyer Confirmation', 'Completed', 'Disputed', 'Returned'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]
