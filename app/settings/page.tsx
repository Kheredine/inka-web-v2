'use client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { colors, spacing, radius, typography } from '@/lib/theme'

export default function SettingsPage() {
  const { profile, signOut } = useAuthStore()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <div style={{ padding: spacing.lg, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0 }}>Paramètres</h1>
      </div>

      {/* Profile card */}
      <div style={{ background: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <UserAvatar
            username={profile?.username ?? '?'}
            displayName={profile?.display_name}
            size={56}
          />
          <div>
            <div style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 600 }}>{profile?.display_name}</div>
            <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>@{profile?.username}</div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl, border: `1px solid ${colors.border}` }}>
        {[
          { label: 'Nom affiché', value: profile?.display_name ?? '—' },
          { label: 'Nom d\'utilisateur', value: `@${profile?.username ?? '—'}` },
          { label: 'Pays', value: profile?.country ?? '—' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
            <span style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>{row.label}</span>
            <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize }}>{row.value}</span>
          </div>
        ))}
      </div>

      <Button label="Se déconnecter" onPress={handleSignOut} variant="ghost"
        style={{ border: `1px solid ${colors.error}`, color: colors.error }} />
    </div>
  )
}
