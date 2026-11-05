import { useState } from 'react'
import type { DuplicateGroup } from '../../core/duplicates'
import { groupKey } from '../duplicateChoice'
import { domainOf, lastUsedLabel } from '../format'
import Favicon from './Favicon'

const PAGE = 20

interface Props {
  groups: DuplicateGroup[]
  included: Set<string>
  onToggleGroup: (key: string) => void
  onKeep: (key: string, id: string) => void
}

/** Grupos de duplicados em cartões: cada cópia com "manter" e a etiqueta do que acontece com ela. */
export default function DuplicateGroups({ groups, included, onToggleGroup, onKeep }: Props) {
  const [pages, setPages] = useState(1)
  const now = Date.now()
  const shown = groups.slice(0, pages * PAGE)
  return (
    <div className="dup-groups">
      {shown.map((g) => {
        const key = groupKey(g)
        const copies = [g.keep, ...g.extras].sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')))
        const on = included.has(key)
        return (
          <section key={key} className={`dup-group${on ? '' : ' off'}`}>
            <div className="dup-head">
              <input type="checkbox" checked={on} onChange={() => onToggleGroup(key)} aria-label={`Incluir o grupo ${g.keep.title || key}`} />
              <div className="dup-title">
                <strong><Favicon url={g.keep.url} />{g.keep.title || '(sem título)'}</strong>
                <small>{domainOf(g.keep.url)}</small>
              </div>
              <span className="tag tag-duplicado">{copies.length} cópias</span>
            </div>
            {copies.map((c) => {
              const keep = c.id === g.keep.id
              return (
                <label key={c.id} className="dup-copy">
                  <input type="radio" name={`keep-${key}`} checked={keep} onChange={() => onKeep(key, c.id)} aria-label={`Manter a cópia em ${c.path.join(' › ')}`} />
                  <span className="dup-path">{c.path.join(' › ')}</span>
                  <span className="muted">{lastUsedLabel(c.dateLastUsed, now)}</span>
                  <span className={keep ? 'tag tag-duplicado' : 'tag'}>{keep ? 'fica' : on ? 'vai p/ Lixeira' : 'fica (grupo de fora)'}</span>
                </label>
              )
            })}
          </section>
        )
      })}
      {groups.length > shown.length && (
        <button className="more" onClick={() => setPages((p) => p + 1)}>Mostrar mais grupos ({groups.length - shown.length} restantes)</button>
      )}
    </div>
  )
}
