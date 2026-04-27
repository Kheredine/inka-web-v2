'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Playlist, Sound } from '@/types'

export interface PlaylistWithSounds extends Playlist {
  playlist_sounds?: Array<{ sound: Sound; position: number }>
}

export function usePlaylists(userId: string | undefined) {
  const [playlists, setPlaylists] = useState<PlaylistWithSounds[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('playlists')
      .select('*, playlist_sounds(position, sound:sounds(*, reactions(*)))')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
    const playlists = (data as PlaylistWithSounds[]) ?? []
    const uniqueByTitle: PlaylistWithSounds[] = []
    const seen = new Set<string>()
    for (const playlist of playlists) {
      const key = `${playlist.title.trim().toLowerCase()}|${(playlist.description ?? '').trim().toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueByTitle.push(playlist)
      }
    }
    setPlaylists(uniqueByTitle)
    setLoading(false)
  }, [userId])

  const create = useCallback(async (title: string, description?: string): Promise<Playlist | null> => {
    if (!userId) return null
    const { data } = await supabase
      .from('playlists')
      .insert({ title, description: description ?? '', created_by: userId, is_public: false })
      .select()
      .single()
    await load()
    return data as Playlist
  }, [userId, load])

  const update = useCallback(async (id: string, title: string, description?: string) => {
    await supabase.from('playlists').update({ title, description }).eq('id', id)
    await load()
  }, [load])

  const remove = useCallback(async (id: string) => {
    await supabase.from('playlists').delete().eq('id', id)
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }, [])

  const addSound = useCallback(async (playlistId: string, soundId: string) => {
    const { data: existing } = await supabase
      .from('playlist_sounds')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
    const position = (((existing?.[0] as { position?: number })?.position) ?? 0) + 1
    await supabase.from('playlist_sounds').upsert({ playlist_id: playlistId, sound_id: soundId, position })
    await load()
  }, [load])

  const removeSound = useCallback(async (playlistId: string, soundId: string) => {
    await supabase.from('playlist_sounds').delete().eq('playlist_id', playlistId).eq('sound_id', soundId)
    await load()
  }, [load])

  return { playlists, loading, load, create, update, remove, addSound, removeSound }
}
