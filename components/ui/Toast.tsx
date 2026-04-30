'use client'
import { useEffect, useState } from 'react'
import Icon from './Icon'

export type ToastType = 'success' | 'error' | 'info'

export type ToastMessage = {
  id:      string
  type:    ToastType
  message: string
}

// Simple singleton toast store
let _setToasts: ((fn: (prev: ToastMessage[]) => ToastMessage[]) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
  if (!_setToasts) return
  const id = Math.random().toString(36).slice(2)
  _setToasts(prev => [...prev, { id, type, message }])
  setTimeout(() => {
    _setToasts?.(prev => prev.filter(t => t.id !== id))
  }, 3500)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null } }, [])

  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto max-w-xs animate-in slide-in-from-bottom-2 ${
            t.type === 'success' ? 'bg-white border-green-200 text-green-800' :
            t.type === 'error'   ? 'bg-white border-red-200 text-red-800' :
                                   'bg-white border-blue-200 text-blue-800'
          }`}
        >
          <Icon
            name={t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
            size="sm"
            className={t.type === 'success' ? 'text-green-500' : t.type === 'error' ? 'text-red-500' : 'text-blue-500'}
          />
          {t.message}
        </div>
      ))}
    </div>
  )
}
