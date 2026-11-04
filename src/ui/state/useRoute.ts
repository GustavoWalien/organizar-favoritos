import { useCallback, useEffect, useState } from 'react'
import { formatRoute, parseRoute, type View } from '../../core/route'

const currentHash = (): string => {
  try {
    return globalThis.location?.hash ?? ''
  } catch {
    return ''
  }
}

/**
 * A vista atual, lida do `#` do endereço. Navegar grava uma entrada no histórico (o "voltar" do
 * navegador funciona); `replace` troca a entrada atual sem criar outra (usado ao corrigir um endereço inválido).
 */
export function useRoute(): [View, (v: View, opts?: { replace?: boolean }) => void] {
  const [view, setView] = useState<View>(() => parseRoute(currentHash()))

  useEffect(() => {
    const onHash = () => setView(parseRoute(currentHash()))
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  const navigate = useCallback((v: View, opts?: { replace?: boolean }) => {
    const hash = formatRoute(v)
    if (hash !== currentHash()) {
      if (opts?.replace) history.replaceState(null, '', hash)
      else history.pushState(null, '', hash)
    }
    setView(v)
  }, [])

  return [view, navigate]
}
