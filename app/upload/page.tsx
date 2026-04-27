'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUploadStore, UploadItem, UploadMeta } from '@/stores/uploadStore'
import { useFeedStore } from '@/stores/feedStore'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { parseFilename } from '@/lib/utils'
import { computeFingerprint } from '@/lib/audioOptimizer'

// ── Helpers réseau ─────────────────────────────────────────────────────────────

async function getMusicBrainzData(title: string, artist: string) {
  try {
    const q = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`)
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=1&inc=artist-credits+releases+genres+tags`,
      { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.recordings?.[0] ?? null
  } catch { return null }
}

async function getLyrics(artist: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    )
    if (res.ok) {
      const data = await res.json() as { lyrics?: string }
      if (data.lyrics?.trim()) return data.lyrics.trim()
    }
  } catch { /* fall through */ }

  try {
    const res = await fetch('/api/lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist }),
    })
    if (res.ok) {
      const data = await res.json() as { lyrics?: string }
      if (data.lyrics) return `[Paroles générées par IA]\n\n${data.lyrics}`
    }
  } catch { /* ignore */ }

  return null
}

async function getAiMetadata(title: string, artist: string): Promise<Partial<UploadMeta> | null> {
  try {
    const res = await fetch('/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist }),
    })
    if (!res.ok) return null
    return await res.json() as Partial<UploadMeta>
  } catch { return null }
}

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    const cleanup = () => URL.revokeObjectURL(url)
    audio.addEventListener('loadedmetadata', () => { cleanup(); resolve(Math.floor(audio.duration)) })
    audio.addEventListener('error', () => { cleanup(); resolve(0) })
    setTimeout(() => { cleanup(); resolve(0) }, 5000)
  })
}

// ── Déduplication ──────────────────────────────────────────────────────────────

async function checkFingerprintDuplicate(fingerprint: string): Promise<{ isDuplicate: boolean; storageRef?: string }> {
  try {
    const { data, error } = await supabase
      .from('sounds')
      .select('id, audio_url, storage_ref')
      .eq('acoustid_fingerprint', fingerprint)
      .limit(1)

    if (error) return { isDuplicate: false }
    if (data && data.length > 0) {
      const s = data[0] as { id: string; audio_url: string; storage_ref: string | null }
      return { isDuplicate: true, storageRef: s.storage_ref ?? s.id }
    }
  } catch { /* column may not exist yet */ }
  return { isDuplicate: false }
}

// Columns that may not exist in older DB deployments — stripped on retry
const OPTIONAL_COLUMNS = [
  'audio_url_original', 'acoustid_fingerprint', 'storage_ref', 'status',
  'file_size_original', 'file_size_compressed', 'bitrate', 'audio_format',
  'compression_attempts', 'compressed_at', 'mood', 'energy_level',
  'themes', 'similar_sounds', 'youtube_url', 'deezer_artist_id',
]

// Fire-and-forget: resolve Deezer artist ID and store it for all rows of this artist
function resolveAndStoreDeezerArtistId(artistName: string, songTitle: string) {
  fetch('/api/resolve-deezer-artist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistName: artistName.trim(), titles: [songTitle.trim()] }),
  })
    .then((r) => r.ok ? r.json() : null)
    .then((data: { deezerId: number | null } | null) => {
      if (!data?.deezerId) return
      supabase
        .from('sounds')
        .update({ deezer_artist_id: data.deezerId })
        .ilike('artist', artistName.trim())
        .is('deezer_artist_id', null)
        .then(() => {})
    })
    .catch(() => {})
}

// Insert with automatic fallback: if a column is missing, retry with core fields only
async function safeInsertSound(payload: Record<string, unknown>): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('sounds').insert(payload)
  if (!error) return { error: null }

  const isColumnError =
    error.message?.toLowerCase().includes('column') ||
    error.message?.toLowerCase().includes('schema cache')

  if (isColumnError) {
    const stripped = { ...payload }
    for (const col of OPTIONAL_COLUMNS) delete stripped[col]
    const { error: fallbackError } = await supabase.from('sounds').insert(stripped)
    return { error: fallbackError }
  }
  return { error }
}

