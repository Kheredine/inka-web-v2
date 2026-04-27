/**
 * POST /api/compress-trigger
 *
 * Webhook déclenché par Supabase Database Webhook sur INSERT dans sounds.
 * Notifie le worker audioCompressor immédiatement pour éviter d'attendre le poll 60s.
 *
 * Configuration Supabase :
 *   Dashboard → Database → Webhooks → New Webhook
 *   Table : sounds | Event : INSERT
 *   URL : https://<ton-domaine>/api/compress-trigger
 *   HTTP Headers : { "x-webhook-secret": "<COMPRESS_TRIGGER_SECRET>" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'

const SECRET = process.env.COMPRESS_TRIGGER_SECRET

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Vérification secret
  const incomingSecret = req.headers.get('x-webhook-secret')
  if (SECRET && incomingSecret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as { type?: string; table?: string }
    if (body.type !== 'INSERT' || body.table !== 'sounds') {
      return NextResponse.json({ ok: true, skipped: true })
    }
  } catch {
    // Body non JSON → continuer quand même
  }

  // Envoyer SIGUSR1 au worker pm2 si disponible
  // pm2 expose le PID dans un fichier ou via l'API pm2
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('pm2', ['sendSignal', 'SIGUSR1', 'inka-compressor'], err => {
        if (err) reject(err)
        else resolve()
      })
    })
    console.log('[compress-trigger] Signal envoyé au worker')
  } catch {
    // pm2 non disponible en dev ou worker non démarré → le poll 60s prendra le relais
    console.log('[compress-trigger] Worker non disponible, le poll prendra le relais')
  }

  return NextResponse.json({ ok: true })
}
