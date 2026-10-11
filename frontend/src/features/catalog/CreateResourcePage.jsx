import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import Modal from '../../components/ui/Modal.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { createResource, getYouTubeMetadata, listCoursesWithResources, listTopicsWithResources } from './api.js'
import { AUTOFILLABLE_FIELDS, resolveEntryMethod } from './entryMethod.js'
import { formatDuration, formatPublishedAt } from './format.js'
import { isYouTubeLink, parseYouTubeInput } from './sourcePlatform.js'
import { parseTopics, validateCreateResource, validateDescription } from './validation.js'

const VALIDATION_FAILED = 'VALIDATION_FAILED'

// Códigos con que el backend rechaza un enlace de YouTube (historia HU202).
const INVALID_VIDEO_LINK = 'INVALID_VIDEO_LINK'
const VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND'
const VIDEO_METADATA_UNAVAILABLE = 'VIDEO_METADATA_UNAVAILABLE'

// El mismo retraso que la búsqueda del catálogo (HU207): consulta al dejar
// de teclear, no con cada tecla.
const LOOKUP_DEBOUNCE_MS = 400

const MISSING_FIELD_NOTICE = 'No fue posible obtener este dato de YouTube; complétalo.'

const INVALID_YOUTUBE_LINK_MESSAGE =
  'El enlace de YouTube no corresponde a un video. Revisa que esté completo, como https://www.youtube.com/watch?v=… o https://youtu.be/….'

const EMPTY_FORM = {
  title: '',
  description: '',
  publishedAt: '',
  durationSeconds: '',
  channel: '',
  url: '',
  course: '',
  topicsText: '',
}

// Traduce el error de la API al mensaje del formulario. Lo que se refiere a un
// campo va junto al campo; el resto, en un aviso general.
function describeFailure(error) {
  if (error.code === VALIDATION_FAILED && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) {
      // "topics[0]" del backend se marca en el mismo campo que "topics" aquí.
      // La vía de ingreso no es un campo del formulario: se rechaza por el
      // enlace, así que se señala en «Enlace».
      let formField = field
      if (field.startsWith('topics')) formField = 'topics'
      else if (field === 'entryMethod') formField = 'url'
      fieldErrors[formField] ??= message
    }
    return { fieldErrors }
  }

  if (error.code === CSRF_ERROR_CODE) {
    return {
      formError: 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.',
    }
  }

  if (error.status === 401) {
    return { formError: 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.' }
  }

  // Tras un tiempo agotado no se sabe si el recurso llegó a crearse. No se
  // reintenta solo: el usuario decide, revisando primero el catálogo.
  if (error.timedOut) {
    return {
      formError:
        'El servidor tardó demasiado en responder y no sabemos si el recurso se registró. Revisa el catálogo antes de volver a intentarlo.',
    }
  }

  if (error.status === null) {
    return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  }

  return { formError: 'No se pudo registrar el recurso por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

/**
 * Traduce el fallo de la consulta a YouTube al error del campo «Enlace».
 * `rejected` marca los enlaces que YouTube rechaza (inválido o video no
 * disponible): con ellos no se publica. Los demás son transitorios y se puede
 * volver a consultar el mismo video.
 */
function describeLookupFailure(error) {
  if (error.code === INVALID_VIDEO_LINK || error.code === VIDEO_NOT_FOUND) {
    return { message: error.body?.detail ?? INVALID_YOUTUBE_LINK_MESSAGE, rejected: true }
  }
  if (error.code === VIDEO_METADATA_UNAVAILABLE) {
    return {
      message: error.body?.detail ?? 'No fue posible consultar YouTube en este momento. Completa los campos a mano.',
      rejected: false,
    }
  }
  if (error.status === 401) {
    return { message: 'Tu sesión ya no está activa. Vuelve a iniciar sesión para consultar YouTube.', rejected: false }
  }
  return {
    message: 'No fue posible consultar YouTube en este momento. Completa los campos a mano o inténtalo de nuevo.',
    rejected: false,
  }
}

// Lo que el modal muestra de un video: solo los campos que YouTube devolvió.
function describeMetadata(metadata) {
  const missing = new Set(metadata.missingFields)
  const rows = [
    { field: 'title', label: 'Título', value: metadata.title },
    { field: 'description', label: 'Descripción', value: metadata.description },
    {
      field: 'publishedAt',
      label: 'Fecha de publicación',
      value: metadata.publishedAt && formatPublishedAt(metadata.publishedAt),
    },
    { field: 'durationSeconds', label: 'Duración', value: formatDuration(metadata.durationSeconds) },
    { field: 'channel', label: 'Canal', value: metadata.channel },
  ]
  return rows.filter((row) => !missing.has(row.field))
}

// Los valores que la indexación escribe en el formulario. Los ausentes quedan vacíos.
function autofilledValues(metadata) {
  return {
    title: metadata.title ?? '',
    description: metadata.description ?? '',
    publishedAt: metadata.publishedAt ?? '',
    durationSeconds: metadata.durationSeconds == null ? '' : String(metadata.durationSeconds),
    channel: metadata.channel ?? '',
  }
}

function withoutKeys(object, keys) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))
}

