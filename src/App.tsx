import { Navigate, Route, Routes } from 'react-router-dom'
import { ReactNode } from 'react'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import { Loading } from './ui'
import Home from './pages/Home'
import { Login, Register } from './pages/Auth'
import Marketplace from './pages/Marketplace'
import ProductDetail from './pages/ProductDetail'
import Orders from './pages/Orders'
import Messages from './pages/Messages'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import { ConfirmPay, ConfirmRelease, PlaceOrder, SendAgent, TrackOrder } from './pages/OrderFlow'
import { WalletPage, Withdraw } from './pages/Wallet'
import { SellerOrders, SellerProducts } from './pages/SellerPages'
import { AgentEarnings, AgentTask, AgentTasks } from './pages/AgentPages'
import { Disputes, Notifications, Profile, Settings, Support, Verification } from './pages/Account'

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  // Test accounts may open the admin preview; real accounts need the admin flag.
  if (admin && !isAdmin && !(session.user as any).demo) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

const G = (el: ReactNode) => <Guard>{el}</Guard>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="orders" element={G(<Orders />)} />
        <Route path="messages" element={G(<Messages />)} />
        <Route path="dashboard" element={G(<Dashboard />)} />
        <Route path="admin" element={<Guard admin><Admin /></Guard>} />

        <Route path="order/new" element={G(<PlaceOrder />)} />
        <Route path="order/agent" element={G(<SendAgent />)} />
        <Route path="order/pay" element={G(<ConfirmPay />)} />
        <Route path="order/track" element={G(<TrackOrder />)} />
        <Route path="order/confirm" element={G(<ConfirmRelease />)} />
        <Route path="wallet" element={G(<WalletPage />)} />
        <Route path="wallet/withdraw" element={G(<Withdraw />)} />
        <Route path="seller/products" element={G(<SellerProducts />)} />
        <Route path="seller/orders" element={G(<SellerOrders />)} />
        <Route path="agent/tasks" element={G(<AgentTasks key="tasks" />)} />
        <Route path="agent/deliveries" element={G(<AgentTasks key="deliveries" initial="Deliveries" />)} />
        <Route path="agent/tasks/:id" element={G(<AgentTask />)} />
        <Route path="agent/earnings" element={G(<AgentEarnings />)} />
        <Route path="notifications" element={G(<Notifications />)} />
        <Route path="settings" element={G(<Settings />)} />
        <Route path="support" element={G(<Support />)} />
        <Route path="disputes" element={G(<Disputes />)} />
        <Route path="verification" element={G(<Verification />)} />
        <Route path="profile" element={G(<Profile />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
