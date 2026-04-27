'use client'
import { useState, useEffect } from 'react'
import { colors, radius, spacing } from '@/lib/theme'
import { Reaction, ReactionEmoji, REACTION_EMOJIS } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useFeedStore } from '@/stores/feedStore'

interface ReactionBarProps {
  soundId: string
  reactions: Reaction[]
}

const EMOJIS: ReactionEmoji[] = ['fire', 'heart', 'sleep', 'pray']

export function ReactionBar({ soundId, reactions: initialReactions }: ReactionBarProps) {
  const { profile } = useAuthStore()
  const { optimisticReaction } = useFeedStore()

  // État local pour mise à jour immédiate — indépendant du store feed
  const [localReactions, setLocalReactions] = useState<Reaction[]>(initialReactions)

  // Resync si les props changent (ex: Realtime feed)
  useEffect(() => {
    setLocalReactions(initialReactions)
  }, [initialReactions])

  const toggle = async (emoji: ReactionEmoji) => {
    if (!profile) return
    const has = localReactions.some((r) => r.user_id === profile.id && r.emoji === emoji)

    // Mise à jour optimiste locale immédiate
    setLocalReactions((prev) =>
      has
        ? prev.filter((r) => !(r.user_id === profile.id && r.emoji === emoji))
        : [...prev, { id: 'opt-' + Date.now(), sound_id: soundId, user_id: profile.id, emoji, created_at: new Date().toISOString() }]
    )

    // Mise à jour du feed store (si le son est dans le feed)
    optimisticReaction(soundId, emoji, profile.id, !has)

    // Persistance DB
    if (has) {
      await supabase.from('reactions').delete().match({ sound_id: soundId, user_id: profile.id, emoji })
    } else {
      const { error } = await supabase.from('reactions').upsert(
        { sound_id: soundId, user_id: profile.id, emoji },
        { onConflict: 'sound_id,user_id,emoji' }
      )
      // Rollback si erreur DB
      if (error) {
        setLocalReactions((prev) =>
          prev.filter((r) => !(r.user_id === profile.id && r.emoji === emoji && r.id.startsWith('opt-')))
        )
      }
    }
  }

  const counts = EMOJIS.reduce<Record<ReactionEmoji, number>>((acc, e) => {
    acc[e] = localReactions.filter((r) => r.emoji === e).length
    return acc
  }, { fire: 0, heart: 0, sleep: 0, pray: 0 })

  return (
    <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
      {EMOJIS.map((emoji) => {
        const active = profile ? localReactions.some((r) => r.user_id === profile.id && r.emoji === emoji) : false
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: `4px ${spacing.sm}px`,
              borderRadius: radius.full,
              border: `1px solid ${active ? colors.primary : colors.border}`,
              background: active ? `${colors.primary}22` : colors.surface,
              cursor: profile ? 'pointer' : 'default',
              fontSize: 14,
              color: colors.textSecondary,
              transition: 'all 0.15s',
              transform: active ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <span>{REACTION_EMOJIS[emoji]}</span>
            {counts[emoji] > 0 && (
              <span style={{ fontSize: 12, color: active ? colors.primary : colors.textMuted, fontWeight: active ? 600 : 400 }}>
                {counts[emoji]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
