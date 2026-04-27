'use client'
import { create } from 'zustand'

interface InboxState {
  unreadCount: number
  setUnreadCount: (count: number) => void
  decrement: () => void
}

export const useInboxStore = create<InboxState>((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrement: () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
}))
