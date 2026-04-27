import { NextRequest, NextResponse } from 'next/server'
import { askAI, parseJSON } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const { title, artist } = (await req.json()) as { title: string; artist: string }

  if (!title || !artist) {
    return NextResponse.json({ error: 'Titre et artiste requis' }, { status: 400 })
  }

  const prompt = `Analyse ce titre musical et retourne UNIQUEMENT un objet JSON avec ces champs exacts :
{ "title": string, "artist": string, "album": string, "producer": string, "year": string, "genre": string, "country": string, "description": string, "lyrics": string }

Titre : ${title}
Artiste : ${artist}

Utilise le français pour la description. Si tu ne peux pas inférer un champ, retourne une chaîne vide.
Réponds uniquement en JSON, sans markdown.`

  try {
    const raw = await askAI(prompt, 400)
    const data = parseJSON<Record<string, string>>(raw)
    return NextResponse.json(data)
  } catch (_e) {
    return NextResponse.json({ error: 'metadata generation failed' }, { status: 500 })
  }
}
