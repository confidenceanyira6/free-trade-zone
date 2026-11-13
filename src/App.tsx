import { Navigate, Route, Routes } from 'react-router-dom'
import { ReactNode } from 'react'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import { Loading } from './ui'
import Home from './pages/Home'
import { Login, Register } from './pages/Auth'
import Marketplace from './pages/Marketplace'
import ProductDetail from './pages/ProductDetail'
import Rfqs from './pages/Rfqs'
import RfqDetail from './pages/RfqDetail'
import Orders from './pages/Orders'
import Messages from './pages/Messages'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="rfqs" element={<Guard><Rfqs /></Guard>} />
        <Route path="rfqs/:id" element={<Guard><RfqDetail /></Guard>} />
        <Route path="orders" element={<Guard><Orders /></Guard>} />
        <Route path="messages" element={<Guard><Messages /></Guard>} />
        <Route path="dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="admin" element={<Guard admin><Admin /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
