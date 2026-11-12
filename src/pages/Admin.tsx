import { useState } from 'react'
import { Check, Minus, RotateCcw } from 'lucide-react'
import type { Role } from '../types'
import { currentUser, resetDemo, updateUser, useStore } from '../data/store'
import { can } from '../data/rules'
import { MARKETS, ROLE_DESCRIPTION, ROLE_LABEL, marketLabel } from '../data/reference'
import { Avatar, Card, Modal } from '../components/ui'

const MATRIX: { label: string; roles: Role[] }[] = [
  { label: 'Find, preview and download content', roles: ['viewer', 'local_editor', 'approver', 'global_editor', 'admin'] },
  { label: 'Edit local content for own markets', roles: ['local_editor', 'global_editor', 'admin'] },
  { label: 'Upload market-specific assets', roles: ['local_editor', 'global_editor', 'admin'] },
  { label: 'Edit global product information & marketing copy', roles: ['global_editor', 'admin'] },
  { label: 'Create products, manage target markets', roles: ['global_editor', 'admin'] },
  { label: 'Approve or request changes', roles: ['approver', 'admin'] },
  { label: 'Manage users and roles', roles: ['admin'] },
]
const ROLES: Role[] = ['viewer', 'local_editor', 'approver', 'global_editor', 'admin']

export default function Admin() {
  const users = useStore((s) => s.db.users)
  const me = useStore(currentUser)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const admin = can.manageUsers(me)
  const editUser = users.find((u) => u.id === editing)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p className="muted">Users, roles and permissions.{!admin && ' Only administrators can make changes.'}</p>
        </div>
      </div>

      <Card title="Users">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th className="hide-md">Markets</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="prod-cell"><Avatar name={u.name} size={32} /><span><strong>{u.name}</strong><span className="muted small block">{u.title}</span></span></span></td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="hide-md small">{u.markets.length ? u.markets.map((m) => marketLabel(m, true)).join(', ') : <span className="muted">All markets</span>}</td>
                  <td>{admin && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(u.id)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What each role can do" className="mt">
        <div className="table-wrap">
          <table className="table matrix">
            <thead><tr><th />{ROLES.map((r) => <th key={r} title={ROLE_DESCRIPTION[r]}>{ROLE_LABEL[r]}</th>)}</tr></thead>
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
          <p className="muted grow">Changes are saved in this browser. Reset to start again from the sample products imported from the BioMar website.</p>
          <button className="btn btn-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Reset demo data</button>
        </div>
      </Card>

      {editUser && (
        <Modal title={`Edit ${editUser.name}`} onClose={() => setEditing(null)} footer={<button className="btn btn-primary" onClick={() => setEditing(null)}>Done</button>}>
          <label className="field"><span>Role</span>
            <select value={editUser.role} onChange={(e) => updateUser(editUser.id, { role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <p className="muted small">{ROLE_DESCRIPTION[editUser.role]}</p>
          <fieldset className="field mt">
            <legend>Markets</legend>
            <div className="checks checks-grid">
              {MARKETS.map((m) => (
                <label key={m.id} className="check">
                  <input type="checkbox" checked={editUser.markets.includes(m.id)} onChange={(e) => updateUser(editUser.id, { markets: e.target.checked ? [...editUser.markets, m.id] : editUser.markets.filter((x) => x !== m.id) })} />
                  {m.market} – {m.language}
                </label>
              ))}
            </div>
          </fieldset>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Reset demo data?" onClose={() => setConfirmReset(false)} footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { resetDemo(); setConfirmReset(false) }}>Reset</button>
        </>}>
          <p>All edits, approvals and uploaded files in this browser will be removed.</p>
        </Modal>
      )}
    </div>
  )
}
