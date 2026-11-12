export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

let seq = 0

/** Notificaciones efímeras del panel (renderizadas por <AdminToaster/>). */
export function useToast() {
  const toasts = useState<Toast[]>('admin:toasts', () => [])

  function push(type: Toast['type'], message: string, timeout = 5000) {
    const id = ++seq
    toasts.value = [...toasts.value, { id, type, message }]
    if (import.meta.client && timeout > 0) setTimeout(() => dismiss(id), timeout)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m, 8000),
    info: (m: string) => push('info', m),
  }
}
