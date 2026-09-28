import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import AIStyleMatch from './pages/AIStyleMatch'
import ProductDetail from './pages/ProductDetail'
import SellerHub from './pages/SellerHub'
import HowItWorks from './pages/HowItWorks'
import Register from './pages/Register'
import Login from './pages/Login'
import MyCloset from './pages/MyCloset'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import { MarketplaceProvider } from './context/MarketplaceContext'
import { useMarketplace } from './context/useMarketplace'

function AccountRoute({ role, children }) {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  if (!account) return <Navigate to="/login" replace />
  if (account.role !== role) return <Navigate to={account.role === 'business' ? '/business' : '/'} replace />
  return children
}

function HomeRoute() {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  if (!account) return <Navigate to="/login" replace />
  if (account.role === 'admin') return <Navigate to="/admin" replace />
  if (account.role === 'business') return <Navigate to="/business" replace />
  return <Home />
}

function SignedInRoute({ children }) {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  if (!account) return <Navigate to="/login" replace />
  if (account.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function AdminRoute({ children }) {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  if (!account) return <Navigate to="/login" replace />
  if (account.role !== 'admin') return <Navigate to={account.role === 'business' ? '/business' : '/'} replace />
  return children
}

function WorkspaceRedirect() {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  if (!account) return <Navigate to="/login" replace />
  return <Navigate to={account.role === 'admin' ? '/admin' : account.role === 'business' ? '/business' : '/my-closet'} replace />
}

function RouteFallback() {
  const { account, isLoading } = useMarketplace()
  if (isLoading) return <div className="auth-loading" role="status">Loading your ReWear space…</div>
  return <Navigate to={!account ? '/login' : account.role === 'admin' ? '/admin' : account.role === 'business' ? '/business' : '/'} replace />
}

function AppRoutes() {
  const { account } = useMarketplace()
  const location = useLocation()
  const navigate = useNavigate()
  const initialRouteHandled = useRef(false)
  const routeRecoveryInProgress = useRef(false)

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    if (routeRecoveryInProgress.current) {
      if (location.pathname === '/') return
      routeRecoveryInProgress.current = false
    }
    if (!initialRouteHandled.current) {
      initialRouteHandled.current = true
      const navigationType = window.performance?.getEntriesByType?.('navigation')?.[0]?.type
      if (navigationType === 'reload' && location.pathname === '/') {
        try {
          const previousPath = window.sessionStorage.getItem('rewear:current-route')
          if (previousPath?.startsWith('/') && !previousPath.startsWith('//') && previousPath !== '/') {
            routeRecoveryInProgress.current = true
            navigate(previousPath, { replace: true })
            return
          }
        } catch {
          // Continue at the current route if session storage is unavailable.
        }
      }
    }
    try {
      window.sessionStorage.setItem('rewear:current-route', currentPath)
    } catch {
      // The app remains navigable when browser storage is unavailable.
    }
  }, [location.hash, location.pathname, location.search, navigate])

  return (
    <>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRoute />} />
          <Route path="/browse" element={<SignedInRoute><Home /></SignedInRoute>} />
          <Route path="/ai-outfit-discovery" element={<AccountRoute role="personal"><AIStyleMatch /></AccountRoute>} />
          <Route path="/ai-style-match" element={<Navigate to="/ai-outfit-discovery" replace />} />
          <Route path="/product/:id" element={<SignedInRoute><ProductDetail key={location.pathname} /></SignedInRoute>} />
          <Route path="/my-closet" element={<AccountRoute role="personal"><MyCloset /></AccountRoute>} />
          <Route path="/profile" element={account ? <Profile /> : <Navigate to="/login" replace />} />
          <Route path="/business" element={<AccountRoute role="business"><SellerHub /></AccountRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/seller-hub" element={<WorkspaceRedirect />} />
          <Route path="/how-it-works" element={<AccountRoute role="personal"><HowItWorks /></AccountRoute>} />
          <Route path="*" element={<RouteFallback />} />
        </Routes>
      </main>
      {!['business', 'admin'].includes(account?.role) && !['/register', '/login'].includes(location.pathname) && <Footer />}
    </>
  )
}

function App() {
  return (
    <MarketplaceProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MarketplaceProvider>
  )
}

export default App
