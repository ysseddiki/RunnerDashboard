import type { ReactNode } from 'react'

type SkeletonListProps = {
  rows?: number
}

export function SkeletonList({ rows = 5 }: SkeletonListProps) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-tile" />
      ))}
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="skeleton-detail" aria-busy="true" aria-hidden="true">
      <div className="skeleton skeleton-line medium" />
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-block" style={{ marginTop: '1rem' }} />
      <div className="skeleton skeleton-block" style={{ marginTop: '0.75rem', minHeight: '12rem' }} />
    </div>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}
