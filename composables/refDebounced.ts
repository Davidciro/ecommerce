import type { Ref } from 'vue'

/** Copia de `source` que solo se actualiza tras `delay` ms sin cambios (búsquedas). */
export function refDebounced<T>(source: Ref<T>, delay = 300): Ref<T> {
  const out = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (value) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { out.value = value }, delay)
  })
  if (getCurrentInstance()) onBeforeUnmount(() => timer && clearTimeout(timer))
  return out
}
