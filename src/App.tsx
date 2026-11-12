import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './data/store'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import ProductPage from './pages/ProductPage'
import AssetLibrary from './pages/AssetLibrary'
import Approvals from './pages/Approvals'
import Markets from './pages/Markets'
import Admin from './pages/Admin'

// HashRouter keeps the prototype working as a static file anywhere (no server routing needed).
export default function App() {
  const ready = useStore((s) => s.ready)
  if (!ready) return <div className="boot">Loading product information…</div>
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Library />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/products/:id/:tab" element={<ProductPage />} />
          <Route path="/assets" element={<AssetLibrary />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
