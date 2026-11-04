export type IconName =
  | 'grid' | 'broom' | 'list' | 'sparkle' | 'folder' | 'trash' | 'archive' | 'search' | 'moon' | 'sun' | 'contrast'
  | 'chevron-right' | 'chevron-down' | 'expand-all' | 'collapse-all' | 'plus' | 'check' | 'more' | 'bookmark'

const PATHS: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  broom: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  list: <path d="M4 6h16M4 12h10M4 18h6" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  folder: <path d="M3 6h6l2 2h10v11H3z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  archive: <><path d="M4 7h16v13H4z" /><path d="M4 7l2-3h12l2 3" /><path d="M10 12h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  moon: <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  contrast: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" /></>,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'expand-all': <path d="m7 9 5 5 5-5M7 4l5 5 5-5" />,
  'collapse-all': <path d="m7 15 5-5 5 5M7 20l5-5 5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 5 5 9-10" />,
  more: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
}

/** Ícone de traço em SVG, na cor do texto. Decorativo: quem usa dá o nome acessível ao botão. */
export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
