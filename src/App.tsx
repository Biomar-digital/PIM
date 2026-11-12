import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './data/store'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductPage from './pages/ProductPage'
import TranslationPage from './pages/TranslationPage'
import Files from './pages/Files'
import Approvals from './pages/Approvals'
import Markets from './pages/Markets'
import Admin from './pages/Admin'

// HashRouter keeps the prototype working as a single static file (no server routing needed).
export default function App() {
  const ready = useStore((s) => s.ready)
  if (!ready) return <div className="boot">Loading product information</div>
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/products/:id/translations/:locale" element={<TranslationPage />} />
          <Route path="/products/:id/:tab" element={<ProductPage />} />
          <Route path="/files" element={<Files />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
