import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ClipboardCheck, FolderOpen, Globe2, Home, LayoutGrid, Menu as MenuIcon, Plus, Search, Settings, X } from 'lucide-react'
import { ROLE_LABEL, marketLabel } from '../data/reference'
import { can } from '../data/rules'
import { currentUser, setUser, useStore } from '../data/store'
import { BIOMAR_LOGO } from '../lib/logos'
import { productImage } from '../lib/files'
import { Avatar, Thumb, Toasts, useClickOutside } from './ui'
import { NewProductModal } from './NewProductModal'

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const waiting = useMemo(
    () => products.reduce((n, p) => n + [p.status.status, ...Object.values(p.variants).map((v) => v.meta.status)].filter((s) => s === 'in_review').length, 0),
    [products],
  )
  const items = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/products', label: 'Products', icon: LayoutGrid },
    { to: '/files', label: 'Files', icon: FolderOpen },
    { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, badge: can.approve(user) ? waiting : 0 },
    { to: '/markets', label: 'Markets', icon: Globe2 },
  ]
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        {BIOMAR_LOGO ? <img src={BIOMAR_LOGO.url} alt="BioMar" className="brand-logo" /> : <strong>BioMar</strong>}
        <div className="sidebar-app">Product Information</div>
        <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="sidebar-nav" onClick={onClose}>
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={18} aria-hidden />
            <span>{label}</span>
            {!!badge && <span className="nav-badge" title={`${badge} waiting for approval`}>{badge}</span>}
          </NavLink>
        ))}
      </nav>
      <nav className="sidebar-nav sidebar-bottom" onClick={onClose}>
        <NavLink to="/admin" className="nav-item"><Settings size={18} aria-hidden /><span>Administration</span></NavLink>
      </nav>
    </aside>
  )
}

/** Quick product finder in the top bar */
function QuickSearch() {
  const products = useStore((s) => s.db.products)
  const blobUrls = useStore((s) => s.blobUrls)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  const navigate = useNavigate()
  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return products.filter((p) => terms.every((t) => `${p.name} ${p.species} ${p.range}`.toLowerCase().includes(t))).slice(0, 7)
  }, [q, products])
  const go = (path: string) => { setQ(''); setOpen(false); navigate(path) }
  return (
    <div className="qs" ref={ref}>
      <label className="qs-box">
        <Search size={18} aria-hidden />
        <input
          id="quick-search" type="search" placeholder="Find a product" value={q} autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(hits.length === 1 ? `/products/${hits[0].id}` : `/products?q=${encodeURIComponent(q)}`)
            if (e.key === 'Escape') setOpen(false)
          }}
          aria-label="Find a product"
        />
      </label>
      {open && q.trim() && (
        <div className="qs-pop">
          {hits.map((p) => (
            <button key={p.id} className="qs-hit" onClick={() => go(`/products/${p.id}`)}>
              <Thumb url={productImage(p, blobUrls)} size={32} />
              <span><strong>{p.name}</strong> – {p.species}<span className="muted small block">{p.range}</span></span>
            </button>
          ))}
          {!hits.length && <p className="muted small qs-none">No products match “{q}”.</p>}
          <button className="qs-all" onClick={() => go(`/products?q=${encodeURIComponent(q)}`)}>See all results in Products</button>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const user = useStore(currentUser)
  const users = useStore((s) => s.db.users)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Avatar name={user.name} size={30} />
        <span className="user-text">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="user-pop">
          <div className="user-pop-head">Prototype: see the tool as</div>
          {users.map((u) => (
            <button key={u.id} className={`user-opt${u.id === user.id ? ' sel' : ''}`} onClick={() => { setUser(u.id); setOpen(false) }}>
              <Avatar name={u.name} size={28} />
              <span>
                <span className="user-name">{u.name}</span>
                <span className="user-role">{ROLE_LABEL[u.role]}{u.markets.length ? `, ${u.markets.map((m) => marketLabel(m, true)).join(', ')}` : ''}</span>
              </span>
              {u.id === user.id && <Check size={16} className="check-ic" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  const [creating, setCreating] = useState(false)
  const user = useStore(currentUser)
  const navigate = useNavigate()
  return (
    <div className="app">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><MenuIcon size={22} /></button>
          <QuickSearch />
          <div className="topbar-right">
            {can.createProduct(user) && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={18} aria-hidden /><span className="hide-sm">New product</span>
              </button>
            )}
            <UserMenu />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {creating && <NewProductModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); navigate(`/products/${id}`) }} />}
      <Toasts />
    </div>
  )
}
