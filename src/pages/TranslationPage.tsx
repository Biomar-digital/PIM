import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCheck, ChevronRight, Copy as CopyIcon, FilePlus2, Globe2, Lock, Pencil } from 'lucide-react'
import type { Copy, Variant } from '../types'
import { COPY_FIELDS } from '../types'
import { can, isOutdated, marketState, variantGaps } from '../data/rules'
import { createVariant, currentUser, markVariantUpToDate, saveVariant, setMarkets, useStore } from '../data/store'
import { COPY_LABEL, MARKET_BY_ID, marketLabel } from '../data/reference'
import { productImage } from '../lib/files'
import { Card, CopyButton, Empty, EmptyState, StatusBadge, UpdatedBy } from '../components/ui'
import { ApprovalActions, SentBackNote, StatusHint } from '../components/approval'
import { CopyInput, CopyValue } from './product/Overview'

type Draft = Copy & { localName: string; notes: string; inheritsGlobal: boolean }
const asText = (v: string | string[]) => (Array.isArray(v) ? v.filter(Boolean).map((x) => `• ${x}`).join('\n') : v)

export default function TranslationPage() {
  const { id = '', locale = '' } = useParams()
  const p = useStore((s) => s.db.products.find((x) => x.id === id))
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft | null>(null)

  if (!p || !MARKET_BY_ID[locale]) {
    return <div className="page"><EmptyState title="Not found"><Link to="/products" className="btn btn-secondary">Back to products</Link></EmptyState></div>
  }
  const v: Variant | undefined = p.variants[locale]
  const m = MARKET_BY_ID[locale]
  const canEdit = can.editMarket(user, locale)
  const state = marketState(p, locale)
  const startEdit = () => v && setDraft({
    tagline: v.tagline, shortDescription: v.shortDescription, description: v.description,
    keyBenefits: [...v.keyBenefits], sellingPoints: [...v.sellingPoints], localName: v.localName, notes: v.notes, inheritsGlobal: v.inheritsGlobal,
  })
  const save = () => {
    if (!draft) return
    saveVariant(p.id, locale, { ...draft, keyBenefits: draft.keyBenefits.filter(Boolean), sellingPoints: draft.sellingPoints.filter(Boolean) })
    setDraft(null)
  }
  const inherit = draft ? draft.inheritsGlobal : v?.inheritsGlobal

  return (
    <div className="page product-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products">Products</Link><ChevronRight size={14} />
        <Link to={`/products/${p.id}/translations`}>{p.name} – {p.species}</Link><ChevronRight size={14} />
        <span>{marketLabel(locale)}</span>
      </nav>

      <header className="phead card">
        <img src={productImage(p, blobUrls)} alt="" className="phead-logo" />
        <div className="phead-main">
          <h1>{m.market} <span className="phead-species">({m.language})</span></h1>
          <p className="phead-sub">{p.name} – {p.species}</p>
          <div className="phead-status">
            <StatusBadge status={state} />
            {v && <StatusHint meta={v.meta} user={user} section={locale} />}
          </div>
          {v && <p className="muted small">Last change by <UpdatedBy by={v.meta.updatedBy} at={v.meta.updatedAt} /></p>}
        </div>
        <div className="phead-actions">
          {v && <ApprovalActions p={p} section={locale} meta={v.meta} user={user} />}
          <select id="switch-market" className="market-switch" value={locale} onChange={(e) => navigate(`/products/${p.id}/translations/${e.target.value}`)} aria-label="Go to another market">
            {[...new Set([locale, ...p.markets])].map((l) => <option key={l} value={l}>{marketLabel(l)}</option>)}
          </select>
        </div>
      </header>

      {!v ? (
        <Card>
          <EmptyState icon={<FilePlus2 size={32} />} title={`No ${m.language} version yet`}>
            <p className="muted">{p.markets.includes(locale) ? `${p.name} is sold in ${m.market}, but the text has not been added.` : `${m.market} is not one of the markets for ${p.name}.`}</p>
            {canEdit ? (
              <div className="row-gap wrap center">
                <button className="btn btn-primary" onClick={() => createVariant(p.id, locale, 'copy')}><CopyIcon size={16} />Start from the English text</button>
                <button className="btn btn-secondary" onClick={() => createVariant(p.id, locale, 'empty')}>Start with empty fields</button>
                {m.language === 'English' && <button className="btn btn-secondary" onClick={() => createVariant(p.id, locale, 'inherit')}>Use the English text as it is</button>}
              </div>
            ) : (
              <p className="small muted">The local editor for {m.market} can add it.</p>
            )}
            {!p.markets.includes(locale) && can.editGlobal(user) && <button className="btn btn-secondary" onClick={() => setMarkets(p.id, locale)}>Add {m.market} as a market</button>}
          </EmptyState>
        </Card>
      ) : (
        <div className="stack-gap">
          <SentBackNote meta={v.meta} />
          {isOutdated(p, v) && !draft && (
            <div className="note note-warn">
              <AlertTriangle size={18} />
              <div>
                <strong>The English text has changed since this translation was made.</strong> Compare the two columns below and update the {m.language} text, or confirm that nothing needs to change.
                {canEdit && (
                  <div className="row-gap mt">
                    <button className="btn btn-primary btn-sm" onClick={startEdit}><Pencil size={14} />Update translation</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => markVariantUpToDate(p.id, locale)}><CheckCheck size={14} />Nothing to change</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {!isOutdated(p, v) && !draft && variantGaps(v).length > 0 && (
            <div className="note note-info"><AlertTriangle size={16} /><span>Still to add: {variantGaps(v).join(', ')}. Until then the English text is used.</span></div>
          )}

          <Card
            title="Marketing copy"
            actions={draft ? <>
              <button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
            </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={startEdit}><Pencil size={14} />Edit</button> : <span className="muted small lock"><Lock size={14} />Edited by the {m.market} team</span>}
          >
            {draft ? (
              <div className="pad stack-gap-sm">
                {m.language === 'English' && (
                  <label className="check"><input type="checkbox" checked={draft.inheritsGlobal} onChange={(e) => setDraft({ ...draft, inheritsGlobal: e.target.checked })} />Use the global English text as it is</label>
                )}
                <div className="form-grid">
                  <label className="field"><span>Local product name (if different)</span><input id="t-localname" value={draft.localName} placeholder={p.name} onChange={(e) => setDraft({ ...draft, localName: e.target.value })} /></label>
                  <label className="field"><span>Notes for this market</span><input id="t-notes" value={draft.notes} placeholder="For example local claims or availability" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
                </div>
              </div>
            ) : (v.localName || v.notes) ? (
              <dl className="dl">
                {v.localName && <div className="dl-row"><dt>Local product name</dt><dd>{v.localName}</dd></div>}
                {v.notes && <div className="dl-row"><dt>Notes</dt><dd>{v.notes}</dd></div>}
              </dl>
            ) : null}
            {inherit && !draft && <div className="note note-info mx"><Globe2 size={16} />{m.market} uses the global English text as it is.</div>}
            <div className="compare-head"><span>English (global)</span><span>{m.language}</span></div>
            <div className="fields">
              {COPY_FIELDS.map((f) => (
                <div className="compare" key={f}>
                  <h3 className="compare-label">{COPY_LABEL[f]}</h3>
                  <div className="compare-global"><CopyValue value={p.content[f]} empty={<Empty text="Not added in English" />} /></div>
                  <div className="compare-local">
                    {draft && !draft.inheritsGlobal ? (
                      <div className="field"><CopyInput field={f} value={draft[f]} onChange={(val) => setDraft({ ...draft, [f]: val })} placeholder="Leave empty to use the English text" /></div>
                    ) : inherit ? (
                      <Empty text="Same as English" />
                    ) : (
                      <>
                        <CopyValue value={v[f]} empty={<Empty text="Not translated, the English text is used" />} />
                        <CopyButton text={asText(v[f])} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="On the website">
            <div className="pad row-gap wrap">
              <label className="switch">
                <input type="checkbox" checked={v.websiteStatus === 'live'} disabled={!canEdit} onChange={(e) => saveVariant(p.id, locale, { websiteStatus: e.target.checked ? 'live' : 'not_live' }, true)} />
                <span>{v.websiteStatus === 'live' ? `Live on the ${m.market} website` : `Not live on the ${m.market} website`}</span>
              </label>
              <span className="muted small">For reference only. The website team publishes the text.</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
