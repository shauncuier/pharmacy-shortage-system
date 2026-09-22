'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  text: string
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2.5 w-[92%] max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const [isExiting, setIsExiting] = useState(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3500)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      onDismissRef.current(toast.id)
    }, 200)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, duration])

  const colors = {
    success: 'bg-emerald-800 text-white border-emerald-600 shadow-emerald-900/20',
    error: 'bg-rose-800 text-white border-rose-600 shadow-rose-900/20',
    info: 'bg-sky-800 text-white border-sky-600 shadow-sky-900/20',
  }

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-300 shrink-0" />,
  }

  return (
    <div
      role="alert"
      className={`pointer-events-auto relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all duration-200 transform ${
        colors[toast.type]
      } ${
        isExiting
          ? 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
          : 'animate-in fade-in slide-in-from-top-3'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {icons[toast.type]}
        <span className="truncate leading-snug">{toast.text}</span>
      </div>

      <button
        onClick={handleDismiss}
        className="text-white/70 hover:text-white active:bg-white/20 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Subtle bottom countdown line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30 origin-left"
        style={{
          animation: `shrinkWidth ${duration}ms linear forwards`,
        }}
      />
      <style jsx>{`
        @keyframes shrinkWidth {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  )
}
