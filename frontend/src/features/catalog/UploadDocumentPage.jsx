import { useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import CoursePicker from '../../components/ui/CoursePicker.jsx'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import TopicPicker from '../../components/ui/TopicPicker.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { createDocument, listCoursesWithResources, listTopicsWithResources } from './api.js'
import { isPdf, MAX_DOCUMENT_BYTES, titleFromFileName } from './documentFile.js'
import { formatFileSize } from './format.js'
import { validateDescription, validateTitle } from './validation.js'

const RIGHTS_MESSAGE = 'Declara que el apunte es de tu autoría o que tienes permiso para compartirlo.'

// Traduce el error de la API al mensaje de la página. Lo que se refiere a un
// campo va junto al campo; el resto, en un aviso general.
function describeFailure(error) {
  if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) {
      // "topics[0]" del backend se marca en el mismo campo que "topics" aquí.
      fieldErrors[field.startsWith('topics') ? 'topics' : field] ??= message
    }
    return { fieldErrors }
  }
  if (error.code === 'PAYLOAD_TOO_LARGE') return { fieldErrors: { file: 'El archivo pasa de 20 MB.' } }
  if (error.status === 503) {
    return { formError: error.body?.detail ?? 'No fue posible guardar el apunte en este momento. Inténtalo de nuevo más tarde.' }
  }
  if (error.code === CSRF_ERROR_CODE) {
    return { formError: 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.' }
  }
  if (error.status === 401) {
    return { formError: 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.' }
  }
  // Tras un tiempo agotado no se sabe si el apunte llegó a publicarse: el
  // usuario decide, revisando primero el curso.
  if (error.timedOut) {
    return {
      formError: 'El servidor tardó demasiado en responder y no sabemos si el apunte se publicó. Revisa el curso antes de volver a intentarlo.',
    }
  }
  if (error.status === null) {
    return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  }
  return { formError: 'No se pudo publicar el apunte por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

/**
 * Subir un apunte (historia HU302): primero el PDF y después, por pasos,
 * dónde va y cómo se llama. Con `?courseId=` llega con el curso puesto, desde
 * la página de ese curso. Al publicar se queda en la página.
 */
export default function UploadDocumentPage() {
  const { status, account } = useSession()
  const [searchParams] = useSearchParams()
  const entryCourseId = Number(searchParams.get('courseId'))

  const [courses, setCourses] = useState(null)
  const [coursesFailed, setCoursesFailed] = useState(false)
  const [entryCourse, setEntryCourse] = useState(null)
  const [file, setFile] = useState(null)
  const [course, setCourse] = useState(null)
  const [loadedTopics, setLoadedTopics] = useState({ courseId: null, names: [] })
  const [topics, setTopics] = useState([])
  const [title, setTitle] = useState('')
  const [titleFromFile, setTitleFromFile] = useState(false)
  const [description, setDescription] = useState('')
  const [rightsDeclared, setRightsDeclared] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [sending, setSending] = useState(false)
  const [published, setPublished] = useState(null)

  useEffect(() => {
    let active = true
    listCoursesWithResources()
      .then((list) => {
        if (!active) return
        setCourses(list)
        const match = list.find((item) => item.id === entryCourseId)
        if (match) {
          setEntryCourse(match)
          setCourse({ id: match.id, name: match.name, isNew: false })
        }
      })
      .catch((error) => {
        console.error('No se pudo cargar la lista de cursos', error)
        if (active) setCoursesFailed(true)
      })
    return () => {
      active = false
    }
  }, [entryCourseId])

  // Un curso nuevo aún no tiene temas que sugerir.
  const courseId = course?.id ?? null
  useEffect(() => {
    if (courseId === null) return
    let active = true
    listTopicsWithResources(courseId)
      .then((items) => {
        if (active) setLoadedTopics({ courseId, names: items.map((topic) => topic.name) })
      })
      .catch((error) => console.error('No se pudo cargar la lista de temas', error))
    return () => {
      active = false
    }
  }, [courseId])
  // Sin esta comprobación, al cambiar de curso seguirían viéndose los temas del anterior.
  const suggestedTopics = courseId !== null && loadedTopics.courseId === courseId ? loadedTopics.names : []

  if (status === SESSION_STATUS.LOADING) return null
  if (account === null) return <Navigate to="/iniciar-sesion" replace />

  const clearFieldError = (field) => setFieldErrors((errors) => ({ ...errors, [field]: undefined }))

  const pickFile = (picked) => {
    if (!picked) return
    if (!isPdf(picked)) {
      setFieldErrors({ file: `«${picked.name}» no es un PDF. Expórtalo a PDF y vuelve a elegirlo.` })
      return
    }
    if (picked.size > MAX_DOCUMENT_BYTES) {
      setFieldErrors({ file: `«${picked.name}» pesa ${formatFileSize(picked.size)} y el límite es 20 MB. Comprímelo o divídelo en partes.` })
      return
    }
    setFile(picked)
    clearFieldError('file')
    // El título propuesto sigue al archivo hasta que el usuario lo escriba él.
    if (title === '' || titleFromFile) {
      setTitle(titleFromFileName(picked.name))
      setTitleFromFile(true)
    }
  }

  const removeFile = () => {
    setFile(null)
    if (titleFromFile) {
      setTitle('')
      setTitleFromFile(false)
    }
  }

  const changeCourse = (value) => {
    setCourse(value)
    setTopics([])
    clearFieldError('course')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (sending) return

    const errors = {}
    if (course === null) errors.course = 'Elige un curso de la lista o crea uno nuevo.'
    if (topics.length === 0) errors.topics = 'Elige o escribe al menos un tema.'
    const titleError = validateTitle(title.trim())
    if (titleError) errors.title = titleError
    const descriptionError = validateDescription(description.trim())
    if (descriptionError) errors.description = descriptionError
    if (!rightsDeclared) errors.rightsDeclared = RIGHTS_MESSAGE
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSending(true)
    try {
      const resource = await createDocument({
        file,
        title: title.trim(),
        description: description.trim(),
        course: course.name,
        topics,
        rightsDeclared,
      })
      setPublished({ resource, courseName: course.name, topics })
    } catch (error) {
      console.error('No se pudo publicar el apunte', error)
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setFormError(failure.formError ?? null)
    } finally {
      setSending(false)
    }
  }

  // Otro apunte, casi siempre del mismo curso: el curso se conserva.
  const startAnother = () => {
    setPublished(null)
    setFile(null)
    setTopics([])
    setTitle('')
    setTitleFromFile(false)
    setDescription('')
    setRightsDeclared(false)
    setFieldErrors({})
  }

  const pathItems = [{ label: 'Catálogo', to: '/catalogo' }]
  if (entryCourse) pathItems.push({ label: entryCourse.name, to: `/catalogo/cursos/${entryCourse.id}` })
  const hasErrors = Object.values(fieldErrors).some(Boolean)

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <NodePath label="Ubicación" items={pathItems} current="Subir un apunte" />
      <h1 className="mt-5 text-[1.875rem] leading-[1.08] font-semibold tracking-tight sm:text-display">Subir un apunte</h1>
      <p className="mt-2.5 max-w-[60ch] text-body text-content-muted">
        Compártelo con quienes estudian el mismo curso.
      </p>

      {published && <Published published={published} onAnother={startAnother} />}

      {!published && file === null && <DropZone onFile={pickFile} error={fieldErrors.file} />}

      {!published && file !== null && (
        <>
          <WherePath course={course} topics={topics} title={title.trim()} />
          <div className="mt-7 grid items-start gap-7 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-14">
            <FileSheet file={file} onFile={pickFile} onRemove={removeFile} error={fieldErrors.file} />

            <form onSubmit={handleSubmit} noValidate className="flex max-w-3xl flex-col">
              <Step done={course !== null} title="¿De qué curso es?" intro="Elígelo para que tu apunte aparezca junto a sus videos.">
                {courses === null && !coursesFailed && <p className="text-label text-content-muted">Cargando los cursos…</p>}
                {coursesFailed && (
                  <p className="text-label text-red-400">No se pudieron cargar los cursos. Recarga la página.</p>
                )}
                {courses !== null && (
                  <CoursePicker
                    id="curso"
                    label="Curso"
                    courses={courses}
                    value={course}
                    onChange={changeCourse}
                    error={fieldErrors.course}
                  />
                )}
              </Step>

              <Step done={topics.length > 0} title="¿Qué temas trata?" intro="Por estos temas lo encuentran dentro del curso.">
                {course === null ? (
                  <p className="text-label text-content-muted">Elige el curso y aquí aparecen sus temas.</p>
                ) : (
                  <TopicPicker
                    id="temas"
                    label="Temas"
                    courseName={course.name}
                    suggestions={suggestedTopics}
                    value={topics}
                    onChange={(value) => {
                      setTopics(value)
                      clearFieldError('topics')
                    }}
                    error={fieldErrors.topics}
                  />
                )}
              </Step>

              <Step done={title.trim() !== ''} title="Cómo se llama" intro="El título es lo primero que se lee en el catálogo.">
                <TextInput
                  id="titulo"
                  label="Título"
                  value={title}
                  maxLength={300}
                  onChange={(value) => {
                    setTitle(value)
                    setTitleFromFile(false)
                    clearFieldError('title')
                  }}
                  hint={titleFromFile ? 'Lo tomamos del nombre del archivo. Corrígelo si hace falta.' : null}
                  error={fieldErrors.title}
                />
                <TextInput
                  id="descripcion"
                  label="Descripción"
                  optional
                  multiline
                  value={description}
                  maxLength={2000}
                  placeholder="Qué cubre, de qué clase o parcial es, si tiene ejercicios resueltos…"
                  onChange={(value) => {
                    setDescription(value)
                    clearFieldError('description')
                  }}
                  error={fieldErrors.description}
                />
              </Step>

              <Step done={rightsDeclared} title="Publicar" last>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-start gap-3 text-body text-content">
                    <input
                      type="checkbox"
                      checked={rightsDeclared}
                      onChange={(event) => {
                        setRightsDeclared(event.target.checked)
                        clearFieldError('rightsDeclared')
                      }}
                      aria-invalid={fieldErrors.rightsDeclared ? true : undefined}
                      aria-describedby={fieldErrors.rightsDeclared ? 'derechos-error' : undefined}
                      className="mt-0.5 size-5 shrink-0 accent-accent"
                    />
                    Declaro que este apunte es de mi autoría o que tengo permiso para compartirlo.
                  </label>
                  {fieldErrors.rightsDeclared && (
                    <p id="derechos-error" className="text-label text-red-400">{fieldErrors.rightsDeclared}</p>
                  )}
                </div>

                {formError && <Notice role="alert" title="No se publicó el apunte">{formError}</Notice>}

                <div className="flex flex-wrap items-center gap-4">
                  <button type="submit" disabled={sending} className={buttonClasses('primary', 'lg')}>
                    {sending ? 'Publicando…' : 'Publicar apunte'}
                  </button>
                  {sending && (
                    <output className="text-label text-content-muted">
                      Subiendo {formatFileSize(file.size)}. No cierres esta pestaña.
                    </output>
                  )}
                  {hasErrors && !sending && (
                    <p role="alert" className="text-label text-red-400">Revisa los campos marcados.</p>
                  )}
                </div>
              </Step>
            </form>
          </div>
        </>
      )}
    </main>
  )
}

// El input queda oculto a la vista pero no al teclado: el foco llega a él con
// Tab y el anillo se dibuja en la etiqueta, que es lo que se ve como botón.
function FilePicker({ id, className, onFile, children }) {
  return (
    <>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="peer sr-only"
        onChange={(event) => {
          onFile(event.target.files[0])
          // Permite volver a elegir el mismo archivo después de quitarlo.
          event.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        className={`${className} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent`}
      >
        {children}
      </label>
    </>
  )
}

function DropZone({ onFile, error }) {
  const [dragging, setDragging] = useState(false)

  return (
    <div className="mt-8">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          onFile(event.dataTransfer.files[0])
        }}
        className={`flex min-h-[26rem] flex-col items-center justify-center gap-3.5 rounded-3xl border-[1.5px] border-dashed px-6 py-12 text-center transition-colors max-sm:min-h-[19rem] ${dragging ? 'border-accent bg-accent/5' : 'border-border-strong'}`}
      >
        <svg viewBox="0 0 96 72" fill="none" aria-hidden="true" className="h-[4.5rem] w-24">
          <path d="M14 14 82 36 14 58M14 14v44" className="stroke-border-strong" strokeWidth="2" />
          <circle cx="14" cy="14" r="8" className="fill-content" />
          <circle cx="14" cy="58" r="8" className="fill-content" />
          <circle cx="82" cy="36" r="12" className="fill-accent" />
        </svg>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight max-sm:text-xl">Suelta aquí tu PDF</p>
        <p className="text-body text-content-muted">o</p>
        <FilePicker id="pdf" className={buttonClasses('primary', 'lg')} onFile={onFile}>
          Elegir archivo
        </FilePicker>
        <p className="mt-1.5 font-mono text-label text-content-muted">Solo PDF · hasta 20 MB</p>
      </div>
      {error && (
        <p role="alert" className="mt-4 max-w-2xl rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-body text-red-200">
          {error}
        </p>
      )}
    </div>
  )
}

function FileSheet({ file, onFile, onRemove, error }) {
  return (
    <aside aria-label="Archivo elegido" className="flex items-center gap-4 md:flex-col md:items-stretch">
      <div
        aria-hidden="true"
        className="relative flex aspect-[210/297] w-24 shrink-0 flex-col justify-between overflow-hidden rounded-[6px_22px_6px_6px] border border-border-strong bg-surface-raised p-3 md:w-full md:p-6"
      >
        <div className="flex flex-col gap-1.5 md:gap-2.5">
          {['w-3/4', 'w-full', 'w-full', 'w-5/6', 'w-full', 'w-3/5'].map((width, index) => (
            <span key={index} className={`h-1 rounded-full bg-border md:h-1.5 ${width}`} />
          ))}
        </div>
        <span className="self-start rounded-full border border-accent/40 px-1.5 font-mono text-caption text-accent md:px-2.5 md:text-label">
          PDF
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-body font-medium break-words text-content">{file.name}</p>
        <p className="font-mono text-label text-content-muted">PDF · {formatFileSize(file.size)}</p>
        <div className="mt-1 flex gap-4 text-label font-medium">
          <FilePicker id="pdf-cambiar" className="text-accent underline underline-offset-4" onFile={onFile}>
            Cambiar archivo
          </FilePicker>
          <button type="button" onClick={onRemove} className="text-accent underline underline-offset-4">
            Quitar
          </button>
        </div>
        {error && <p role="alert" className="text-label text-red-400">{error}</p>}
      </div>
    </aside>
  )
}

// Dónde quedará el apunte, como la ruta de nodos de la ficha: se va armando
// mientras se llena el formulario.
function WherePath({ course, topics, title }) {
  const steps = [
    { key: 'catalogo', label: 'Catálogo', on: true },
    { key: 'curso', label: course?.name ?? 'Curso', on: course !== null },
    { key: 'tema', label: topics[0] ?? 'Tema', on: topics.length > 0 },
    { key: 'apunte', label: title || 'Tu apunte', on: title !== '' },
  ]
  return (
    <div className="mt-7">
      <p className="mb-2.5 font-mono text-label text-content-muted">Dónde quedará</p>
      <ol className="flex w-fit max-w-full flex-wrap items-center gap-y-2.5 rounded-2xl border border-border bg-surface-raised px-5 py-3.5 text-sm sm:rounded-full">
        {steps.map((step, index) => {
          // El nodo del apunte se enciende en turquesa, como el actual en la ficha.
          const filledDot = index === steps.length - 1 ? 'bg-accent' : 'bg-content'
          const dot = step.on ? filledDot : 'border-[1.5px] border-dashed border-content-faint'
          return (
            <li key={step.key} className={`flex items-center ${step.on ? 'text-content' : 'text-content-faint'}`}>
              {index > 0 && <span aria-hidden="true" className="mx-2.5 h-px w-4 bg-border-strong sm:w-8" />}
              <span aria-hidden="true" className={`mr-2 size-2.5 shrink-0 rounded-full ${dot}`} />
              <span className="break-words">{step.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Un paso del formulario: su nodo se enciende cuando el paso está completo, y
// una línea lo une con el siguiente.
function Step({ done, title, intro, last = false, children }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-5 sm:gap-x-6 ${last ? '' : 'pb-10'}`}>
      {!last && <span aria-hidden="true" className="absolute top-7 bottom-0.5 left-[0.84rem] w-px bg-border" />}
      <span
        aria-hidden="true"
        className={`mt-1.5 ml-2 size-3 rounded-full transition-colors ${done ? 'bg-accent shadow-[0_0_0_5px_rgb(79_209_197/0.14)]' : 'border-[1.5px] border-content-faint bg-surface'}`}
      />
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 id={headingId} className="text-lead font-semibold tracking-tight">{title}</h2>
          {intro && <p className="mt-1 text-sm text-content-muted">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}

function TextInput({ id, label, optional = false, multiline = false, hint, error, onChange, ...props }) {
  const Control = multiline ? 'textarea' : 'input'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label} {optional && <span className="font-normal text-content-muted">opcional</span>}
      </label>
      <Control
        id={id}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`w-full rounded-xl border bg-surface-raised px-3.5 py-3 text-body text-content placeholder:text-content-faint focus:border-accent focus:outline-none ${multiline ? 'min-h-24 resize-y leading-normal' : ''} ${error ? 'border-red-400' : 'border-border-strong hover:border-content-faint'}`}
        {...props}
      />
      {hint && <p id={`${id}-hint`} className="text-label text-content-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-label text-red-400">{error}</p>}
    </div>
  )
}

function Published({ published, onAnother }) {
  const { resource, courseName, topics } = published
  // El foco va al mensaje: quien usa teclado o lector de pantalla sabe al
  // momento que el apunte se publicó y dónde está.
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus(), [])
  return (
    <div className="mt-8 flex max-w-3xl flex-col items-start gap-3.5 rounded-3xl border border-border bg-surface-raised p-10 max-sm:p-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl leading-tight font-semibold tracking-tight focus:outline-none">
        Publicaste «{resource.title}»
      </h2>
      <p className="text-body text-content-muted">
        Ya aparece en {courseName}, en {topics.join(' · ')}.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link to={`/recursos/${resource.id}`} className={buttonClasses('primary')}>
          Ver el apunte
        </Link>
        <button type="button" onClick={onAnother} className={buttonClasses('secondary')}>
          Subir otro apunte
        </button>
      </div>
    </div>
  )
}
