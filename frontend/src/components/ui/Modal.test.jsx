import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Modal from './Modal.jsx'

// Historia HU202 (CA3 y CA4): la ventana solo se cierra con sus botones.
describe('Modal', () => {
  afterEach(cleanup)

  function renderModal(props = {}) {
    const onConfirm = vi.fn()
    const onDismiss = vi.fn()
    const utils = render(
      <Modal
        open
        title="Título de la ventana"
        actions={[
          { label: 'Cancelar', onClick: onDismiss },
          { label: 'Aceptar', onClick: onConfirm, primary: true },
        ]}
        {...props}
      >
        <p>Contenido</p>
      </Modal>,
    )
    return { ...utils, onConfirm, onDismiss }
  }

  it('se abre como modal, nombrada por su título y con el foco en el botón principal', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Título de la ventana' })

    expect(dialog.open).toBe(true)
    expect(screen.getByText('Contenido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus()
  })

  it('cada botón llama a su acción', () => {
    const { onConfirm, onDismiss } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('Escape no la cierra: cancela el evento cancel', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')

    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)

    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
  })

  it('un clic fuera del recuadro, sobre el fondo, no la cierra', () => {
    const { onConfirm, onDismiss } = renderModal()
    const dialog = screen.getByRole('dialog')

    fireEvent.click(dialog)

    expect(dialog.open).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('si el navegador la cierra por su cuenta mientras debe estar abierta, se vuelve a abrir', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')

    dialog.close()

    expect(dialog.open).toBe(true)
  })

  it('se cierra cuando quien la usa deja de pedirla abierta', () => {
    const { rerender } = renderModal()
    const dialog = screen.getByRole('dialog')

    rerender(
      <Modal open={false} title="Título de la ventana" actions={[]}>
        <p>Contenido</p>
      </Modal>,
    )

    expect(dialog.open).toBe(false)
  })
})
