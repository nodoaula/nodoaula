import { useState } from 'react'
import { Link } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Modal from '../../components/ui/Modal.jsx'
import Notice from '../../components/ui/Notice.jsx'

/**
 * Botón «Retirar» de la ficha (historia HU307), con confirmación: retirar
 * saca el recurso del catálogo para todos. Solo se muestra con `canRetire`.
 */
export function RetireAction({ busy, onConfirm }) {
  const [confirming, setConfirming] = useState(false)

  function confirmRetirement() {
    setConfirming(false)
    onConfirm()
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={buttonClasses('secondary')}>
        {busy ? 'Retirando…' : 'Retirar'}
      </button>

      <Modal
        open={confirming}
        title="¿Retirar este recurso?"
        actions={[
          { label: 'Cancelar', onClick: () => setConfirming(false) },
          { label: 'Sí, retirar', onClick: confirmRetirement, primary: true },
        ]}
      >
        <p className="text-sm text-slate-700">
          Dejará de aparecer en el catálogo, en la página de su curso, en la búsqueda y en la portada. No se borra:
          quien abra su enlace verá que ya no está disponible, y podrás volver a publicarlo desde esta ficha.
        </p>
      </Modal>
    </>
  )
}

/**
 * Ficha de un recurso retirado (historia HU307): a cualquiera le dice que ya
 * no está disponible, sin su contenido. A quien lo retiró le ofrece volver a
 * publicarlo, y solo a él le llega el título.
 */
export function RetiredNotice({ resource, justRetired, busy, onRepublish }) {
  const backToCatalog = (
    <Link to="/catalogo" className={buttonClasses('secondary')}>
      Volver al catálogo
    </Link>
  )

  if (!resource.canRepublish) {
    return (
      <Notice title="Este recurso ya no está disponible" action={backToCatalog}>
        Se retiró del catálogo y ya no se puede consultar.
      </Notice>
    )
  }

  return (
    <Notice
      title={justRetired ? 'Retiraste este recurso' : 'Este recurso ya no está disponible'}
      action={
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={onRepublish} className={buttonClasses('primary')}>
            {busy ? 'Publicando…' : 'Volver a publicar'}
          </button>
          {backToCatalog}
        </div>
      }
    >
      «{resource.title}» ya no aparece en el catálogo, en la búsqueda ni en la portada, y quien abra su enlace ve que
      no está disponible. Si lo vuelves a publicar, reaparece donde estaba.
    </Notice>
  )
}
