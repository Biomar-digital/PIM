import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Check, ChevronDown, ClipboardCheck, FolderOpen, Globe2, Home, LayoutGrid, Menu, Plus, Search, Settings, X,
} from 'lucide-react'
import { MARKETS, ROLE_LABEL, marketLabel } from '../data/reference'
import { can } from '../data/rules'
import { currentUser, setContext, setUser, useStore } from '../data/store'
import { Avatar, Toasts, useClickOutside } from './ui'
import { NewProductModal } from './NewProductModal'
import { BIOMAR_LOGO } from '../lib/logos'

export function Logo() {
  return BIOMAR_LOGO ? <img src={BIOMAR_LOGO.url} alt="BioMar" className="brand-logo" /> : <strong>BioMar</strong>
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reviewCount = useStore((s) => s.db.products).reduce(
    (n, p) => n + [p.info.status, p.marketing.meta.status, ...Object.values(p.variants).map((v) => v.meta.status)].filter((s) => s === 'in_review').length,
    0,
  )
  const items = [
    { to: '/', label: 'Overview', icon: Home, end: true },
    { to: '/products', label: 'Product library', icon: LayoutGrid },
    { to: '/assets', label: 'Asset library', icon: FolderOpen },
    { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, badge: reviewCount },
    { to: '/markets', label: 'Markets & languages', icon: Globe2 },
  ]
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <Logo />
        <div className="sidebar-app">Product Information</div>
        <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="sidebar-nav" onClick={onClose}>
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={18} aria-hidden />
            <span>{label}</span>
            {!!badge && <span className="nav-badge">{badge}</span>}
          </NavLink>
        ))}
      </nav>
      <nav className="sidebar-nav sidebar-bottom" onClick={onClose}>
        <NavLink to="/admin" className="nav-item"><Settings size={18} aria-hidden /><span>Administration</span></NavLink>
      </nav>
    </aside>
  )
}

/** The working-context switcher: global master data or a market/language variant. Mirrors the portal's market selector. */
function ContextSwitcher() {
  const context = useStore((s) => s.context)
  const user = useStore(currentUser)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  const mine = user.markets
  const list = useMemo(() => {
    const f = MARKETS.filter((m) => `${m.market} ${m.language} ${m.id}`.toLowerCase().includes(q.toLowerCase()))
    return [...f.filter((m) => mine.includes(m.id)), ...f.filter((m) => !mine.includes(m.id))]
  }, [q, mine])
  const pick = (id: string) => { setContext(id); setOpen(false); setQ('') }
  return (
    <div className="ctx" ref={ref}>
      <button className={`ctx-btn${context !== 'global' ? ' ctx-local' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        <span className="ctx-text">
          <span className="ctx-kicker">{context === 'global' ? 'Working in global master data' : 'Working in market variant'}</span>
          <span className="ctx-value">{marketLabel(context)}</span>
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>
      {open && (
        <div className="ctx-menu" role="listbox">
          <button className={`ctx-opt${context === 'global' ? ' sel' : ''}`} onClick={() => pick('global')}>
            <Globe2 size={16} /> <span><strong>Global</strong> – English (master)</span>
            {context === 'global' && <Check size={16} className="ctx-check" />}
          </button>
          <div className="ctx-search">
            <Search size={14} />
            <input autoFocus placeholder="Find market or language" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ctx-list">
            {list.map((m, i) => (
              <div key={m.id}>
                {i === 0 && mine.length > 0 && mine.includes(m.id) && <div className="ctx-group">Your markets</div>}
                {mine.length > 0 && i === list.findIndex((x) => !mine.includes(x.id)) && <div className="ctx-group">All markets</div>}
                <button className={`ctx-opt${context === m.id ? ' sel' : ''}`} onClick={() => pick(m.id)}>
                  <span className="ctx-code">{m.id}</span>
                  <span><strong>{m.market}</strong> – {m.language}</span>
                  {context === m.id && <Check size={16} className="ctx-check" />}
                </button>
              </div>
            ))}
          </div>
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
          <div className="user-pop-head">Prototype: view the tool as…</div>
          {users.map((u) => (
            <button key={u.id} className={`user-opt${u.id === user.id ? ' sel' : ''}`} onClick={() => { setUser(u.id); setOpen(false) }}>
              <Avatar name={u.name} size={28} />
              <span>
                <span className="user-name">{u.name}</span>
                <span className="user-role">{ROLE_LABEL[u.role]}{u.markets.length ? ` · ${u.markets.map((m) => marketLabel(m, true)).join(', ')}` : ''}</span>
              </span>
              {u.id === user.id && <Check size={16} className="ctx-check" />}
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
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={22} /></button>
          <ContextSwitcher />
          <div className="topbar-right">
            <UserMenu />
            {can.createProduct(user) && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={18} aria-hidden /> <span className="hide-sm">New product</span>
              </button>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {creating && <NewProductModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); navigate(`/products/${id}`) }} />}
      <Toasts />
    </div>
  )
}
