import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Cloud, HardDrive, LayoutDashboard, Menu as MenuIcon, Package, Plus, Search, Star, Users, X } from 'lucide-react'
import { GLOBAL, MARKET_BY_ID, REGIONS, ROLE_LABEL, localeCode, localeLanguage, marketLabel } from '../data/reference'
import { can, isGlobalUser, userLocales } from '../data/rules'
import { currentUser, setLocale, setUser, updateUser, useStore } from '../data/store'
import { productsIn } from '../data/insights'
import { BIOMAR_LOGO } from '../lib/logos'
import { productImage } from '../lib/files'
import { Avatar, Thumb, Toasts, useClickOutside } from './ui'
import { NewProductModal } from './NewProductModal'

export const localeName = (id: string) => (id === GLOBAL ? 'Global' : MARKET_BY_ID[id]?.market ?? id)

export function LocaleCode({ id }: { id: string }) {
  return <span className={`loc-code${id === GLOBAL ? ' global' : ''}`} aria-hidden>{localeCode(id)}</span>
}

/** Locale picker: the whole PIM follows the selected locale. */
function LocalePicker() {
  const user = useStore(currentUser)
  const locale = useStore((s) => s.locale)
  const products = useStore((s) => s.db.products)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  const allowed = userLocales(user)
  const count = useMemo(() => Object.fromEntries(allowed.map((l) => [l, productsIn(products, l).length])), [products, allowed])
  const mine = isGlobalUser(user) ? [GLOBAL] : allowed
  const others = isGlobalUser(user) ? allowed.filter((l) => l !== GLOBAL) : []
  const pick = (l: string) => { setLocale(l); setOpen(false) }
  const option = (l: string) => (
    <button key={l} role="option" aria-selected={l === locale} className={`loc-opt${l === locale ? ' sel' : ''}`} onClick={() => pick(l)}>
      <LocaleCode id={l} />
      <span className="grow">{localeName(l)}<span className="muted small"> {localeLanguage(l)}</span></span>
      {l === user.defaultLocale && <Star size={13} className="muted" aria-label="Your default" />}
      <span className="muted small num">{count[l]}</span>
    </button>
  )
  return (
    <div className="loc-picker" ref={ref}>
      <span className="loc-label">Locale</span>
      <button className="loc-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" id="locale-picker">
        <LocaleCode id={locale} />
        <span className="loc-btn-text">
          <strong>{localeName(locale)}</strong>
          <span>{localeLanguage(locale)} · {count[locale] ?? 0} products</span>
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="loc-pop" role="listbox" aria-label="Choose a locale">
          <div className="loc-group">{isGlobalUser(user) ? 'Master record' : 'Your locales'}</div>
          {mine.map(option)}
          {others.length > 0 && REGIONS.map((r) => {
            const list = others.filter((l) => MARKET_BY_ID[l]?.region === r)
            return list.length ? <div key={r}><div className="loc-group">{r}</div>{list.map(option)}</div> : null
          })}
          {locale !== user.defaultLocale && (
            <button className="loc-default" onClick={() => { updateUser(user.id, { defaultLocale: locale }); setOpen(false) }}>
              <Star size={14} />Open the PIM in {localeName(locale)} by default
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const storage = useStore((s) => s.storage)
  const saving = useStore((s) => s.saving)
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/products', label: 'Products', icon: Package },
  ]
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        {BIOMAR_LOGO ? <img src={BIOMAR_LOGO.url} alt="BioMar" className="brand-logo" /> : <strong>BioMar</strong>}
        <div className="sidebar-app">Product Information</div>
        <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>
      <LocalePicker />
      <nav className="sidebar-nav" onClick={onClose}>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={18} aria-hidden /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <nav className="sidebar-nav" onClick={onClose}>
          <NavLink to="/people" className="nav-item"><Users size={18} aria-hidden /><span>People and access</span></NavLink>
        </nav>
        <p className="storage" title={storage === 'shared' ? 'Everyone with the link sees the same products and changes, live.' : 'Running outside claude.ai: changes are kept in this browser only.'}>
          {storage === 'shared' ? <Cloud size={14} /> : <HardDrive size={14} />}
          {storage === 'shared' ? (saving ? 'Saving…' : 'Shared data, saved') : 'Saved in this browser only'}
        </p>
      </div>
    </aside>
  )
}

/** Quick product finder in the top bar, within the selected locale */
function QuickSearch() {
  const all = useStore((s) => s.db.products)
  const locale = useStore((s) => s.locale)
  const products = useMemo(() => productsIn(all, locale), [all, locale])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  const navigate = useNavigate()
  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return products.filter((p) => terms.every((t) => `${p.name} ${p.species} ${p.range} ${p.code}`.toLowerCase().includes(t))).slice(0, 7)
  }, [q, products])
  const go = (path: string) => { setQ(''); setOpen(false); navigate(path) }
  return (
    <div className="qs" ref={ref}>
      <label className="qs-box">
        <Search size={18} aria-hidden />
        <input
          id="quick-search" type="search" placeholder={`Search products in ${localeName(locale)}`} value={q} autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(hits.length === 1 ? `/products/${hits[0].id}` : `/products?q=${encodeURIComponent(q)}`)
            if (e.key === 'Escape') setOpen(false)
          }}
          aria-label="Search products"
        />
      </label>
      {open && q.trim() && (
        <div className="qs-pop">
          {hits.map((p) => (
            <button key={p.id} className="qs-hit" onClick={() => go(`/products/${p.id}`)}>
              <Thumb url={productImage(p)} size={32} />
              <span><strong>{p.name}</strong> – {p.species}<span className="muted small block">{p.range}</span></span>
            </button>
          ))}
          {!hits.length && <p className="muted small qs-none">No products in {localeName(locale)} match “{q}”.</p>}
          <button className="qs-all" onClick={() => go(`/products?q=${encodeURIComponent(q)}`)}>See all results</button>
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
          <div className="user-pop-head">Prototype: try the PIM as</div>
          {users.map((u) => (
            <button key={u.id} className={`user-opt${u.id === user.id ? ' sel' : ''}`} onClick={() => { setUser(u.id); setOpen(false) }}>
              <Avatar name={u.name} size={28} />
              <span>
                <span className="user-name">{u.name}</span>
                <span className="user-role">{ROLE_LABEL[u.role]}{isGlobalUser(u) ? ', all locales' : `, ${u.locales.map((m) => marketLabel(m, true)).join(', ')}`}</span>
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
  const locale = useStore((s) => s.locale)
  const navigate = useNavigate()
  return (
    <div className="app">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><MenuIcon size={22} /></button>
          <button className="topbar-loc" onClick={() => setMenu(true)} aria-label={`Locale: ${localeName(locale)}. Change`}><LocaleCode id={locale} /></button>
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
