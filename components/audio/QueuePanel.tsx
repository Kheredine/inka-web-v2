'use client'
import { usePlayerStore } from '@/stores/playerStore'
import { CoverArt } from '@/components/ui/CoverArt'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { formatDuration } from '@/lib/utils'

export function QueuePanel() {
  const {
    queue,
    queueIndex,
    currentSound,
    queueVisible,
    shuffleMode,
    repeatMode,
    setQueueVisible,
    playSound,
  } = usePlayerStore()

  if (!queueVisible || !currentSound) return null

  const shuffleLabel =
    shuffleMode === 'shuffle' ? 'Aléatoire' :
    shuffleMode === 'ai' ? 'IA Shuffle' :
    null

  const repeatLabel =
    repeatMode === 'queue' ? 'Répéter tout' :
    repeatMode === 'track' ? 'Répéter 1' :
    null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setQueueVisible(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 50, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxHeight: '75dvh',
        background: colors.surfaceElevated,
        borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
        zIndex: 51,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.sm}px ${spacing.lg}px ${spacing.md}px`,
        }}>
          <div>
            <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: typography.base.fontSize }}>
              File d&apos;attente
            </span>
            <div style={{ display: 'flex', gap: spacing.xs, marginTop: 4 }}>
              {shuffleLabel && (
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  ✦ {shuffleLabel}
                </span>
              )}
              {repeatLabel && (
                <span style={{ fontSize: 11, color: colors.textMuted }}>
                  · {repeatLabel}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setQueueVisible(false)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 18, padding: 4, display: 'flex' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Queue list */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: spacing.xl }}>
          {queue.map((sound, i) => {
            const isCurrent = i === queueIndex
            const isPlayed = i < queueIndex
            return (
              <div
                key={`${sound.id}-${i}`}
                onClick={() => {
                  if (!isCurrent) {
                    playSound(sound, queue)
                    // Restore queueIndex since playSound recalculates it
                    usePlayerStore.setState({ queueIndex: i })
                  }
                  setQueueVisible(false)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing.md,
                  padding: `${spacing.sm}px ${spacing.lg}px`,
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'rgba(232,144,42,0.08)' : 'transparent',
                  borderLeft: isCurrent ? `3px solid var(--accent)` : '3px solid transparent',
                  opacity: isPlayed ? 0.4 : 1,
                  transition: 'background 0.15s',
                }}
              >
                {/* Index or playing indicator */}
                <div style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {isCurrent ? (
                    <i className="fa-solid fa-waveform-lines" style={{ color: 'var(--accent)', fontSize: 12 }} />
                  ) : (
                    <span style={{ color: colors.textMuted, fontSize: 11 }}>{i + 1}</span>
                  )}
                </div>

                {/* Cover */}
                <div style={{ width: 36, height: 36, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
                  <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} fill />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: isCurrent ? 'var(--accent)' : colors.textPrimary,
                    fontSize: 13, fontWeight: isCurrent ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sound.title}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sound.artist}
                  </div>
                </div>

                {/* Duration */}
                <span style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0 }}>
                  {formatDuration(sound.duration)}
                </span>
              </div>
            )
          })}

          {queue.length === 0 && (
            <div style={{ textAlign: 'center', padding: spacing.xxl, color: colors.textMuted, fontSize: typography.sm.fontSize }}>
              File d&apos;attente vide
            </div>
          )}
        </div>
      </div>
    </>
  )
}
