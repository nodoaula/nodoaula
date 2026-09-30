/**
 * Cliente único de la API: ninguna pantalla llama a `fetch` por su cuenta, de
 * modo que la forma de llegar al backend, los reintentos, el token CSRF y el
 * tratamiento de errores viven en un solo sitio.
 *
 * Las rutas son relativas bajo /api y el código nunca contiene la dirección
 * del backend: en producción la resuelve la reescritura del sitio estático y
 * en desarrollo el reenvío del servidor de Vite.
 */

const API_PREFIX = '/api'

// Plazos de una petición ordinaria con el backend ya despierto. La
// comprobación de arranque es el caso excepcional y amplía el plazo total al
// llamar, porque ahí esperar sí es lo correcto.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 15_000
const DEFAULT_TOTAL_TIMEOUT_MS = 30_000

const FIRST_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 15_000

// Lo que devuelve el proxy mientras el backend todavía no atiende. Un 4xx no
// se reintenta nunca: repetir una petición mal formada da el mismo error.
const RETRYABLE_STATUSES = new Set([502, 503, 504])

// El backend deja el token en esta cookie, legible a propósito, y lo exige en
// este encabezado en toda petición que modifica datos. La cookie de sesión es
// otra y el código no puede leerla.
const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD'])

/** Código con que el backend distingue un rechazo por CSRF de uno por permisos. */
export const CSRF_ERROR_CODE = 'CSRF_TOKEN_INVALID'

/** Error de una petición a la API. */
export class ApiError extends Error {
  constructor(message, { status = null, body = null, timedOut = false, cause } = {}) {
    // Las opciones solo se pasan si hay causa: `{ cause: undefined }` instala
    // igualmente la propiedad y la consola imprime "Caused by: undefined".
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiError'

    /** Código de la respuesta, o null si la petición no llegó a obtener una. */
    this.status = status

    /** Cuerpo de la respuesta, cuando se pudo leer. */
    this.body = body

    /**
     * Causa del error según el backend, como EMAIL_ALREADY_IN_USE. Es lo que
     * se compara; el título y el detalle son texto y pueden cambiar.
     */
    this.code = body?.code ?? null

    /**
     * Cierto cuando se agotó el tiempo de espera. Importa porque entonces no
     * puede saberse si el backend llegó a procesar la petición: quien muestre
     * el error debe invitar a comprobar antes de repetir, no a repetir sin más.
     */
    this.timedOut = timedOut
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

// Se lee en cada petición y no se guarda: el backend renueva el token al
// iniciar y al cerrar sesión, y uno guardado dejaría de valer.
function readCsrfToken() {
  const prefix = `${CSRF_COOKIE}=`
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix))
  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length))
}

function sendOnce(path, method, body, csrfToken, attemptTimeoutMs) {
  // `fetch` no tiene tiempo de espera propio: sin esto, una petición que el
  // servidor nunca contesta deja la promesa pendiente para siempre.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), attemptTimeoutMs)

  // Un formulario lo codifica el propio navegador, con su Content-Type; el
  // resto de cuerpos van como JSON.
  const isForm = body instanceof URLSearchParams

  return fetch(`${API_PREFIX}${path}`, {
    method,
    signal: controller.signal,

    // El navegador ve un solo sitio, de modo que la cookie de sesión es de
    // primera parte y este valor basta para enviarla.
    credentials: 'same-origin',

    headers: {
      Accept: 'application/json',
      ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(csrfToken === null ? {} : { [CSRF_HEADER]: csrfToken }),
    },
    body: body === undefined || isForm ? body : JSON.stringify(body),
  }).finally(() => clearTimeout(timer))
}

