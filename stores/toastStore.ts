'use client'
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
