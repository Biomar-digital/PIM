import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './data/store'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductPage from './pages/ProductPage'
import People from './pages/People'

// HashRouter keeps the prototype working as a single static file (no server routing needed).
export default function App() {
  const ready = useStore((s) => s.ready)
  if (!ready) return <div className="boot">Loading product information</div>
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/products/:id/:tab" element={<ProductPage />} />
          <Route path="/people" element={<People />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
