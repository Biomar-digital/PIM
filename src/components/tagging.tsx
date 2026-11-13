// Tagging people on a product: "please review the Danish description", "please translate this".
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AtSign, Check, RotateCcw } from 'lucide-react'
import type { Product, TagKind, TagRequest } from '../types'
import { GLOBAL, ROLE_LABEL, marketLabel } from '../data/reference'
import { can, isGlobalUser } from '../data/rules'
import { TAG_KIND_LABEL, closeTag, currentUser, resolveRequest, tagPerson, useStore, userName } from '../data/store'
import { productImage } from '../lib/files'
import { formatDate, timeAgo } from '../lib/format'
import { Avatar, Modal, Thumb } from './ui'
import { LocaleCode } from './Layout'

/** What a request can be about */
export const TAG_ABOUT = ['Whole product', 'Marketing copy', 'Short description', 'Description', 'Key benefits', 'Selling points', 'Tagline', 'Product identity', 'Assets', 'Internal information']

const KINDS = Object.keys(TAG_KIND_LABEL) as TagKind[]

/** The "Tag someone" dialog. Opened from anywhere with openTag(); rendered once in the layout. */
export function TagModal() {
  const draft = useStore((s) => s.tagging)
  const p = useStore((s) => s.db.products.find((x) => x.id === s.tagging?.productId))
  const users = useStore((s) => s.db.users)
  const me = useStore(currentUser)
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<TagKind | ''>('')
  const [locale, setLocale] = useState('')
  const [about, setAbout] = useState('')
  const [message, setMessage] = useState('')
  const [due, setDue] = useState('')
  if (!draft || !p) return null
  const loc = locale || draft.locale
  const k = kind || draft.kind || (loc === GLOBAL ? 'review' : 'translate')
  const ab = about || draft.about || 'Marketing copy'
  const locales = [GLOBAL, ...p.markets]
  // People who work in the market first, then everyone else
  const others = users.filter((u) => u.id !== me.id)
  const works = (u: (typeof users)[number]) => loc !== GLOBAL && !isGlobalUser(u) && u.locales.includes(loc)
  const close = () => { setTo(''); setKind(''); setLocale(''); setAbout(''); setMessage(''); setDue(''); closeTag() }
  const send = () => {
    tagPerson(p.id, { to, kind: k, locale: loc, about: ab, message: message.trim(), due: due || undefined })
    close()
  }
  const person = users.find((u) => u.id === to)
  return (
    <Modal title={`Tag someone on ${p.name} – ${p.species}`} onClose={close} footer={<>
      <button className="btn btn-secondary" onClick={close}>Cancel</button>
      <button className="btn btn-primary" disabled={!to} onClick={send}><AtSign size={16} />Tag {person ? person.name.split(' ')[0] : ''}</button>
    </>}>
      <label className="field"><span>Who</span>
        <select id="tag-to" value={to} onChange={(e) => setTo(e.target.value)} autoFocus>
          <option value="">Choose a person</option>
          {others.some(works) && <optgroup label={`Works in ${marketLabel(loc, true)}`}>
            {others.filter(works).map((u) => <option key={u.id} value={u.id}>{u.name}, {u.title}</option>)}
          </optgroup>}
          <optgroup label={others.some(works) ? 'Everyone else' : 'Everyone'}>
            {others.filter((u) => !works(u)).map((u) => <option key={u.id} value={u.id}>{u.name}, {u.title}</option>)}
          </optgroup>
        </select>
        {person && !can.viewLocale(person, loc) && <span className="small warn-text">{person.name} does not have access to {marketLabel(loc, true)}.</span>}
        {person && k === 'approve' && !can.approve(person, loc) && <span className="small warn-text">{person.name} is a {ROLE_LABEL[person.role].toLowerCase()} and cannot approve.</span>}
      </label>
      <div className="form-grid">
        <label className="field"><span>To do</span>
          <select id="tag-kind" value={k} onChange={(e) => setKind(e.target.value as TagKind)}>
            {KINDS.map((x) => <option key={x} value={x}>{TAG_KIND_LABEL[x]}</option>)}
          </select>
        </label>
        <label className="field"><span>Market</span>
          <select id="tag-locale" value={loc} onChange={(e) => setLocale(e.target.value)}>
            {locales.map((l) => <option key={l} value={l}>{l === GLOBAL ? 'Global' : marketLabel(l)}</option>)}
          </select>
        </label>
        <label className="field"><span>About</span>
          <select id="tag-about" value={ab} onChange={(e) => setAbout(e.target.value)}>
            {TAG_ABOUT.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="field"><span>Due date (optional)</span>
          <input id="tag-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="field span-2"><span>Message (optional)</span>
          <textarea id="tag-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
      </div>
      <p className="muted small">They see it on their dashboard and on this product until they mark it as done.</p>
    </Modal>
  )
}

const hrefFor = (p: Product, r: TagRequest) => {
  const tab = r.about === 'Assets' ? '/assets' : r.about === 'Internal information' ? '/internal' : ''
  return `/products/${p.id}${tab}${r.locale !== GLOBAL ? `?locale=${r.locale}` : ''}`
}

function RequestLine({ p, r, showProduct }: { p: Product; r: TagRequest; showProduct?: boolean }) {
  const me = useStore(currentUser)
  const mine = r.to === me.id || r.from === me.id
  const overdue = r.due && r.status === 'open' && r.due < new Date().toISOString().slice(0, 10)
  return (
    <li className={`req${r.status === 'done' ? ' done' : ''}`}>
      {showProduct ? <Thumb url={productImage(p)} size={40} /> : <Avatar name={userName(r.from)} size={32} />}
      <div className="grow min0">
        {showProduct && <Link to={hrefFor(p, r)} className="req-product">{p.name} – {p.species}</Link>}
        <p className="req-title">
          <strong>{userName(r.from)}</strong> asked {r.to === me.id ? <strong>you</strong> : <strong>{userName(r.to)}</strong>} to <strong>{TAG_KIND_LABEL[r.kind].toLowerCase()}</strong>
          {r.kind === 'fyi' ? ' about' : ''} {r.about.toLowerCase()}
        </p>
        {r.message && <p className="req-msg">“{r.message}”</p>}
        <p className="req-meta small">
          <LocaleCode id={r.locale} />{r.locale === GLOBAL ? 'Global' : marketLabel(r.locale, true)}
          <span>· {timeAgo(r.createdAt)}</span>
          {r.due && <span className={overdue ? 'todo-count' : ''}>· Due {formatDate(r.due)}</span>}
          {r.status === 'done' && r.doneAt && <span>· Done {timeAgo(r.doneAt)}</span>}
        </p>
      </div>
      <div className="row-gap req-actions">
        {showProduct && <Link to={hrefFor(p, r)} className="btn btn-secondary btn-sm">Open<ArrowRight size={14} /></Link>}
        {mine && r.status === 'open' && <button className="btn btn-secondary btn-sm" onClick={() => resolveRequest(p.id, r.id, true)}><Check size={14} />Done</button>}
        {mine && r.status === 'done' && <button className="icon-btn" title="Reopen" aria-label="Reopen" onClick={() => resolveRequest(p.id, r.id, false)}><RotateCcw size={15} /></button>}
      </div>
    </li>
  )
}

/** Open requests on a product, shown on its page. In a market: that market's requests and the global ones. */
export function RequestsPanel({ p, loc }: { p: Product; loc: string }) {
  const [showDone, setShowDone] = useState(false)
  const all = (p.requests ?? []).filter((r) => loc === GLOBAL || r.locale === GLOBAL || r.locale === loc)
  const open = all.filter((r) => r.status === 'open')
  const done = all.filter((r) => r.status === 'done')
  if (!all.length) return null
  return (
    <section className="requests">
      <header className="requests-head">
        <AtSign size={16} />
        <strong>{open.length ? `${open.length} open ${open.length === 1 ? 'request' : 'requests'}` : 'No open requests'}</strong>
        {done.length > 0 && <button className="link-btn small" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide done' : `Show done (${done.length})`}</button>}
      </header>
      <ul className="req-list">
        {[...open, ...(showDone ? done : [])].map((r) => <RequestLine key={r.id} p={p} r={r} />)}
      </ul>
    </section>
  )
}

/** "Tagged for you" on the dashboard */
export function TaggedForYou({ items }: { items: { product: Product; request: TagRequest }[] }) {
  if (!items.length) return null
  return (
    <section className="tagged">
      <header className="section-head"><h2>Tagged for you</h2><span className="muted small">{items.length} {items.length === 1 ? 'request' : 'requests'}</span></header>
      <ul className="req-list card">
        {items.map(({ product, request }) => <RequestLine key={request.id} p={product} r={request} showProduct />)}
      </ul>
    </section>
  )
}
