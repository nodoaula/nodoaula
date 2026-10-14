import { useEffect, useId, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import CoursePicker from '../../components/ui/CoursePicker.jsx'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import TextInput from '../../components/ui/TextInput.jsx'
import TopicPicker from '../../components/ui/TopicPicker.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { getResource, listCoursesWithResources, listTopicsWithResources, updateResource } from './api.js'
import { formatDurationText, formatPublishedAt, formatResourceType } from './format.js'
import { validateCorrection } from './validation.js'

// Orden de los campos en la página, con el elemento que recibe el foco.
const FIELD_FOCUS = [
  ['title', 'titulo'],
  ['description', 'descripcion'],
  ['publishedAt', 'fecha'],
  ['durationSeconds', 'duracion'],
  ['channel', 'canal'],
  ['course', 'curso'],
  ['topics', 'temas'],
]

// Tras un intento fallido, el foco va al primer campo con error, como al
// subir un apunte.
function focusFirstInvalid(errors) {
  const first = FIELD_FOCUS.find(([field]) => errors[field])
  if (first) document.getElementById(first[1])?.focus()
}

// Lo que no es un campo del formulario se dice en un aviso general.
const FAILURE_MESSAGES = {
  RESOURCE_CHANGE_FORBIDDEN: 'Solo quien aportó este recurso o una cuenta del equipo puede corregirlo.',
  RESOURCE_NOT_FOUND: 'Este recurso ya no está en el catálogo.',
  [CSRF_ERROR_CODE]: 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.',
}

function describeFailure(error) {
  if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) {
      // "topics[0]" del backend se marca en el mismo campo que "topics" aquí.
      fieldErrors[field.startsWith('topics') ? 'topics' : field] ??= message
    }
    return { fieldErrors }
  }
  if (FAILURE_MESSAGES[error.code]) return { formError: FAILURE_MESSAGES[error.code] }
  if (error.status === 401) return { formError: 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.' }
  // Tras un tiempo agotado no se sabe si los cambios se guardaron: el
  // usuario decide, revisando primero la ficha.
  if (error.timedOut) {
    return { formError: 'El servidor tardó demasiado en responder y no sabemos si se guardaron los cambios. Revisa la ficha antes de volver a intentarlo.' }
  }
  if (error.status === null) return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  return { formError: 'No se pudieron guardar los cambios por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

// Los valores del formulario a partir de la ficha: lo que falta queda vacío.
function formFrom(resource) {
  return {
    title: resource.title,
    description: resource.description ?? '',
    publishedAt: resource.publishedAt ?? '',
    durationSeconds: resource.durationSeconds == null ? '' : String(resource.durationSeconds),
    channel: resource.channel ?? '',
  }
}

/**
 * Corregir los datos de un recurso (historia HU311). Solo para quien lo aportó
 * o una cuenta del equipo, que la ficha marca con `canEdit`; el backend aplica
 * la misma regla. El enlace de un video y el archivo y la fecha de un apunte
 * se muestran, pero no se corrigen. Al guardar vuelve a la ficha, que se
 * recarga con los datos nuevos.
 *
 * La key reinicia la carga cuando cambia el identificador de la dirección.
 */
export default function EditResourcePage() {
  const { resourceId } = useParams()
  return <EditResource key={resourceId} resourceId={resourceId} />
}


// Carga el recurso y los cursos, y decide qué se muestra: el formulario solo
// si quien tiene la sesión puede corregirlo.
function EditResource({ resourceId }) {
  const { status, account } = useSession()
  const [resource, setResource] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [courses, setCourses] = useState(null)
  const [coursesFailed, setCoursesFailed] = useState(false)

  // Se espera a saber quién tiene la sesión: la ficha dice si esa cuenta
  // puede corregir el recurso.
  const signedIn = account !== null
  useEffect(() => {
    if (!signedIn) return
    let active = true
    getResource(resourceId)
      .then((data) => {
        if (active) setResource(data)
      })
      .catch((error) => {
        if (!active) return
        if (error.status !== 404 && error.status !== 400) console.error('No se pudo cargar el recurso', error)
        setLoadError(error)
      })
    listCoursesWithResources()
      .then((list) => {
        if (active) setCourses(list)
      })
      .catch((error) => {
        console.error('No se pudo cargar la lista de cursos', error)
        if (active) setCoursesFailed(true)
      })
    return () => {
      active = false
    }
  }, [resourceId, signedIn])

  if (status === SESSION_STATUS.LOADING) return null
  if (!signedIn) return <Navigate to="/iniciar-sesion" replace />

  if (loadError) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
        <LoadError error={loadError} />
      </main>
    )
  }

  if (resource === null) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
        <output className="text-body text-content-muted">Cargando recurso…</output>
      </main>
    )
  }

  const detailPath = `/recursos/${resource.id}`

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <NodePath
        label="Ubicación"
        items={[
          { label: resource.course, to: `/catalogo/cursos/${resource.courseId}` },
          { label: formatResourceType(resource.resourceType), to: detailPath },
        ]}
        current="Corregir datos"
      />
      <h1 className="mt-5 text-[1.875rem] leading-[1.08] font-semibold tracking-tight sm:text-display">Corregir los datos</h1>
      <p className="mt-2.5 max-w-[60ch] text-lead wrap-break-word text-content">«{resource.title}»</p>
      <p className="mt-1.5 max-w-[60ch] text-body text-content-muted">
        Los cambios se ven en la ficha, el catálogo y la búsqueda en cuanto los guardes.
      </p>

      {resource.canEdit ? (
        <div className="mt-8">
          <CorrectionForm resource={resource} courses={courses} coursesFailed={coursesFailed} />
        </div>
      ) : (
        <div className="mt-8">
          <Notice
            title="No puedes corregir este recurso"
            action={<Link to={detailPath} className={buttonClasses('secondary')}>Volver a la ficha</Link>}
          >
            Solo quien lo aportó o una cuenta del equipo puede corregir sus datos.
          </Notice>
        </div>
      )}
    </main>
  )
}

