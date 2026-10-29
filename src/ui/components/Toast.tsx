import { useEffect, useState } from 'react'

interface Props {
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
  durationMs?: number
}

/** Aviso temporário. Fica na tela enquanto o mouse ou o foco estiverem sobre ele. */
export default function Toast({ message, actionLabel, onAction, onClose, durationMs = 10_000 }: Props) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(onClose, durationMs)
    return () => clearTimeout(timer)
  }, [paused, durationMs, onClose, message])

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button className="toast-action" onClick={() => { onAction(); onClose() }}>{actionLabel}</button>
      )}
      <button className="toast-close" aria-label="Fechar aviso" onClick={onClose}>✕</button>
    </div>
  )
}
