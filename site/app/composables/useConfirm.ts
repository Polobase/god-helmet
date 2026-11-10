import { ConfirmDialog } from '#components'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

/**
 * Asks before something that cannot be undone, in place of the browser's
 * own confirm():
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete this set?', confirmLabel: 'Delete', danger: true })) …
 * Call useConfirm() in setup; the function it returns can be used anywhere.
 */
export function useConfirm() {
  const overlay = useOverlay()
  // A fresh dialog per question: one that destroys itself on close cannot be opened twice.
  return async (options: ConfirmOptions): Promise<boolean> =>
    Boolean(await overlay.create(ConfirmDialog, { destroyOnClose: true }).open(options).result)
}
