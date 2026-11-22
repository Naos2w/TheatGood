import type { Plugin } from 'vite'

/** Development-only plugin. Never included in Vite preview or production assets. */
export function privateShowtimeDevPlugin(root: string): Plugin
