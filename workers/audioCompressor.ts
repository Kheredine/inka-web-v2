/**
 * audioCompressor.ts — Worker de compression audio Opus 128kbps
 *
 * Déploiement VPS IONOS :
 *   npm install -g ts-node
 *   pm2 start workers/audioCompressor.ts --interpreter ts-node --name inka-compressor
 *
 * Variables d'environnement requises (.env dans la racine du projet) :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← clé service (bypass RLS)
 *   COMPRESS_TRIGGER_SECRET     ← secret partagé avec /api/compress-trigger
 */

import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'

const execFileAsync = promisify(execFile)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const POLL_INTERVAL_MS = 60_000
const MAX_BATCH = 3
const OPUS_BITRATE = '128k'
let isProcessing = false

interface SoundRow {
  id: string
  title: string
  audio_url_original: string
  compression_attempts: number
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, res => {
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', err => {
      fs.unlink(dest, () => undefined)
      reject(err)
    })
  })
}

function getFileSizeMB(filePath: string): number {
  return fs.statSync(filePath).size / (1024 * 1024)
}

async function compressSound(sound: SoundRow): Promise<void> {
  const tmpDir = os.tmpdir()
  const inputPath = path.join(tmpDir, `inka-input-${sound.id}`)
  const outputPath = path.join(tmpDir, `inka-output-${sound.id}.opus`)

  try {
    // Récupérer signed URL du fichier original
    const { data: urlData, error: urlError } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(sound.audio_url_original, 3600)

    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Signed URL introuvable : ${urlError?.message}`)
    }

    await downloadFile(urlData.signedUrl, inputPath)

    const sizeBefore = getFileSizeMB(inputPath)

    // Détecter si déjà Opus ≥ 128kbps via ffprobe
    let alreadyOpus = false
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        inputPath,
      ])
      const probe = JSON.parse(stdout) as { streams: Array<{ codec_name?: string; bit_rate?: string }> }
      const audioStream = probe.streams.find(s => s.codec_name)
      if (audioStream?.codec_name === 'opus' && parseInt(audioStream.bit_rate ?? '0') >= 128_000) {
        alreadyOpus = true
      }
    } catch {
      // ffprobe non disponible ou erreur → continuer avec compression
    }

    if (alreadyOpus) {
      await supabase.from('sounds').update({
        status: 'ready',
        compressed_at: new Date().toISOString(),
      }).eq('id', sound.id)
      console.log(`[compressor] ${sound.title} : déjà Opus 128kbps, marqué ready`)
      return
    }

    // Compression ffmpeg → Opus 128kbps VBR
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:a', 'libopus',
      '-b:a', OPUS_BITRATE,
      '-vbr', 'on',
      '-compression_level', '10',
      '-y',
      outputPath,
    ])

    const sizeAfter = getFileSizeMB(outputPath)
    const reduction = Math.round((1 - sizeAfter / sizeBefore) * 100)

    // Upload fichier compressé
    const compressedBuffer = fs.readFileSync(outputPath)
    const storagePath = `compressed/${sound.id}`

    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, compressedBuffer, {
        contentType: 'audio/ogg',
        upsert: true,
      })

    if (uploadError) throw new Error(`Upload échoué : ${uploadError.message}`)

    await supabase.from('sounds').update({
      audio_url: storagePath,
      status: 'ready',
      file_size_original: Math.round(sizeBefore * 1024 * 1024),
      file_size_compressed: Math.round(sizeAfter * 1024 * 1024),
      compressed_at: new Date().toISOString(),
    }).eq('id', sound.id)

    console.log(`[compressor] ${sound.title} : ${sizeBefore.toFixed(1)}MB → ${sizeAfter.toFixed(1)}MB (-${reduction}%)`)
  } catch (err) {
    const attempts = sound.compression_attempts + 1
    const update: Record<string, unknown> = { compression_attempts: attempts }
    if (attempts >= 3) {
      update.status = 'error'
      // audio_url reste sur original (fallback silencieux)
    }
    await supabase.from('sounds').update(update).eq('id', sound.id)
    console.error(`[compressor] Erreur "${sound.title}" (tentative ${attempts}/3) :`, err)
  } finally {
    for (const p of [inputPath, outputPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  }
}

async function processBatch(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const { data: sounds, error } = await supabase
      .from('sounds')
      .select('id, title, audio_url_original, compression_attempts')
      .eq('status', 'processing')
      .lt('compression_attempts', 3)
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH)

    if (error) {
      console.error('[compressor] Erreur fetch sounds:', error.message)
      return
    }

    if (!sounds || sounds.length === 0) return

    console.log(`[compressor] ${sounds.length} son(s) à compresser`)

    for (const sound of sounds as SoundRow[]) {
      await compressSound(sound)
    }
  } finally {
    isProcessing = false
  }
}

// Démarrage : traitement immédiat + poll toutes les 60s
console.log('[compressor] Worker démarré — poll toutes les 60s')
processBatch()
setInterval(processBatch, POLL_INTERVAL_MS)

// Permet au webhook /api/compress-trigger de déclencher un traitement immédiat
process.on('SIGUSR1', () => {
  console.log('[compressor] Signal reçu, traitement immédiat')
  processBatch()
})
