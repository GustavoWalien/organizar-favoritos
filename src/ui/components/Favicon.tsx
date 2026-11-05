import { useState } from 'react'
import { faviconUrl } from '../favicon'

/** Ícone de 16 px do site, antes do título. Decorativo: o título ao lado já diz o que é. */
export default function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(url)
  if (!src || failed) return <span className="favicon favicon-empty" aria-hidden="true" />
  return <img className="favicon" src={src} alt="" width={16} height={16} loading="lazy" draggable={false} onError={() => setFailed(true)} />
}
