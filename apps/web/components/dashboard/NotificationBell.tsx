'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Notification } from '@/app/api/notifications/route'

const LS_KEY = 'mei_dismissed_notifications'

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(Array.from(ids)))
}

function notifIcon(type: Notification['type']) {
  switch (type) {
    case 'cert_expiring':   return '🔐'
    case 'plan_limit_100':  return '🚨'
    case 'plan_limit_80':   return '⚠️'
    case 'nota_autorizada': return '✅'
    case 'nota_rejeitada':  return '❌'
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [dismissed, setDismissed]         = useState<Set<string>>(new Set())
  const [open, setOpen]                   = useState(false)
  const [mounted, setMounted]             = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    setDismissed(getDismissed())

    async function load() {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok) return
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      } catch { /* non-fatal */ }
    }

    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!mounted) return <div className="w-9 h-9" aria-hidden />

  const visible  = notifications.filter(n => !dismissed.has(n.id))
  const unread   = visible.length

  function dismiss(id: string) {
    const next = new Set(Array.from(dismissed).concat(id))
    setDismissed(next)
    saveDismissed(next)
  }

  function dismissAll() {
    const next = new Set(Array.from(dismissed).concat(visible.map(n => n.id)))
    setDismissed(next)
    saveDismissed(next)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notificações${unread > 0 ? ` — ${unread} não lidas` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-2 hover:text-text-1 hover:bg-navy-600 transition"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M9 2a5 5 0 0 1 5 5v2l1.5 2.5H2.5L4 9V7a5 5 0 0 1 5-5z" />
          <path d="M7.5 14.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-nota-rejeitada text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[calc(100vw-2rem)] bg-navy-700 border border-navy-600 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-600">
            <p className="font-semibold text-sm text-text-1">Notificações</p>
            {unread > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-text-2 hover:text-brand-cyan transition"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-text-2">Tudo em ordem. Nenhuma notificação.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-navy-600">
              {visible.map(n => (
                <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-navy-600/30 transition">
                  <span className="text-base shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={n.href}
                      onClick={() => { dismiss(n.id); setOpen(false) }}
                      className="block"
                    >
                      <p className="text-sm font-medium text-text-1 leading-snug">{n.title}</p>
                      <p className="text-xs text-text-2 mt-0.5 leading-relaxed">{n.body}</p>
                    </Link>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Dispensar"
                    className="shrink-0 text-text-2 hover:text-nota-rejeitada transition text-xs mt-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
