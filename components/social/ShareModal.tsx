'use client'
import { useState, useEffect } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { colors, radius, spacing, typography } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Profile, Sound } from '@/types'

interface ShareModalProps {
  sound?: Sound
  playlist?: { id: string; title: string }
  visible: boolean
  onClose: () => void
}

export function ShareModal({ sound, playlist, visible, onClose }: ShareModalProps) {
  const { profile } = useAuthStore()
  const [members, setMembers] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!visible || !profile) return
    supabase.from('profiles').select('*').neq('id', profile.id).then(({ data }) => {
      setMembers((data as Profile[]) ?? [])
    })
  }, [visible, profile])

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const send = async () => {
    if (!profile || selected.length === 0 || (!sound && !playlist)) return
    setSending(true)
    await supabase.from('shares').insert(
      selected.map((to) => ({
        from_user: profile.id,
        to_user: to,
        sound_id: sound?.id ?? null,
        playlist_id: playlist?.id ?? null,
        message: message.trim() || null,
      }))
    )
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setSelected([]); setMessage(''); onClose() }, 1200)
  }

  const targetLabel = playlist ? 'la playlist' : 'ce son'
  const itemTitle = playlist?.title ?? sound?.title ?? ''

  return (
    <BottomSheet visible={visible} onClose={onClose} title={playlist ? 'Partager la playlist' : 'Partager'}>
      {sent ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.success, fontSize: 32 }}>✓ Envoyé !</div>
      ) : (
        <>
          <div style={{ marginBottom: spacing.sm, color: colors.textMuted, fontSize: typography.sm.fontSize }}>
            Partage {targetLabel} «{itemTitle}» avec un membre.
          </div>
          <div style={{ marginBottom: spacing.md }}>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  width: '100%',
                  padding: `${spacing.sm}px 0`,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: colors.surface,
                  border: `2px solid ${selected.includes(m.id) ? colors.primary : colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>
                  {m.display_name[0].toUpperCase()}
                </div>
                <span style={{ color: colors.textPrimary, fontSize: typography.base.fontSize }}>{m.display_name}</span>
                {selected.includes(m.id) && <span style={{ marginLeft: 'auto', color: colors.primary }}>✓</span>}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            placeholder="Ajouter un message (optionnel)…"
            rows={3}
            style={{
              width: '100%',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
              fontSize: typography.sm.fontSize,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: spacing.md,
              fontFamily: 'inherit',
            }}
          />

          <Button label="Envoyer" onPress={send} loading={sending} disabled={selected.length === 0} />
        </>
      )}
    </BottomSheet>
  )
}