async function checkTitleDuplicate(title: string, artist: string): Promise<{ isDuplicate: boolean; existing?: { title: string; artist: string; uploader_name: string } }> {
  const { data } = await supabase
    .from('sounds')
    .select('title, artist, uploader:profiles!uploaded_by(display_name)')
    .ilike('title', title.trim())
    .ilike('artist', artist.trim())
    .eq('is_public', true)
    .limit(1)

  if (data && data.length > 0) {
    const s = data[0] as { title: string; artist: string; uploader: Array<{ display_name: string | null }> | null }
    return { isDuplicate: true, existing: { title: s.title, artist: s.artist, uploader_name: s.uploader?.[0]?.display_name ?? 'Membre' } }
  }
  return { isDuplicate: false }
}

// ── Analyse fichier (identification + empreinte en parallèle) ─────────────────

async function analyzeFile(file: File): Promise<Partial<UploadItem>> {
  const parsed = parseFilename(file.name)
  const baseMeta: UploadMeta = {
    title: parsed?.title ?? file.name.replace(/\.[^/.]+$/, ''),
    artist: parsed?.artist ?? '',
    genre: '', year: '', producer: '', country: '', description: '', lyrics: '',
  }

  // Durée + empreinte + lookup MusicBrainz lancés EN PARALLÈLE
  const [duration, fingerprint, rec] = await Promise.all([
    getAudioDuration(file),
    computeFingerprint(file).catch(() => null),
    (parsed?.title && parsed?.artist)
      ? getMusicBrainzData(parsed.title, parsed.artist)
      : Promise.resolve(null),
  ])

  let meta = { ...baseMeta }

  if (rec) {
    meta = {
      ...meta,
      title: rec.title ?? meta.title,
      artist: rec['artist-credit']?.[0]?.name ?? meta.artist,
      year: rec['first-release-date']?.slice(0, 4) ?? '',
      genre: rec.genres?.[0]?.name ?? rec.tags?.[0]?.name ?? '',
      country: rec.releases?.[0]?.country ?? '',
    }
    // Paroles en parallèle avec la métadonnée déjà trouvée
    const lyrics = await getLyrics(meta.artist, meta.title)
    if (lyrics) meta.lyrics = lyrics
  } else if (parsed?.title && parsed?.artist) {
    const aiMeta = await getAiMetadata(parsed.title, parsed.artist)
    if (aiMeta) {
      meta = {
        ...meta, ...aiMeta,
        title: aiMeta.title?.trim() || meta.title,
        artist: aiMeta.artist?.trim() || meta.artist,
        genre: aiMeta.genre?.trim() || meta.genre,
        producer: aiMeta.producer?.trim() || meta.producer,
        country: aiMeta.country?.trim() || meta.country,
        year: aiMeta.year?.trim() || meta.year,
        description: aiMeta.description?.trim() || meta.description,
        lyrics: aiMeta.lyrics?.trim() || meta.lyrics,
      }
    }
  }

  return {
    meta,
    duration,
    status: 'ready',
    fileSizeOriginal: file.size,
    acoustidFingerprint: fingerprint ?? undefined,
    file,
  }
}

