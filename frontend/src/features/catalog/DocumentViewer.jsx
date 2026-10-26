import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import { requestDocumentLink, requestPreviewLink } from './api.js'
import DocumentLoading from './DocumentLoading.jsx'
import DocumentSignIn, { SignInInvitation } from './DocumentSignIn.jsx'

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

// Lee el PDF por partes para mostrar cuánto ha llegado. Sin tamaño conocido
// no hay porcentaje que dar, y se lee de una vez.
async function readWithProgress(response, onProgress) {
  const total = Number(response.headers.get('Content-Length'))
  if (!total || !response.body) return response.blob()

  const chunks = []
  let received = 0
  onProgress(0)
  await response.body.pipeTo(
    new WritableStream({
      write(chunk) {
        chunks.push(chunk)
        received += chunk.length
        onProgress(Math.min(100, Math.floor((received * 100) / total)))
      },
    }),
  )
  return new Blob(chunks, { type: 'application/pdf' })
}

function describeFailure(error) {
  if (error.status === 401) return FAILURE.SIGNED_OUT
  if (error.code === 'DOCUMENT_TRANSFER_EXHAUSTED') return FAILURE.UNAVAILABLE
  return FAILURE.FAILED
}

/**
 * Visor de un apunte (historia HU411). El enlace firmado caduca al minuto, así
 * que el PDF se descarga entero en una sola petición: PDF.js, por defecto,
 * pediría partes más tarde y fallarían. «Descargar» guarda esa misma copia.
 *
 * Con `previewOf`, el total de páginas del apunte, muestra su vista previa a
 * quien no tiene sesión (historia HU412): sin «Descargar» y con la invitación
 * a iniciarla después de la última página.
 */
export default function DocumentViewer({ resourceId, title, previewOf = null }) {
  const [file, setFile] = useState(null)
  const [failure, setFailure] = useState(null)
  const [progress, setProgress] = useState(null)

  const isPreview = previewOf !== null

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = null

    const requestLink = isPreview ? requestPreviewLink : requestDocumentLink
    requestLink(resourceId)
      .then(({ url }) => fetch(url, { signal: controller.signal }))
      .then((response) => {
        if (!response.ok) throw new Error(`El almacenamiento respondió ${response.status}`)
        return readWithProgress(response, setProgress)
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
  }, [resourceId, isPreview])

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

  if (file === null) return <DocumentLoading progress={progress} />

  return <Reader file={file} title={title} previewOf={previewOf} onError={() => setFailure(FAILURE.FAILED)} />
}

function Reader({ file, title, previewOf, onError }) {
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-label text-content tabular-nums">
            {pageRatios === null ? (
              'Abriendo el apunte…'
            ) : (
              <PageCounter
                current={currentPage}
                total={previewOf ?? pageRatios.length}
                compact={previewOf !== null}
              />
            )}
          </span>
          {previewOf !== null && pageRatios !== null && (
            <span className="rounded-full border border-accent/35 px-2.5 py-0.5 font-mono text-xs text-accent tabular-nums">
              Vista previa<span className="max-sm:hidden"> · {pageRatios.length} de {previewOf} páginas</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ZoomButton label="Reducir" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
            <path d="M5 12h14" />
          </ZoomButton>
          {/* En el celular, sin el porcentaje la barra cabe en una fila: el
              tamaño de la página ya dice cuánto se amplió. */}
          <span className="min-w-12 text-center font-mono text-xs text-content-muted tabular-nums max-sm:hidden">
            {Math.round(zoom * 100)} %
          </span>
          <ZoomButton
            label="Ampliar"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex(zoomIndex + 1)}
          >
            <path d="M12 5v14M5 12h14" />
          </ZoomButton>
          {previewOf === null && (
            <a
              href={file.url}
              download={`${title}.pdf`}
              className={`${buttonClasses('primary')} ml-1 max-sm:size-11 max-sm:p-0`}
            >
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
              <span className="max-sm:sr-only">Descargar</span>
            </a>
          )}
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
        {previewOf !== null && pageNumbers.length > 0 && (
          <LockedPage
            width={pageWidth}
            height={Math.round(pageWidth * pageRatios.at(-1))}
            shown={pageRatios.length}
            total={previewOf}
          />
        )}
      </div>
    </section>
  )
}

// En la vista previa, el celular abrevia el contador: así la barra cabe en una
// fila junto a la etiqueta.
function PageCounter({ current, total, compact }) {
  if (!compact) return `Página ${current} de ${total}`
  return (
    <>
      <span className="max-sm:hidden">
        Página {current} de {total}
      </span>
      <span className="sm:hidden">
        {current} / {total}
      </span>
    </>
  )
}

const BLURRED_LINES = ['62%', '100%', '92%', '97%', '78%', '95%', '54%']

// Después de la última página de la vista previa, como en el prototipo: una
// página borrosa que se funde con el fondo y, sobre ella, la invitación. La
// invitación ocupa su sitio en vez de flotar encima: donde no cabe, como en el
// celular o en una página apaisada, la página crece en lugar de cortarla.
function LockedPage({ width, height, shown, total }) {
  return (
    <div
      className="relative mx-auto mt-3 flex flex-col items-center pb-6 sm:mt-5"
      style={{ width, minHeight: height, paddingTop: Math.round(height * 0.3) }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-white px-[14%] py-[9%] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)]">
        <div className="flex flex-col gap-4 opacity-45 blur-[6px]">
          {BLURRED_LINES.map((lineWidth) => (
            <span key={lineWidth} className="h-2.5 rounded-full bg-content-faint" style={{ width: lineWidth }} />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent to-surface to-58%" />
      <div className="relative flex w-[min(400px,calc(100%-32px))] flex-col items-center gap-3 rounded-2xl border border-border-strong bg-surface-raised px-6 py-6.5 text-center shadow-[0_24px_60px_-20px_rgb(0_0_0/0.85)]">
        <SignInInvitation title={`Estás viendo ${shown} de ${total} páginas`}>
          Inicia sesión para leer el apunte completo y descargarlo. Crear una cuenta es gratis.
        </SignInInvitation>
      </div>
    </div>
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
