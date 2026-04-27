'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUploadStore } from '@/stores/uploadStore'
import { colors, radius } from '@/lib/theme'

export function UploadBadge() {
  const pathname = usePathname()
  const { queue, isProcessing } = useUploadStore()

  const activeCount = queue.filter((i) => i.status === 'uploading' || i.status === 'analyzing').length
  const doneCount = queue.filter((i) => i.status === 'done').length
  const total = queue.length

  if (!isProcessing || total === 0 || pathname === '/upload') return null

  return (
    <Link href="/upload" style={{
      position: 'fixed', bottom: 140, right: 16, zIndex: 60,
      background: 'var(--accent-gradient)',
      borderRadius: radius.full, padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 8,
      textDecoration: 'none', boxShadow: '0 4px 20px rgba(255,106,0,0.4)',
    }}>
      <span style={{ fontSize: 16 }}>⬆️</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{doneCount}/{total}</span>
      {/* Mini progress ring */}
      <div style={{ width: 20, height: 20, position: 'relative' }}>
        <svg width="20" height="20" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="10" cy="10" r="8" fill="none" stroke="white" strokeWidth="2"
            strokeDasharray={`${(doneCount / total) * 50.3} 50.3`} />
        </svg>
      </div>
    </Link>
  )
}