// ── Page upload ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const { profile } = useAuthStore()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { queue, isProcessing, completedCount, addItems, updateItem, removeItem, setIsProcessing, incrementCompleted, reset } = useUploadStore()
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeLabel, setAnalyzeLabel] = useState('')
  const [showOptimizingHint, setShowOptimizingHint] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)

  const onFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setAnalyzing(true)
    setAnalyzeProgress(0)
    setUploadComplete(false)

    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      meta: {
        title: parseFilename(file.name)?.title ?? file.name.replace(/\.[^/.]+$/, ''),
        artist: parseFilename(file.name)?.artist ?? '',
        genre: '', year: '', producer: '', country: '', description: '', lyrics: '',
      },
      duration: 0,
    }))
    addItems(newItems)

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]
      updateItem(item.id, { status: 'analyzing' })
      setAnalyzeLabel(`Identification ${i + 1}/${newItems.length}…`)

      const result = await analyzeFile(item.file)
      updateItem(item.id, result)
      setAnalyzeProgress(Math.round(((i + 1) / newItems.length) * 100))
    }

    setAnalyzing(false)
    setAnalyzeLabel('')
    if (fileRef.current) fileRef.current.value = ''
  }, [addItems, updateItem])

  const UPLOAD_LIMIT = 1000

  const uploadSingleItem = useCallback(async (item: UploadItem) => {
    if (!profile) return
    updateItem(item.id, { status: 'uploading' })
    try {
      // Enforce 1000-song limit per user
      const { count } = await supabase
        .from('sounds')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', profile.id)
      if ((count ?? 0) >= UPLOAD_LIMIT) {
        updateItem(item.id, { status: 'error', error: `Limite de ${UPLOAD_LIMIT} sons atteinte. Supprime des sons pour en uploader de nouveaux.` })
        return
      }

      // Si doublon de fingerprint → référencer sans ré-uploader le fichier
      if (item.acoustidFingerprint) {
        const fpCheck = await checkFingerprintDuplicate(item.acoustidFingerprint)
        if (fpCheck.isDuplicate && fpCheck.storageRef) {
          const { error: refErr } = await safeInsertSound({
            title: item.meta.title.trim(),
            artist: item.meta.artist.trim(),
            artists: [item.meta.artist.trim()],
            producer: item.meta.producer.trim() || null,
            genre: item.meta.genre.trim() || null,
            year: item.meta.year ? parseInt(item.meta.year) : null,
            country: item.meta.country.trim() || null,
            description: item.meta.description.trim() || null,
            lyrics: item.meta.lyrics.trim() || null,
            audio_url: fpCheck.storageRef,
            audio_url_original: fpCheck.storageRef,
            duration: item.duration,
            uploaded_by: profile.id,
            is_public: true,
            status: 'ready',
            acoustid_fingerprint: item.acoustidFingerprint,
            storage_ref: fpCheck.storageRef,
            file_size_original: item.fileSizeOriginal,
          })
          if (refErr) throw new Error(refErr.message)
          resolveAndStoreDeezerArtistId(item.meta.artist, item.meta.title)
          updateItem(item.id, { status: 'done' })
          incrementCompleted()
          return
        }
      }

      // Upload du fichier original (la compression se fera en arrière-plan)
      const ext = item.file.name.split('.').pop() ?? 'mp3'
      const storagePath = `${profile.id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage.from('audio-files').upload(storagePath, item.file, {
        contentType: item.file.type || 'audio/mpeg',
        cacheControl: '86400',
      })
      if (upErr) throw new Error(upErr.message)

      // Insérer le son — safeInsertSound gère les colonnes manquantes en DB
      const { error: insErr } = await safeInsertSound({
        title: item.meta.title.trim(),
        artist: item.meta.artist.trim(),
        artists: [item.meta.artist.trim()],
        producer: item.meta.producer.trim() || null,
        genre: item.meta.genre.trim() || null,
        year: item.meta.year ? parseInt(item.meta.year) : null,
        country: item.meta.country.trim() || null,
        description: item.meta.description.trim() || null,
        lyrics: item.meta.lyrics.trim() || null,
        audio_url: storagePath,
        audio_url_original: storagePath,
        duration: item.duration,
        uploaded_by: profile.id,
        is_public: true,
        status: 'processing',
        acoustid_fingerprint: item.acoustidFingerprint ?? null,
        storage_ref: null,
        file_size_original: item.fileSizeOriginal ?? null,
      })
      if (insErr) throw new Error(insErr.message)

      resolveAndStoreDeezerArtistId(item.meta.artist, item.meta.title)
      updateItem(item.id, { status: 'done' })
      incrementCompleted()
    } catch (e: unknown) {
      updateItem(item.id, { status: 'error', error: e instanceof Error ? e.message : 'Erreur' })
    }
  }, [profile, updateItem, incrementCompleted])

  const skipItem = useCallback((itemId: string) => {
    removeItem(itemId)
  }, [removeItem])

  const forceUpload = useCallback(async (itemId: string) => {
    const item = queue.find(i => i.id === itemId)
    if (!item) return
    await uploadSingleItem(item)
    const allDone = useUploadStore.getState().queue.every((i) => i.status === 'done' || i.status === 'error')
    if (allDone) { setIsProcessing(false); reset() }
  }, [queue, uploadSingleItem, reset, setIsProcessing])

  const publishAll = useCallback(async () => {
    if (!profile || isProcessing) return
    const ready = queue.filter((i) => i.status === 'ready')
    if (!ready.length) return
    setIsProcessing(true)

    for (const item of ready) {
      const dupCheck = await checkTitleDuplicate(item.meta.title, item.meta.artist)
      if (dupCheck.isDuplicate && dupCheck.existing) {
        updateItem(item.id, { status: 'duplicate', duplicateInfo: dupCheck.existing })
        continue
      }
      await uploadSingleItem(item)
    }

    const state = useUploadStore.getState()
    const hasDuplicates = state.queue.some((i) => i.status === 'duplicate')
    const allResolved = state.queue.every((i) => i.status === 'done' || i.status === 'error')
    setIsProcessing(false)

    if (allResolved) {
      // Bust feed cache so new sounds appear immediately on next visit
      useFeedStore.getState().reset()
      setUploadComplete(true)
      if (!hasDuplicates) {
        setShowOptimizingHint(true)
        setTimeout(() => setShowOptimizingHint(false), 4000)
      }
    }
  }, [profile, isProcessing, queue, updateItem, uploadSingleItem, setIsProcessing])

  const readyCount = queue.filter((i) => i.status === 'ready').length
  const doneCount = queue.filter((i) => i.status === 'done').length
  const totalCount = queue.length
  const uploadProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div style={{ padding: spacing.lg, maxWidth: 600, margin: '0 auto', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0 }}>Uploader des sons</h1>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${colors.border}`, borderRadius: radius.lg, padding: `${spacing.xl}px ${spacing.lg}px`, textAlign: 'center', cursor: 'pointer', background: colors.surface, marginBottom: spacing.lg }}
      >
        <div style={{ fontSize: 40, marginBottom: spacing.sm }}>🎵</div>
        <p style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 500, margin: 0 }}>
          {queue.length > 0 ? '+ Ajouter d\'autres fichiers' : 'Sélectionner des fichiers audio'}
        </p>
        <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginTop: 4 }}>MP3, AAC, FLAC, WAV — plusieurs fichiers autorisés</p>
        <input ref={fileRef} type="file" accept="audio/*" multiple onChange={onFilePick} style={{ display: 'none' }} />
      </div>

      {/* Progression identification */}
      {analyzing && (
        <div style={{ background: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize }}>
              {analyzeLabel || '🔍 Identification en cours…'}
            </span>
            <span style={{ color: colors.primary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>{analyzeProgress}%</span>
          </div>
          <div style={{ height: 4, background: colors.surfaceElevated, borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${analyzeProgress}%`, background: `linear-gradient(90deg, #FF6A00, #D94F2A)`, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Progression upload */}
      {isProcessing && (
        <div style={{ background: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, border: `1px solid ${colors.primary}40` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize }}>⬆️ Publication en cours…</span>
            <span style={{ color: colors.primary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>{doneCount}/{totalCount}</span>
          </div>
          <div style={{ height: 6, background: colors.surfaceElevated, borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: `linear-gradient(90deg, #FF6A00, #D94F2A)`, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Hint discret optimisation arrière-plan */}
      {showOptimizingHint && (
        <div style={{ background: `${colors.success}15`, border: `1px solid ${colors.success}30`, borderRadius: radius.md, padding: `${spacing.sm}px ${spacing.md}px`, marginBottom: spacing.lg, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <span style={{ color: colors.success, fontSize: typography.sm.fontSize }}>Sons publiés — optimisation audio en cours en arrière-plan</span>
        </div>
      )}

      {/* File queue */}
      {queue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.lg }}>
          {queue.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              onChange={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              onSkip={() => skipItem(item.id)}
              onForceUpload={() => forceUpload(item.id)}
              disabled={isProcessing}
            />
          ))}
        </div>
      )}

      {/* Publier */}
      {readyCount > 0 && (
        <button
          onClick={publishAll}
          disabled={isProcessing}
          style={{
            width: '100%', padding: `${spacing.md}px`, borderRadius: radius.md, border: 'none',
            background: isProcessing ? colors.surface : `linear-gradient(135deg, #FF6A00, #D94F2A)`,
            color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          {isProcessing ? `Publication… (${doneCount}/${totalCount})` : `Publier ${readyCount} son${readyCount > 1 ? 's' : ''}`}
        </button>
      )}

      {uploadComplete && (
        <button
          onClick={() => { reset(); router.push('/feed') }}
          style={{
            width: '100%', marginTop: spacing.md, padding: `${spacing.md}px`,
            borderRadius: radius.md, border: 'none',
            background: 'linear-gradient(135deg, #FF6A00, #D94F2A)',
            color: '#fff', fontSize: typography.base.fontSize, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <i className="fa-solid fa-house" />
          Voir dans le feed
        </button>
      )}
    </div>
  )
}

// ── Title-case formatter ───────────────────────────────────────────────────────
// Capitalizes the first letter of each word; leaves the rest of each word as-is
// so abbreviations like "DJ", "R&B", "ft." are preserved.
function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((word) => word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ')
    .trim()
}

// ── QueueCard ──────────────────────────────────────────────────────────────────

function QueueCard({ item, onChange, onRemove, onSkip, onForceUpload, disabled }: {
  item: UploadItem
  onChange: (u: Partial<UploadItem>) => void
  onRemove: () => void
  onSkip: () => void
  onForceUpload: () => void
  disabled: boolean
}) {
  const statusColor = item.status === 'done' ? colors.success : item.status === 'error' ? colors.error : item.status === 'uploading' ? colors.primary : item.status === 'duplicate' ? colors.error : colors.textMuted
  const statusIcon = item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : item.status === 'uploading' ? '⬆' : item.status === 'analyzing' ? '🔍' : item.status === 'duplicate' ? '⚠' : '⏳'

  const statusLabel = () => {
    if (item.status === 'analyzing') return 'Identification…'
    if (item.status === 'uploading') return 'Publication…'
    if (item.status === 'done') return 'Publié'
    if (item.status === 'error') return item.error ?? 'Erreur'
    if (item.status === 'duplicate') return 'Doublon détecté'
    return 'Prêt'
  }

  const setMeta = (key: keyof UploadMeta, value: string) =>
    onChange({ meta: { ...item.meta, [key]: value } })

  const inputStyle = {
    width: '100%', background: colors.surfaceElevated, border: `1px solid ${colors.border}`,
    borderRadius: radius.sm, padding: `6px ${spacing.sm}px`, color: colors.textPrimary,
    fontSize: typography.sm.fontSize, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }

  return (
    <div style={{ background: colors.surface, borderRadius: radius.lg, border: `1px solid ${item.status === 'error' ? colors.error : item.status === 'done' ? colors.success : colors.border}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ width: 44, height: 44, borderRadius: radius.sm, background: colors.surfaceElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🎵
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.meta.title || item.file.name}
          </div>
          <div style={{ color: statusColor, fontSize: typography.xs.fontSize }}>{statusIcon} {statusLabel()}</div>
        </div>
        {!disabled && item.status !== 'done' && (
          <button onClick={onRemove} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 18, padding: 4 }}>✕</button>
        )}
      </div>

      {/* Doublon info */}
      {item.status === 'duplicate' && item.duplicateInfo && (
        <div style={{ padding: `${spacing.sm}px ${spacing.md}px`, color: colors.error, fontSize: typography.xs.fontSize, borderBottom: `1px solid ${colors.border}` }}>
          Ce son existe déjà : {item.duplicateInfo.title} par {item.duplicateInfo.artist} (publié par {item.duplicateInfo.uploader_name})
        </div>
      )}
      {item.status === 'duplicate' && !disabled && (
        <div style={{ display: 'flex', gap: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px` }}>
          <button onClick={onSkip} style={{ flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textMuted, fontSize: typography.xs.fontSize, cursor: 'pointer' }}>
            Ignorer
          </button>
          <button onClick={onForceUpload} style={{ flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.md, border: 'none', background: `linear-gradient(135deg, #FF6A00, #D94F2A)`, color: colors.textPrimary, fontSize: typography.xs.fontSize, cursor: 'pointer' }}>
            Publier quand même
          </button>
        </div>
      )}

      {/* Champs éditables */}
      {(item.status === 'ready' || item.status === 'error') && (
        <div style={{ padding: spacing.md, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Titre *</label>
            <input
              value={item.meta.title}
              onChange={(e) => setMeta('title', e.target.value)}
              onBlur={(e) => setMeta('title', toTitleCase(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Artiste *</label>
            <input
              value={item.meta.artist}
              onChange={(e) => setMeta('artist', e.target.value)}
              onBlur={(e) => setMeta('artist', toTitleCase(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Genre</label>
            <input
              value={item.meta.genre}
              onChange={(e) => setMeta('genre', e.target.value)}
              onBlur={(e) => setMeta('genre', toTitleCase(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Année</label>
            <input value={item.meta.year} onChange={(e) => setMeta('year', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Producteur</label>
            <input
              value={item.meta.producer}
              onChange={(e) => setMeta('producer', e.target.value)}
              onBlur={(e) => setMeta('producer', toTitleCase(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Pays</label>
            <input
              value={item.meta.country}
              onChange={(e) => setMeta('country', e.target.value)}
              onBlur={(e) => setMeta('country', toTitleCase(e.target.value))}
              style={inputStyle}
            />
          </div>
          {item.meta.lyrics && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ color: colors.success, fontSize: 11 }}>✓ Paroles trouvées automatiquement</label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
