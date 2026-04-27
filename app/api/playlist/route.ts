import { NextRequest, NextResponse } from 'next/server'
import { askAI, parseJSON } from '@/lib/ai'

interface PlaylistResponse {
  title: string
  tags: string[]
  description: string
}

export async function POST(req: NextRequest) {
  const { songs } = (await req.json()) as { songs: Array<{ title: string; artist: string; genre?: string }> }
  const list = songs.map(s => `"${s.title}" par ${s.artist}${s.genre ? ` (${s.genre})` : ''}`).join(', ')

  const prompt = `Tu es un curateur musical créatif. Voici les sons : ${list}.

Retourne UNIQUEMENT un objet JSON avec ces champs exacts :
{
  "title": nom de playlist créatif et évocateur en français (2 à 4 mots, sans guillemets),
  "tags": tableau de 2 à 3 tags d'ambiance en français,
  "description": une phrase en français
}

Réponds uniquement en JSON, sans markdown.`

  try {
    const raw = await askAI(prompt, 150)
    const data = parseJSON<PlaylistResponse>(raw)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ title: 'Ma Playlist', tags: [], description: '' })
  }
}
