import { useEffect, useId, useState, type ReactNode } from 'react'

const PANEL_KEY_PREFIX = 'panel:'

function readOpen(id: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(`${PANEL_KEY_PREFIX}${id}`)
    if (raw === 'open') return true
    if (raw === 'closed') return false
  } catch {
    /* ignore */
  }
  return defaultOpen
}

function writeOpen(id: string, open: boolean) {
  try {
    localStorage.setItem(`${PANEL_KEY_PREFIX}${id}`, open ? 'open' : 'closed')
  } catch {
    /* ignore */
  }
}

type PanelProps = {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
  as?: 'section' | 'div' | 'article'
}

export function Panel({
  id,
  title,
  subtitle,
  children,
  collapsible = true,
  defaultOpen = true,
  className = '',
  as: Tag = 'section',
}: PanelProps) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen))
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    writeOpen(id, open)
  }, [id, open])

  const headerClass = collapsible ? 'panel-header collapsible' : 'panel-header'

  return (
    <Tag className={`panel ${className}`.trim()} aria-labelledby={titleId}>
      {collapsible ? (
        <button
          type="button"
          className={headerClass}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="panel-titles">
            <h3 id={titleId} className="panel-title">
              {title}
            </h3>
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          <span className="panel-chevron" data-open={open ? 'true' : 'false'} aria-hidden="true">
            ▾
          </span>
        </button>
      ) : (
        <div className={headerClass}>
          <div className="panel-titles">
            <h3 id={titleId} className="panel-title">
              {title}
            </h3>
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
        </div>
      )}
      <div id={bodyId} className="panel-body" hidden={collapsible && !open}>
        {children}
      </div>
    </Tag>
  )
}
