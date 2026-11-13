import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Product, User } from '../../types'
import { MARKETS, REGIONS } from '../../data/reference'
import { can, isOutdated, localeState } from '../../data/rules'
import { setAvailability, setLocale, setWebsiteStatus } from '../../data/store'
import { Card, Empty, Modal, StatusBadge, UpdatedBy } from '../../components/ui'
import { LocaleCode } from '../../components/Layout'

/** Where the product is available, and the state of each local version. */
export function LocalesTab({ p, user, onOpen }: { p: Product; user: User; onOpen: () => void }) {
  const [adding, setAdding] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const manage = can.setAvailability(user)
  const available = MARKETS.filter((m) => p.markets.includes(m.id))
  const missing = MARKETS.filter((m) => !p.markets.includes(m.id))
  const open = (l: string) => { if (can.viewLocale(user, l)) { setLocale(l); onOpen() } }

  return (
    <Card title={`Available in ${available.length} ${available.length === 1 ? 'locale' : 'locales'}`} actions={manage && missing.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(missing.map((m) => m.id))}><Plus size={14} />Add a locale</button>}>
      {available.length === 0 ? <p className="pad"><Empty text="Not available in any locale yet. Global English only." /></p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Locale</th><th>Status</th><th className="hide-md">Version</th><th className="hide-md">Last change</th><th>On the website</th>{manage && <th />}</tr></thead>
            <tbody>
              {available.map((m) => {
                const v = p.variants[m.id]
                const viewable = can.viewLocale(user, m.id)
                return (
                  <tr key={m.id} className={viewable ? 'click-row' : ''} onClick={() => open(m.id)}>
                    <td><span className="row-gap"><LocaleCode id={m.id} /><span><strong>{m.market}</strong><span className="muted small block">{m.language}</span></span></span></td>
                    <td><StatusBadge status={localeState(p, m.id)} small />{v && v.meta.status !== 'approved' && isOutdated(p, v) && <span className="warn-text small block">Global content changed</span>}</td>
                    <td className="hide-md small">{v ? (v.inheritsGlobal ? 'Uses English' : v.version ? `Version ${v.version}` : 'Not approved yet') : ''}</td>
                    <td className="hide-md small">{v ? <UpdatedBy by={v.meta.updatedBy} at={v.meta.updatedAt} /> : ''}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {v ? (
                        <label className="switch small">
                          <input type="checkbox" checked={v.websiteStatus === 'live'} disabled={!can.editLocale(user, m.id)} onChange={(e) => setWebsiteStatus(p.id, m.id, e.target.checked)} />
                          {v.websiteStatus === 'live' ? 'Live' : 'Not live'}
                        </label>
                      ) : <span className="muted small">Not live</span>}
                    </td>
                    {manage && <td className="right" onClick={(e) => e.stopPropagation()}><button className="link-btn small" onClick={() => setRemoving(m.id)}>Remove</button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small pad">The website manages its own publishing. “On the website” is tracked by hand by the local team.</p>

      {adding && (
        <Modal title="Make available in more locales" onClose={() => setAdding(null)} footer={<button className="btn btn-primary" onClick={() => setAdding(null)}>Done</button>}>
          {REGIONS.map((r) => {
            const list = MARKETS.filter((m) => adding.includes(m.id) && m.region === r)
            return list.length ? (
              <fieldset key={r} className="field">
                <legend>{r}</legend>
                <div className="checks checks-grid">
                  {list.map((m) => (
                    <label key={m.id} className="check">
                      <input type="checkbox" checked={p.markets.includes(m.id)} onChange={(e) => setAvailability(p.id, m.id, e.target.checked)} />
                      {m.market} ({m.language})
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null
          })}
        </Modal>
      )}
      {removing && (
        <Modal title="Remove from this locale?" onClose={() => setRemoving(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { setAvailability(p.id, removing, false); setRemoving(null) }}>Remove</button>
        </>}>
          <p>The product no longer shows in this locale. Its local copy is kept, so it comes back if the product is added again.</p>
        </Modal>
      )}
    </Card>
  )
}
