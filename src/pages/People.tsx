import { useState } from 'react'
import { Check, Minus, RotateCcw } from 'lucide-react'
import type { Role } from '../types'
import { currentUser, resetDemo, updateUser, useStore } from '../data/store'
import { can, isGlobalUser } from '../data/rules'
import { DIVISIONS, GLOBAL, GROUPS, MARKETS, ROLE_DESCRIPTION, ROLE_LABEL, marketLabel } from '../data/reference'
import { Avatar, Card, Empty, Modal } from '../components/ui'

const MATRIX: { label: string; roles: Role[] }[] = [
  { label: 'Find, copy and download approved content in their locales', roles: ['viewer', 'local_editor', 'approver', 'global_editor', 'admin'] },
  { label: 'See every locale', roles: ['approver', 'global_editor', 'admin'] },
  { label: 'Adapt marketing copy and add local documents for their own locales', roles: ['local_editor', 'global_editor', 'admin'] },
  { label: 'Edit the global record: name, classification, tagline, hero image, technical details, English copy', roles: ['global_editor', 'admin'] },
  { label: 'Create products and choose the locales where they are available', roles: ['global_editor', 'admin'] },
  { label: 'Approve content or send it back', roles: ['approver', 'admin'] },
  { label: 'Manage people and their access', roles: ['admin'] },
]
const ROLES: Role[] = ['viewer', 'local_editor', 'approver', 'global_editor', 'admin']

export default function People() {
  const users = useStore((s) => s.db.users)
  const me = useStore(currentUser)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const admin = can.manageUsers(me)
  const storage = useStore((s) => s.storage)
  const editUser = users.find((u) => u.id === editing)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>People and access</h1>
          <p className="muted">Who works in which locales, and what each role can do.{!admin && ' Only administrators can make changes.'}</p>
        </div>
      </div>

      <Card title="People">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th className="hide-md">Markets</th><th className="hide-md">Opens in</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="prod-cell"><Avatar name={u.name} size={32} /><span><strong>{u.name}</strong><span className="muted small block">{u.title}</span></span></span></td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="hide-md small">{isGlobalUser(u) ? <Empty text="All markets" /> : u.locales.map((m) => marketLabel(m, true)).join(', ') || <Empty text="None yet" />}</td>
                  <td className="hide-md small">{marketLabel(u.defaultLocale, true)}</td>
                  <td className="right">{admin && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(u.id)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What each role can do" className="mt">
        <div className="table-wrap">
          <table className="table matrix">
            <thead><tr><th />{ROLES.map((r) => <th key={r} className="center" title={ROLE_DESCRIPTION[r]}>{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {ROLES.map((r) => <td key={r} className="center">{row.roles.includes(r) ? <Check size={16} className="ok-ic" aria-label="Yes" /> : <Minus size={16} className="muted" aria-label="No" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Prototype data" className="mt">
        <div className="pad row-gap wrap">
          <p className="muted grow">{storage === 'shared' ? 'Changes are shared: everyone with the link sees the same products and edits.' : 'Changes are saved in this browser only.'} Reset to go back to the products as imported from the BioMar website.</p>
          {admin && <button className="btn btn-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Reset sample data</button>}
        </div>
      </Card>

      {editUser && (
        <Modal title={`Edit ${editUser.name}`} onClose={() => setEditing(null)} footer={<button className="btn btn-primary" onClick={() => setEditing(null)}>Done</button>}>
          <label className="field"><span>Role</span>
            <select id="admin-role" value={editUser.role} onChange={(e) => { const role = e.target.value as Role; updateUser(editUser.id, { role, defaultLocale: ['admin', 'global_editor', 'approver'].includes(role) ? GLOBAL : editUser.locales[0] ?? GLOBAL }) }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <p className="muted small">{ROLE_DESCRIPTION[editUser.role]}</p>
          {isGlobalUser(editUser) ? <p className="small">This role works across every locale.</p> : (
            <fieldset className="field">
              <legend>Markets this person works in</legend>
              {DIVISIONS.map((d) => <div key={d.id}><p className="small strong mt-sm">{d.name}</p><div className="checks checks-grid">
                {MARKETS.filter((m) => m.division === d.id).map((m) => (
                  <label key={m.id} className="check">
                    <input type="checkbox" checked={editUser.locales.includes(m.id)} onChange={(e) => {
                      const locales = e.target.checked ? [...editUser.locales, m.id] : editUser.locales.filter((x) => x !== m.id)
                      updateUser(editUser.id, { locales, defaultLocale: can.viewLocale({ ...editUser, locales }, editUser.defaultLocale) ? editUser.defaultLocale : locales[0] ?? GLOBAL })
                    }} />
                    {marketLabel(m.id)}
                  </label>
                ))}
              </div></div>)}
            </fieldset>
          )}
          <label className="field"><span>Opens the PIM in</span>
            <select id="admin-default" value={editUser.defaultLocale} onChange={(e) => updateUser(editUser.id, { defaultLocale: e.target.value })}>
              {[GLOBAL, ...GROUPS.filter((g) => can.viewLocale(editUser, g.id)).map((g) => g.id), ...(isGlobalUser(editUser) ? MARKETS.map((m) => m.id) : editUser.locales)].map((l) => <option key={l} value={l}>{marketLabel(l)}</option>)}
            </select>
          </label>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Reset sample data?" onClose={() => setConfirmReset(false)} footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { resetDemo(); setConfirmReset(false) }}>Reset</button>
        </>}>
          <p>All changes, approvals and linked assets are removed for everyone, and the products go back to the website import.</p>
        </Modal>
      )}
    </div>
  )
}
