import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import { requestDocumentLink } from './api.js'
import DocumentLoading from './DocumentLoading.jsx'
import DocumentSignIn from './DocumentSignIn.jsx'

// Creado así, Vite empaqueta el worker como un .js propio. Apuntar al .mjs de
// pdfjs-dist no basta: el sitio estático podría servirlo con un tipo que el
// navegador rechaza, porque sus respuestas llevan nosniff.
pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), {
  type: 'module',
})

const ZOOM_LEVELS = [1, 1.25, 1.5]
// Ancho de la página al 100 %, o el disponible si es menor.
const BASE_PAGE_WIDTH = 680

const FAILURE = { SIGNED_OUT: 'signedOut', UNAVAILABLE: 'unavailable', FAILED: 'failed' }

function describeFailure(error) {
  if (error.status === 401) return FAILURE.SIGNED_OUT
  if (error.code === 'DOCUMENT_TRANSFER_EXHAUSTED') return FAILURE.UNAVAILABLE
  return FAILURE.FAILED
}

/**
 * Visor de un apunte (historia HU411). El enlace firmado caduca al minuto, así
 * que el PDF se descarga entero en una sola petición: PDF.js, por defecto,
 * pediría partes más tarde y fallarían. «Descargar» guarda esa misma copia.
 */
export default function DocumentViewer({ resourceId, title }) {
  const [file, setFile] = useState(null)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = null

    requestDocumentLink(resourceId)
      .then(({ url }) => fetch(url, { signal: controller.signal }))
      .then((response) => {
        if (!response.ok) throw new Error(`El almacenamiento respondió ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setFile({ blob, url: objectUrl })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('No se pudo cargar el apunte', error)
        setFailure(describeFailure(error))
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [resourceId])

  if (failure === FAILURE.SIGNED_OUT) return <DocumentSignIn />

  if (failure === FAILURE.UNAVAILABLE) {
    return (
      <Notice title="Los apuntes no están disponibles por ahora">
        Vuelve a intentarlo más tarde. El catálogo y los videos siguen funcionando.
      </Notice>
    )
  }

  if (failure !== null) {
    return (
      <Notice title="No se pudo cargar el apunte" role="alert">
        Recarga la página para reintentar.
      </Notice>
    )
  }

  if (file === null) return <DocumentLoading />

  return <Reader file={file} title={title} onError={() => setFailure(FAILURE.FAILED)} />
}

function Reader({ file, title, onError }) {
  // Alto entre ancho de cada página: con él, las que aún no se dibujan ocupan
  // su sitio y el desplazamiento no salta.
  const [pageRatios, setPageRatios] = useState(null)
  const [zoomIndex, setZoomIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [nearPages, setNearPages] = useState(() => new Set())
  // Hasta medirlo no se pinta ninguna página: suponer un ancho y corregirlo
  // después haría saltar la página en el celular.
  const [availableWidth, setAvailableWidth] = useState(null)
  const pagesRef = useRef(null)
  const slotsRef = useRef(new Map())

  const zoom = ZOOM_LEVELS[zoomIndex]
  const pageWidth = availableWidth === null ? null : Math.floor(Math.min(BASE_PAGE_WIDTH, availableWidth) * zoom)
  const pageNumbers = pageRatios === null || pageWidth === null ? [] : pageRatios.map((_, index) => index + 1)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(pagesRef.current)
    return () => observer.disconnect()
  }, [])

  // Solo se dibujan las páginas a menos de una pantalla de distancia: todas a
  // la vez agotarían la memoria de un celular con un apunte largo. La página
  // actual es la que cruza la mitad de la pantalla.
  useEffect(() => {
    if (pageNumbers.length === 0) return undefined

    const near = new IntersectionObserver(
      (entries) => {
        setNearPages((previous) => {
          const next = new Set(previous)
          for (const entry of entries) {
            const page = Number(entry.target.dataset.page)
            if (entry.isIntersecting) next.add(page)
            else next.delete(page)
          }
          return next
        })
      },
      { rootMargin: '100% 0px' },
    )
    const reading = new IntersectionObserver(
      (entries) => {
        const crossing = entries.find((entry) => entry.isIntersecting)
        if (crossing) setCurrentPage(Number(crossing.target.dataset.page))
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    for (const slot of slotsRef.current.values()) {
      near.observe(slot)
      reading.observe(slot)
    }
    return () => {
      near.disconnect()
      reading.disconnect()
    }
  }, [pageNumbers.length])

  async function measurePages(pdf) {
    try {
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)))
      setPageRatios(
        pages.map((page) => {
          const { width, height } = page.getViewport({ scale: 1 })
          return height / width
        }),
      )
    } catch (error) {
      console.error('No se pudieron medir las páginas del apunte', error)
      onError()
    }
  }

  return (
    <section aria-label="Visor del apunte" className="rounded-2xl border border-border bg-surface-raised">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-surface-raised/95 px-3 py-2.5 backdrop-blur sm:px-3.5">
        <span className="font-mono text-label text-content tabular-nums">
          {pageRatios === null ? 'Abriendo el apunte…' : `Página ${currentPage} de ${pageRatios.length}`}
        </span>
        <div className="flex items-center gap-2">
          <ZoomButton label="Reducir" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
            <path d="M5 12h14" />
          </ZoomButton>
          <span className="min-w-12 text-center font-mono text-xs text-content-muted tabular-nums">
            {Math.round(zoom * 100)} %
          </span>
          <ZoomButton
            label="Ampliar"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex(zoomIndex + 1)}
          >
            <path d="M12 5v14M5 12h14" />
          </ZoomButton>
          <a href={file.url} download={`${title}.pdf`} className={`${buttonClasses('primary')} ml-1`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
            </svg>
            Descargar
          </a>
        </div>
      </div>

      <div ref={pagesRef} className="overflow-x-auto rounded-b-2xl bg-surface p-3 sm:p-6">
        {/* Sin Suspense: con él, react-pdf esconde el visor entero mientras
            prepara cada página e ignora onLoadError, y un PDF que no abre
            dejaría la ficha en blanco. Las páginas heredan el ajuste. */}
        <Document
          file={file.blob}
          suspense={false}
          onLoadSuccess={measurePages}
          onLoadError={onError}
          loading={null}
          error={null}
        >
          {pageNumbers.map((pageNumber) => (
            <div
              key={pageNumber}
              data-page={pageNumber}
              ref={(slot) => {
                if (slot) slotsRef.current.set(pageNumber, slot)
                else slotsRef.current.delete(pageNumber)
              }}
              className="mx-auto mb-3 bg-white shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)] last:mb-0 sm:mb-5"
              style={{ width: pageWidth, height: Math.round(pageWidth * pageRatios[pageNumber - 1]) }}
            >
              {nearPages.has(pageNumber) && <Page pageNumber={pageNumber} width={pageWidth} loading={null} />}
            </div>
          ))}
        </Document>
      </div>
    </section>
  )
}

function ZoomButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-[10px] border border-border-strong text-content hover:border-content-muted disabled:cursor-not-allowed disabled:opacity-35 sm:size-9.5"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
        className="size-4"
      >
        {children}
      </svg>
    </button>
  )
}
