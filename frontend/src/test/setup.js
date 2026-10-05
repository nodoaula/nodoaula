// Extiende expect() de Vitest con los matchers de jest-dom (toBeInTheDocument,
// toHaveTextContent, etc.) para todos los archivos de prueba del frontend.
import '@testing-library/jest-dom/vitest'

// jsdom no implementa showModal ni close de <dialog>. Este es el mínimo que
// usa components/ui/Modal.jsx: abrir y cerrar con el atributo open, y avisar
// con el evento close, como el navegador.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
