import { Navigate, Route, Routes } from 'react-router-dom'
import { ReactNode } from 'react'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import { Loading } from './ui'
import Home from './pages/Home'
import { Login, Register } from './pages/Auth'
import Marketplace from './pages/Marketplace'
import ProductDetail from './pages/ProductDetail'
import Messages from './pages/Messages'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import { WalletPage, Withdraw } from './pages/Wallet'
import { SellerProducts } from './pages/SellerPages'
import { AgentEarnings } from './pages/AgentPages'
import { Profile, Settings, Support, Verification } from './pages/Account'
import { AgentChatPage, AgentProfile, BuyerAgentChatPage, MyAgents, MyBuyer } from './pages/Agents'
import { AssignmentDetail, AssignmentNew, AssignmentsList } from './pages/Assignments'
import { EscrowPage, TransactionDetail, TransactionNew, TransactionsList } from './pages/Transactions'
import { DisputesPage, LocationsPage, NotificationsPage, ReviewsPage, SellerProfile } from './pages/Trust'

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  // Test accounts may open the admin preview; real accounts need the admin flag (checked again on the server).
  if (admin && !isAdmin && !(session.user as any).demo) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

const G = (el: ReactNode) => <Guard>{el}</Guard>
const Tx = <Navigate to="/transactions/tx-1" replace />

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="messages" element={G(<Messages />)} />
        <Route path="dashboard" element={G(<Dashboard />)} />
        <Route path="admin" element={<Guard admin><Admin /></Guard>} />

        {/* buyer-owned agents, negotiation, assignments */}
        <Route path="agents" element={G(<MyAgents />)} />
        <Route path="agents/:id" element={G(<AgentProfile />)} />
        <Route path="agents/:id/chat" element={G(<BuyerAgentChatPage />)} />
        <Route path="assignments" element={G(<AssignmentsList />)} />
        <Route path="assignments/new" element={G(<AssignmentNew />)} />
        <Route path="assignments/:id" element={G(<AssignmentDetail />)} />

        {/* transactions, escrow, delivery */}
        <Route path="orders" element={G(<TransactionsList />)} />
        <Route path="seller/orders" element={G(<TransactionsList />)} />
        <Route path="transactions" element={G(<TransactionsList />)} />
        <Route path="transactions/new" element={G(<TransactionNew />)} />
        <Route path="transactions/:id" element={G(<TransactionDetail />)} />
        <Route path="escrow" element={G(<EscrowPage />)} />
        <Route path="order/new" element={G(<TransactionNew />)} />
        <Route path="order/agent" element={<Navigate to="/agents" replace />} />
        <Route path="order/pay" element={G(Tx)} />
        <Route path="order/track" element={G(Tx)} />
        <Route path="order/confirm" element={G(Tx)} />

        {/* agent */}
        <Route path="agent/buyer" element={G(<MyBuyer />)} />
        <Route path="agent/chat" element={G(<AgentChatPage />)} />
        <Route path="agent/tasks" element={G(<AssignmentsList />)} />
        <Route path="agent/tasks/:id" element={G(<AssignmentDetail />)} />
        <Route path="agent/deliveries" element={G(<TransactionsList />)} />
        <Route path="agent/earnings" element={G(<AgentEarnings />)} />

        {/* seller + shared */}
        <Route path="seller/products" element={G(<SellerProducts />)} />
        <Route path="sellers/:id" element={G(<SellerProfile />)} />
        <Route path="wallet" element={G(<WalletPage />)} />
        <Route path="wallet/withdraw" element={G(<Withdraw />)} />
        <Route path="locations" element={G(<LocationsPage />)} />
        <Route path="disputes" element={G(<DisputesPage />)} />
        <Route path="reviews" element={G(<ReviewsPage />)} />
        <Route path="notifications" element={G(<NotificationsPage />)} />
        <Route path="settings" element={G(<Settings />)} />
        <Route path="support" element={G(<Support />)} />
        <Route path="verification" element={G(<Verification />)} />
        <Route path="profile" element={G(<Profile />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