// El formulario, que arranca con los datos actuales del recurso. Curso y
// temas usan los mismos selectores que el registro (HU308).
function CorrectionForm({ resource, courses, coursesFailed }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => formFrom(resource))
  const [course, setCourse] = useState({ id: resource.courseId, name: resource.course, isNew: false })
  const [topics, setTopics] = useState(resource.topics)
  const [loadedTopics, setLoadedTopics] = useState({ courseId: null, names: [] })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

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

  const detailPath = `/recursos/${resource.id}`
  const isDocument = resource.resourceType === 'DOCUMENT'
  const clearFieldError = (field) => setFieldErrors((errors) => ({ ...errors, [field]: undefined }))

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
  }

  // Cambiar de curso vacía los temas: son los de ese curso (HU308).
  const changeCourse = (value) => {
    setCourse(value)
    setTopics([])
    clearFieldError('course')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const data = {
      resourceType: resource.resourceType,
      title: form.title.trim(),
      description: form.description.trim(),
      publishedAt: form.publishedAt,
      durationSeconds: form.durationSeconds.trim(),
      channel: form.channel.trim(),
      course: course?.name ?? '',
      topics,
    }
    const errors = validateCorrection(data)
    if (course === null) errors.course = 'Elige un curso de la lista o crea uno nuevo.'
    if (topics.length === 0) errors.topics = 'Elige o escribe al menos un tema.'
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(errors)
      return
    }

    setSaving(true)
    try {
      await updateResource(resource.id, data)
      navigate(detailPath, { state: { resourceCorrected: true } })
    } catch (error) {
      console.error('No se pudieron guardar los cambios', error)
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setFormError(failure.formError ?? null)
      focusFirstInvalid(failure.fieldErrors ?? {})
      setSaving(false)
    }
  }

  const hasErrors = Object.values(fieldErrors).some(Boolean)

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-3xl min-w-0 flex-col gap-10">
      <FormSection title="Cómo se llama" intro="El título es lo primero que se lee en el catálogo.">
        <TextInput
          id="titulo"
          label="Título"
          value={form.title}
          maxLength={300}
          onChange={(value) => updateField('title', value)}
          error={fieldErrors.title}
        />
        <TextInput
          id="descripcion"
          label="Descripción"
          optional
          multiline
          value={form.description}
          maxLength={2000}
          onChange={(value) => updateField('description', value)}
          error={fieldErrors.description}
        />
      </FormSection>

      {!isDocument && <VideoFields form={form} errors={fieldErrors} onChange={updateField} />}

      <FormSection title="Dónde está" intro="El curso y los temas por los que se encuentra en el catálogo.">
        {courses === null && !coursesFailed && <p className="text-label text-content-muted">Cargando los cursos…</p>}
        {coursesFailed && <p className="text-label text-red-400">No se pudieron cargar los cursos. Recarga la página.</p>}
        {courses !== null && (
          <CoursePicker id="curso" label="Curso" courses={courses} value={course} onChange={changeCourse} error={fieldErrors.course} />
        )}
        {course === null ? (
          <p className="text-label text-content-muted">Elige el curso y aquí aparecen sus temas.</p>
        ) : (
          <TopicPicker
            id="temas"
            label="Temas"
            suggestions={suggestedTopics}
            value={topics}
            onChange={(value) => {
              setTopics(value)
              clearFieldError('topics')
            }}
            error={fieldErrors.topics}
          />
        )}
      </FormSection>

      <FixedData resource={resource} />

      <div className="flex flex-col gap-4">
        {formError && <Notice role="alert" title="No se guardaron los cambios">{formError}</Notice>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={saving} className={buttonClasses('primary', 'lg')}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link to={detailPath} className={buttonClasses('secondary', 'lg')}>
            Cancelar
          </Link>
          {hasErrors && !saving && <p role="alert" className="text-label text-red-400">Revisa los campos marcados.</p>}
        </div>
      </div>
    </form>
  )
}