/**
 * Formulario de registro de un recurso (historias HU105 y HU202). Solo
 * accesible con sesión iniciada: el catálogo se consulta sin cuenta, pero
 * aportar la exige (ADR-007).
 *
 * Un enlace de YouTube en «Enlace» consulta el video y ofrece, en un modal,
 * insertar sus datos en el formulario. Un enlace de otra plataforma deja el
 * formulario manual de siempre.
 */
export default function CreateResourcePage() {
  const navigate = useNavigate()
  const { status, account } = useSession()
  const [courses, setCourses] = useState([])
  const [loadedTopics, setLoadedTopics] = useState({ courseId: null, items: [] })
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Indexación (historia HU202).
  const [lookingUp, setLookingUp] = useState(false)
  // Datos del video que esperan la decisión del modal; null con el modal cerrado.
  const [pendingMetadata, setPendingMetadata] = useState(null)
  // La indexación vigente: la URL insertada y la instantánea de los campos
  // que llenó con valor, para decidir la vía de ingreso al publicar. Cancelar
  // un modal no la cambia.
  const [appliedIndexing, setAppliedIndexing] = useState(null)
  // Campos que YouTube no trajo en la última inserción; se desmarcan al escribir en ellos.
  const [missingFields, setMissingFields] = useState([])
  // Un enlace que YouTube rechazó: no se publica con él.
  const [rejectedLink, setRejectedLink] = useState(null)

  const debounceTimerRef = useRef(null)
  const pastedRef = useRef(false)
  // Identificador de la última consulta, para no gastar cuota repitiéndola
  // mientras el campo siga teniendo el mismo video.
  const lastQueriedIdRef = useRef(null)
  // Solo cuenta la respuesta de la consulta más reciente.
  const lookupSequenceRef = useRef(0)

  useEffect(() => {
    let active = true

    // Solo para sugerir cursos ya usados en el campo; no es la lista completa
    // del vocabulario controlado, y el campo sigue aceptando uno nuevo.
    listCoursesWithResources()
      .then((data) => {
        if (active) setCourses(data)
      })
      .catch((error) => console.error('No se pudo cargar la lista de cursos', error))

    return () => {
      active = false
    }
  }, [])

  useEffect(() => () => clearTimeout(debounceTimerRef.current), [])

  // El formulario guarda el nombre del curso, pero los temas se piden por su
  // identificador, así que hay que buscarlo en la lista ya cargada. Un curso
  // que todavía no existe no tiene identificador ni temas que sugerir.
  const selectedCourseId = courses.find((course) => course.name === form.course.trim())?.id ?? null

  useEffect(() => {
    if (selectedCourseId === null) return

    let active = true

    listTopicsWithResources(selectedCourseId)
      .then((data) => {
        if (active) setLoadedTopics({ courseId: selectedCourseId, items: data })
      })
      .catch((error) => console.error('No se pudo cargar la lista de temas', error))

    return () => {
      active = false
    }
  }, [selectedCourseId])

  // Solo se sugieren si la lista cargada es la del curso elegido ahora mismo.
  // Sin esta comprobación, al cambiar de curso seguirían viéndose los temas del
  // anterior hasta que llegara la respuesta del nuevo.
  const suggestedTopics = loadedTopics.courseId === selectedCourseId ? loadedTopics.items : []

  // Mientras no se sabe si hay sesión no se decide nada; sin ella, no hay
  // nada que hacer aquí.
  if (status === SESSION_STATUS.LOADING) return null
  if (account === null) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
    setMissingFields((fields) => fields.filter((missing) => missing !== field))
  }

  // Añade el tema al campo si no está ya, respetando lo que el usuario lleve escrito.
  function addTopic(name) {
    const current = parseTopics(form.topicsText)
    if (current.includes(name)) return
    updateField('topicsText', [...current, name].join(', '))
  }

  function handleUrlChange(event) {
    const { value } = event.target
    updateField('url', value)

    // Al pegar se consulta de inmediato; al escribir, tras una pausa.
    // lookUpVideo trata sus propios errores, así que su promesa se descarta.
    const pasted = pastedRef.current
    pastedRef.current = false
    clearTimeout(debounceTimerRef.current)
    if (pasted) {
      void lookUpVideo(value)
    } else {
      debounceTimerRef.current = setTimeout(() => void lookUpVideo(value), LOOKUP_DEBOUNCE_MS)
    }
  }

  async function lookUpVideo(value) {
    const videoId = parseYouTubeInput(value)

    if (videoId === null) {
      // Sin video en el campo: cualquier consulta en curso deja de importar,
      // y el mismo video podrá consultarse de nuevo si se vuelve a pegar.
      lastQueriedIdRef.current = null
      lookupSequenceRef.current += 1
      setLookingUp(false)

      // Un enlace de YouTube sin video se rechaza; uno de otra plataforma no.
      if (isYouTubeLink(value)) {
        setFieldErrors((errors) => ({ ...errors, url: INVALID_YOUTUBE_LINK_MESSAGE }))
        setRejectedLink({ url: value, message: INVALID_YOUTUBE_LINK_MESSAGE })
      }
      return
    }

    if (videoId === lastQueriedIdRef.current) return
    lastQueriedIdRef.current = videoId

    lookupSequenceRef.current += 1
    const sequence = lookupSequenceRef.current
    setLookingUp(true)

    try {
      const metadata = await getYouTubeMetadata(value.trim())
      if (sequence === lookupSequenceRef.current) setPendingMetadata(metadata)
    } catch (error) {
      if (sequence !== lookupSequenceRef.current) return
      console.error('No se pudo consultar el video en YouTube', error)

      // No se abre el modal ni se toca ningún otro campo: lo ya insertado se conserva.
      const failure = describeLookupFailure(error)
      setFieldErrors((errors) => ({ ...errors, url: failure.message }))
      if (failure.rejected) {
        setRejectedLink({ url: value, message: failure.message })
      } else {
        lastQueriedIdRef.current = null
      }
    } finally {
      if (sequence === lookupSequenceRef.current) setLookingUp(false)
    }
  }

  function insertMetadata() {
    const metadata = pendingMetadata
    const values = autofilledValues(metadata)
    const missing = AUTOFILLABLE_FIELDS.filter((field) => metadata.missingFields.includes(field))
    const isReplacement = appliedIndexing !== null

    // La primera inserción respeta curso y temas; una que reemplaza a
    // otra vacía todo el formulario antes de llenar lo obtenido.
    setForm((current) => ({ ...(isReplacement ? EMPTY_FORM : current), ...values, url: metadata.url }))

    // La instantánea solo guarda los campos que la indexación llenó con valor.
    const snapshot = Object.fromEntries(
      AUTOFILLABLE_FIELDS.filter((field) => !missing.includes(field)).map((field) => [field, values[field]]),
    )
    setAppliedIndexing({ url: metadata.url, snapshot })
    setMissingFields(missing)
    lastQueriedIdRef.current = metadata.videoId

    // YouTube no limita la descripción como el formulario: si se pasa, se
    // señala con el error de siempre para que el usuario la acorte.
    const descriptionError = validateDescription(values.description)
    setFieldErrors((errors) => {
      const kept = isReplacement ? {} : withoutKeys(errors, [...AUTOFILLABLE_FIELDS, 'url'])
      return descriptionError ? { ...kept, description: descriptionError } : kept
    })
    setFormError(null)
    setRejectedLink(null)
    setPendingMetadata(null)
  }

  // No guarda ningún cambio: con una indexación vigente, ni siquiera el enlace.
  function cancelMetadata() {
    if (appliedIndexing !== null) {
      setForm((current) => ({ ...current, url: appliedIndexing.url }))
      setFieldErrors((errors) => ({ ...errors, url: undefined }))
      lastQueriedIdRef.current = parseYouTubeInput(appliedIndexing.url)
    }
    setPendingMetadata(null)
  }

  function noticeFor(field) {
    return missingFields.includes(field) ? MISSING_FIELD_NOTICE : undefined
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || lookingUp) return

    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      publishedAt: form.publishedAt,
      durationSeconds: form.durationSeconds.trim(),
      channel: form.channel.trim(),
      url: form.url.trim(),
      course: form.course.trim(),
      topics: parseTopics(form.topicsText),
    }

    const errors = validateCreateResource(data)
    // Un enlace de YouTube inválido o de un video no disponible no crea un recurso.
    if (!errors.url && rejectedLink?.url === form.url) {
      errors.url = rejectedLink.message
    }
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await createResource({
        title: data.title,
        description: data.description === '' ? null : data.description,
        publishedAt: data.publishedAt,
        durationSeconds: data.durationSeconds === '' ? null : Number(data.durationSeconds),
        channel: data.channel === '' ? null : data.channel,
        url: data.url,
        // El registro por enlace es solo de videos: un apunte entra subiendo su archivo.
        resourceType: 'VIDEO',
        course: data.course,
        topics: data.topics,
        entryMethod: resolveEntryMethod(appliedIndexing?.snapshot ?? null, data),
      })

      // Vuelve al catálogo, que se vuelve a cargar al montarse y así muestra
      // el recurso recién creado sin necesidad de refrescar nada a mano.
      navigate('/catalogo', { state: { resourceCreated: true } })
    } catch (error) {
      console.error('No se pudo registrar el recurso', error)
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setFormError(failure.formError ?? null)
      setSubmitting(false)
    }
  }

  // El mismo trato que TextField da a un campo con error o con aviso.
  const descriptionNotice = noticeFor('description')
  let descriptionStateClasses = 'border-slate-300 bg-white'
  if (fieldErrors.description) descriptionStateClasses = 'border-red-500 bg-white'
  else if (descriptionNotice) descriptionStateClasses = 'border-amber-500 bg-amber-50'

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Registrar un recurso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Se publica en el catálogo asociado a tu cuenta ({account.email}).
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <TextField
              id="resource-url"
              label="Enlace"
              type="url"
              placeholder="https://…"
              hint="Pega el enlace o el identificador de un video de YouTube para completar sus datos automáticamente. También puedes usar un enlace de otra plataforma y llenar los campos a mano."
              value={form.url}
              onChange={handleUrlChange}
              onPaste={() => {
                pastedRef.current = true
              }}
              error={fieldErrors.url}
            />
            {lookingUp && (
              <p className="mt-1 text-sm text-slate-600" role="status">
                Consultando YouTube…
              </p>
            )}
          </div>

          <TextField
            id="resource-title"
            label="Título"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            error={fieldErrors.title}
            notice={noticeFor('title')}
          />

          <div>
            <label htmlFor="resource-description" className="block text-sm font-medium text-slate-700">
              Descripción
            </label>
            <textarea
              id="resource-description"
              rows={3}
              value={form.description}
              placeholder={descriptionNotice}
              onChange={(event) => updateField('description', event.target.value)}
              aria-invalid={fieldErrors.description ? true : undefined}
              aria-describedby={descriptionNotice ? 'resource-description-notice' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm ${descriptionStateClasses}`}
            />
            {descriptionNotice && (
              <p id="resource-description-notice" className="sr-only">
                {descriptionNotice}
              </p>
            )}
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-700">{fieldErrors.description}</p>
            )}
          </div>

          <TextField
            id="resource-published-at"
            label="Fecha de publicación"
            type="date"
            value={form.publishedAt}
            onChange={(event) => updateField('publishedAt', event.target.value)}
            error={fieldErrors.publishedAt}
            notice={noticeFor('publishedAt')}
          />

          <TextField
            id="resource-duration"
            label="Duración"
            type="number"
            min="1"
            step="1"
            hint="En segundos. Déjalo en blanco si no la sabes."
            value={form.durationSeconds}
            onChange={(event) => updateField('durationSeconds', event.target.value)}
            error={fieldErrors.durationSeconds}
            notice={noticeFor('durationSeconds')}
          />

          <TextField
            id="resource-channel"
            label="Canal"
            hint="Opcional: quién publicó el recurso."
            value={form.channel}
            onChange={(event) => updateField('channel', event.target.value)}
            error={fieldErrors.channel}
            notice={noticeFor('channel')}
          />

          <TextField
            id="resource-course"
            label="Curso"
            list="resource-course-options"
            hint="Si el curso no existe todavía, se crea al registrar el recurso."
            value={form.course}
            onChange={(event) => updateField('course', event.target.value)}
            error={fieldErrors.course}
          />
          <datalist id="resource-course-options">
            {courses.map((course) => (
              <option key={course.id} value={course.name} />
            ))}
          </datalist>

          <TextField
            id="resource-topics"
            label="Temas"
            hint="Sepáralos con comas. Los que no existan en el curso se crean al registrar el recurso."
            value={form.topicsText}
            onChange={(event) => updateField('topicsText', event.target.value)}
            error={fieldErrors.topics}
          />

          {suggestedTopics.length > 0 && (
            <div>
              <p className="text-xs text-slate-500">Temas ya usados en este curso:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => addTopic(topic.name)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-500 hover:bg-slate-50"
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || lookingUp}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Registrar recurso'}
          </button>
        </form>
      </div>

      <Modal
        open={pendingMetadata !== null}
        title="Datos obtenidos de YouTube"
        actions={[
          { label: 'Cancelar', onClick: cancelMetadata },
          { label: 'Insertar', onClick: insertMetadata, primary: true },
        ]}
      >
        {appliedIndexing !== null && (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            Ya insertaste los datos de otro video. Si insertas estos, se borrará todo lo que hayas ingresado en el
            formulario, incluidos el curso y los temas.
          </p>
        )}
        {pendingMetadata !== null && (
          <dl className="space-y-3 text-sm">
            {describeMetadata(pendingMetadata).map((row) => (
              <div key={row.field}>
                <dt className="font-medium text-slate-700">{row.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line wrap-break-word text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </main>
  )
}