async function readBody(response) {
  if (response.status === 204) return null

  const text = await response.text()
  if (text === '') return null

  // Este cliente solo habla con una API JSON y así lo declara en Accept. Otro
  // formato significa que la petición no llegó al backend: con las reglas de
  // reescritura en mal orden llegaría el HTML de la aplicación con código 200,
  // y darlo por bueno haría creer que el servidor responde cuando no lo hace.
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('json')) {
    throw new ApiError('El servidor devolvió una respuesta que no es JSON', {
      status: response.status,
      body: text,
    })
  }

  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new ApiError('El servidor anunció JSON y devolvió algo que no lo es', {
      status: response.status,
      body: text,
      cause,
    })
  }
}

// En el camino de error, un cuerpo ilegible no debe tapar el error original:
// lo que importa entonces es el código de respuesta, no el detalle.
async function readBodyQuietly(response) {
  try {
    return await readBody(response)
  } catch {
    return null
  }
}

function toTransportError(failure) {
  // En este cliente no aborta nadie más que el temporizador, así que esa marca
  // identifica el tiempo agotado y lo separa de un fallo de red.
  const timedOut = failure?.name === 'AbortError'

  return new ApiError(
    timedOut
      ? 'Se agotó el tiempo de espera del servidor'
      : 'No se pudo contactar con el servidor',
    { timedOut, cause: failure },
  )
}

async function request(path, {
  method = 'GET',
  body,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
} = {}) {
  // Solo se reintentan los GET: tras un tiempo agotado no puede saberse si el
  // backend procesó la petición, y repetir un POST crearía dos veces.
  const canRetry = method === 'GET'
  const deadline = Date.now() + totalTimeoutMs
  let backoff = FIRST_BACKOFF_MS

  // La aplicación pide el token al cargar, pero la cookie pudo borrarse
  // después; sin ella, la petición se rechazaría con un 403.
  const needsCsrf = !SAFE_METHODS.has(method)
  if (needsCsrf && readCsrfToken() === null) {
    await loadCsrfToken()
  }

  for (;;) {
    let response = null
    let failure = null

    try {
      const csrfToken = needsCsrf ? readCsrfToken() : null
      response = await sendOnce(path, method, body, csrfToken, attemptTimeoutMs)
    } catch (error) {
      failure = error
    }

    if (response !== null && response.ok) {
      return readBody(response)
    }

    // La comprobación de `response` va escrita y no confiada a que el `||`
    // corte antes: una condición correcta solo por el orden en que está
    // escrita se rompe la primera vez que alguien la reordena.
    const isTransient =
      failure !== null || (response !== null && RETRYABLE_STATUSES.has(response.status))

    // El intento siguiente entra en la cuenta: si solo se midiera la espera,
    // una petición podría durar un intento entero más que su plazo total.
    const retryCabeEnElPlazo = Date.now() + backoff + attemptTimeoutMs <= deadline

    if (canRetry && isTransient && retryCabeEnElPlazo) {
      await wait(backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
      continue
    }

    if (failure !== null) throw toTransportError(failure)

    throw new ApiError(`El servidor respondió ${response.status}`, {
      status: response.status,
      body: await readBodyQuietly(response),
    })
  }
}

/**
 * Hace que el backend deje el token CSRF en su cookie. Se llama al cargar la
 * aplicación, antes de cualquier petición que modifique datos (ADR-007).
 */
export function loadCsrfToken() {
  return get('/csrf')
}

export function get(path, options) {
  return request(path, { ...options, method: 'GET' })
}

export function post(path, body, options) {
  return request(path, { ...options, method: 'POST', body })
}

/**
 * Como `post`, pero envía los campos como formulario y no como JSON. Lo
 * necesita el inicio de sesión: el filtro de login de Spring Security lee
 * parámetros de formulario.
 */
export function postForm(path, fields, options) {
  return request(path, { ...options, method: 'POST', body: new URLSearchParams(fields) })
}

export function put(path, body, options) {
  return request(path, { ...options, method: 'PUT', body })
}

export function remove(path, options) {
  return request(path, { ...options, method: 'DELETE' })
}