// Los datos que solo tiene un video: un apunte no tiene fecha que corregir,
// porque es la de su subida, ni duración ni canal.
function VideoFields({ form, errors, onChange }) {
  const duration = Number(form.durationSeconds)
  const durationHint = Number.isInteger(duration) && duration > 0
    ? `En segundos: ${formatDurationText(duration)}. Déjalo en blanco si no la sabes.`
    : 'En segundos. Déjalo en blanco si no la sabes.'

  return (
    <FormSection title="Datos del video" intro="Corrígelos si YouTube los trajo mal o si los escribiste con un error.">
      <TextInput
        id="fecha"
        label="Fecha de publicación"
        type="date"
        className="scheme-dark"
        value={form.publishedAt}
        onChange={(value) => onChange('publishedAt', value)}
        error={errors.publishedAt}
      />
      <TextInput
        id="duracion"
        label="Duración"
        optional
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        className="scheme-dark"
        value={form.durationSeconds}
        hint={durationHint}
        onChange={(value) => onChange('durationSeconds', value)}
        error={errors.durationSeconds}
      />
      <TextInput
        id="canal"
        label="Canal"
        optional
        value={form.channel}
        maxLength={200}
        hint="Quién publicó el video."
        onChange={(value) => onChange('channel', value)}
        error={errors.channel}
      />
    </FormSection>
  )
}

function LoadError({ error }) {
  if (error.status === 404 || error.status === 400) {
    return (
      <Notice
        title="Recurso no encontrado"
        action={<Link to="/catalogo" className={buttonClasses('secondary')}>Volver al catálogo</Link>}
      >
        Este recurso no existe o ya no está en el catálogo.
      </Notice>
    )
  }
  return (
    <Notice title="No se pudo cargar el recurso" role="alert">
      Recarga la página para reintentar.
    </Notice>
  )
}

// Lo que no se corrige, a la vista y con lo que hay que hacer en su lugar.
function FixedData({ resource }) {
  const isDocument = resource.resourceType === 'DOCUMENT'
  return (
    <FormSection title="Datos fijos" intro="Se muestran, pero no se corrigen.">
      {isDocument ? (
        <dl className="flex flex-col gap-3 text-sm">
          <FixedField label="Archivo">PDF del apunte</FixedField>
          {resource.publishedAt && <FixedField label="Subido">{formatPublishedAt(resource.publishedAt)}</FixedField>}
        </dl>
      ) : (
        <dl className="flex flex-col gap-3 text-sm">
          <FixedField label="Enlace">
            <span className="break-all">{resource.url}</span>
          </FixedField>
        </dl>
      )}
      <p className="text-label text-content-muted">
        {isDocument ? 'Para otro archivo, ' : 'Para otro video, '}
        <Link
          to={isDocument ? `/subir-apunte?courseId=${resource.courseId}` : '/registrar-recurso'}
          className="font-medium text-accent underline underline-offset-4"
        >
          {isDocument ? 'sube un apunte nuevo' : 'registra un recurso nuevo'}
        </Link>
        .
      </p>
    </FormSection>
  )
}

function FixedField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-xs tracking-wider text-content-muted uppercase">{label}</dt>
      <dd className="text-content">{children}</dd>
    </div>
  )
}

function FormSection({ title, intro, children }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 id={headingId} className="text-lead font-semibold tracking-tight">{title}</h2>
        {intro && <p className="mt-1 text-sm text-content-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}
