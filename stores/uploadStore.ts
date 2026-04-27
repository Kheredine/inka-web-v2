'use client'
import { create } from 'zustand'

export interface UploadMeta {
  title: string
  artist: string
  genre: string
  year: string
  producer: string
  country: string
  description: string
  lyrics: string
}

export interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'analyzing' | 'compressing' | 'ready' | 'uploading' | 'done' | 'error' | 'duplicate'
  meta: UploadMeta
  duration: number
  error?: string
  duplicateInfo?: { title: string; artist: string; uploader_name: string }
  // Compression data
  fileSizeOriginal?: number
  fileSizeCompressed?: number
  compressionProgress?: number
  acoustidFingerprint?: string
  // Duplicate ref (if this audio already exists in storage)
  storageRef?: string
}

interface UploadState {
  queue: UploadItem[]
  isProcessing: boolean
  completedCount: number

  addItems: (items: UploadItem[]) => void
  updateItem: (id: string, updates: Partial<UploadItem>) => void
  removeItem: (id: string) => void
  setIsProcessing: (v: boolean) => void
  incrementCompleted: () => void
  reset: () => void
}

export const useUploadStore = create<UploadState>((set, get) => ({
  queue: [],
  isProcessing: false,
  completedCount: 0,

  addItems: (items) => set({ queue: [...get().queue, ...items] }),
  updateItem: (id, updates) =>
    set({ queue: get().queue.map((i) => i.id === id ? { ...i, ...updates } : i) }),
  removeItem: (id) => set({ queue: get().queue.filter((i) => i.id !== id) }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  incrementCompleted: () => set({ completedCount: get().completedCount + 1 }),
  reset: () => set({ queue: [], isProcessing: false, completedCount: 0 }),
}))
