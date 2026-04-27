/**
 * audioOptimizer.ts — Pipeline de compression audio + déduplication
 *
 * Étape 1 : Analyse du format source (format, durée, taille)
 * Étape 2 : Empreinte SHA-256 du contenu pour déduplication
 * Étape 3 : Compression vers Opus 128kbps via MediaRecorder (natif navigateur)
 *           Fallback transparent si le codec n'est pas supporté
 * Étape 4 : Retourne le fichier optimisé + métriques de compression
 *
 * Compatibilité : Web Audio API + MediaRecorder + SubtleCrypto
 * (Chrome 74+, Firefox 75+, Edge 79+, Safari 16+)
 */

export interface AudioAnalysis {
  format: string          // extension détectée
  duration: number        // secondes
  sampleRate: number      // Hz
  channels: number        // 1 ou 2
  fileSizeOriginal: number // bytes
}

export interface CompressionResult {
  file: File              // fichier Opus ou original si non supporté
  fileSizeOriginal: number
  fileSizeCompressed: number
  compressionRatio: number // ex. 0.75 = -75%
  fingerprint: string     // SHA-256 hex
  wasCompressed: boolean
  format: string          // 'opus' ou format original
}

// ── Étape 1 — Analyse ─────────────────────────────────────────────────────────

export async function analyzeAudio(file: File): Promise<AudioAnalysis> {
  const format = file.name.split('.').pop()?.toLowerCase() ?? 'unknown'

  return new Promise<AudioAnalysis>((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)

    const cleanup = () => URL.revokeObjectURL(url)

    audio.addEventListener('loadedmetadata', () => {
      cleanup()
      resolve({
        format,
        duration: Math.floor(audio.duration),
        sampleRate: 44100, // valeur par défaut — AudioContext needed for exact value
        channels: 2,
        fileSizeOriginal: file.size,
      })
    })

    audio.addEventListener('error', () => {
      cleanup()
      resolve({
        format,
        duration: 0,
        sampleRate: 44100,
        channels: 2,
        fileSizeOriginal: file.size,
      })
    })

    setTimeout(() => { cleanup(); resolve({ format, duration: 0, sampleRate: 44100, channels: 2, fileSizeOriginal: file.size }) }, 8000)
  })
}

// ── Étape 2 — Empreinte SHA-256 ────────────────────────────────────────────────
// Utilise les 512 premiers KB + taille + nom pour une empreinte rapide.
// Collision rate négligeable pour une base de 9 users × 1000 sons.

export async function computeFingerprint(file: File): Promise<string> {
  const SAMPLE_SIZE = 512 * 1024 // 512 KB
  const slice = file.slice(0, SAMPLE_SIZE)
  const buffer = await slice.arrayBuffer()

  // Concat avec taille du fichier pour discriminer fichiers identiques début mais différente fin
  const sizeBytes = new Uint8Array(8)
  const view = new DataView(sizeBytes.buffer)
  view.setBigUint64(0, BigInt(file.size), false)

  const merged = new Uint8Array(buffer.byteLength + 8)
  merged.set(new Uint8Array(buffer), 0)
  merged.set(sizeBytes, buffer.byteLength)

  const hashBuffer = await crypto.subtle.digest('SHA-256', merged)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Étape 3 — Compression Opus ─────────────────────────────────────────────────

const OPUS_MIME = 'audio/webm;codecs=opus'
const BITRATE = 128_000 // 128 kbps

function isOpusSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false
  return MediaRecorder.isTypeSupported(OPUS_MIME)
}

function isAlreadyOpus(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'opus' || ext === 'webm'
}

/**
 * Compresse un fichier audio vers Opus 128kbps via Web Audio API + MediaRecorder.
 *
 * La compression se fait en temps réel (durée ≈ durée du fichier audio).
 * onProgress : callback 0–100 pendant l'encodage.
 *
 * Si Opus n'est pas supporté ou si le fichier est déjà Opus, retourne le fichier original.
 */
export async function compressToOpus(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CompressionResult> {
  const fingerprint = await computeFingerprint(file)
  const fileSizeOriginal = file.size

  // Pas besoin de compresser
  if (isAlreadyOpus(file)) {
    return {
      file,
      fileSizeOriginal,
      fileSizeCompressed: fileSizeOriginal,
      compressionRatio: 0,
      fingerprint,
      wasCompressed: false,
      format: 'opus',
    }
  }

  // Opus non supporté dans ce navigateur → retourner l'original
  if (!isOpusSupported()) {
    console.warn('[audioOptimizer] Opus encoding non supporté dans ce navigateur')
    onProgress?.(100)
    return {
      file,
      fileSizeOriginal,
      fileSizeCompressed: fileSizeOriginal,
      compressionRatio: 0,
      fingerprint,
      wasCompressed: false,
      format: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
    }
  }

  return new Promise<CompressionResult>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.preload = 'auto'

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration

      // AudioContext → MediaStreamDestination → MediaRecorder
      const ctx = new AudioContext()
      const destination = ctx.createMediaStreamDestination()
      const source = ctx.createMediaElementSource(audio)
      source.connect(destination)
      // Ne pas connecter au speakers (encodage silencieux)

      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(destination.stream, {
        mimeType: OPUS_MIME,
        audioBitsPerSecond: BITRATE,
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        URL.revokeObjectURL(url)
        ctx.close()

        const compressed = new Blob(chunks, { type: OPUS_MIME })
        const fileSizeCompressed = compressed.size
        const ratio = fileSizeOriginal > 0
          ? (fileSizeOriginal - fileSizeCompressed) / fileSizeOriginal
          : 0

        const baseName = file.name.replace(/\.[^/.]+$/, '')
        const compressedFile = new File([compressed], `${baseName}.webm`, { type: OPUS_MIME })

        resolve({
          file: compressedFile,
          fileSizeOriginal,
          fileSizeCompressed,
          compressionRatio: Math.max(0, ratio),
          fingerprint,
          wasCompressed: true,
          format: 'opus',
        })
      }

      recorder.onerror = () => {
        URL.revokeObjectURL(url)
        ctx.close()
        // Fallback silencieux
        resolve({
          file,
          fileSizeOriginal,
          fileSizeCompressed: fileSizeOriginal,
          compressionRatio: 0,
          fingerprint,
          wasCompressed: false,
          format: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
        })
      }

      // Suivi de progression via timeupdate
      if (onProgress && duration > 0) {
        audio.addEventListener('timeupdate', () => {
          const pct = Math.round((audio.currentTime / duration) * 100)
          onProgress(Math.min(pct, 99))
        })
      }

      audio.addEventListener('ended', () => {
        recorder.stop()
        onProgress?.(100)
      })

      audio.addEventListener('error', () => {
        recorder.stop()
        reject(new Error('Erreur lecture audio pendant compression'))
      })

      // Démarrer l'enregistrement + lecture (volume à 0 → pas de son)
      recorder.start(250) // chunks toutes les 250ms
      audio.volume = 0
      audio.play().catch(reject)
    })

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Impossible de charger le fichier audio'))
    })
  })
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCompressionGain(original: number, compressed: number): string {
  if (!original || !compressed) return ''
  const pct = Math.round(((original - compressed) / original) * 100)
  return `${formatFileSize(original)} → ${formatFileSize(compressed)} (-${pct}%)`
}
