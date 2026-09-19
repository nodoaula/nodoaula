/**
 * Cliente único de la API (ADR-006 §5, ADR-008 §3 y §4).
 *
 * Ningún componente llama a `fetch` por su cuenta: todas las peticiones pasan
 * por aquí, de modo que la forma de llegar al backend, los reintentos y el
 * tratamiento de errores viven en un solo sitio. El token CSRF que exige el
 * ADR-007 se añadirá también aquí, en la historia de inicio de sesión.
 *
 * Las rutas son relativas bajo /api y el código nunca contiene la dirección del
 * backend: en producción la resuelve la regla de reescritura del sitio estático
 * y en desarrollo el reenvío del servidor de Vite.
 */

const API_PREFIX = '/api'

// Plazos por defecto, pensados para una petición ordinaria con el backend ya
// despierto: en producción responde en torno a 0,6 s. Quince segundos por
// intento dan margen de sobra, y treinta en total permiten un reintento sin
// dejar la pantalla muerta más de lo que un usuario espera.
//
// La comprobación de arranque del servidor es el caso excepcional y amplía el
// plazo total al llamar, porque ahí esperar sí es lo correcto.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 15_000
const DEFAULT_TOTAL_TIMEOUT_MS = 30_000

// Espera entre reintentos. Crece al doble para no castigar con peticiones
// seguidas a un servidor que está arrancando, con un tope para que no se
// dispare dentro de un plazo largo.
const FIRST_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 15_000

// Lo que devuelve el proxy de Render mientras el backend todavía no atiende.
// Un 4xx no se reintenta nunca: repetir una petición mal formada da el mismo
// error tantas veces como se intente.
const RETRYABLE_STATUSES = new Set([502, 503, 504])

/** Error de una petición a la API. */
export class ApiError extends Error {
  constructor(message, { status = null, body = null, timedOut = false, cause } = {}) {
    // Las opciones solo se pasan si hay causa: `{ cause: undefined }` instala
    // igualmente la propiedad y la consola imprime "Caused by: undefined".
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiError'

    /** Código de la respuesta, o null si la petición no llegó a obtener una. */
    this.status = status

    /**
     * Cuerpo de la respuesta. Será un ProblemDetail cuando exista el manejador
     * global de errores del ADR-008 §5.
     */
    this.body = body

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

function sendOnce(path, method, body, attemptTimeoutMs) {
  // `fetch` no tiene tiempo de espera propio: sin esto, una petición que el
  // servidor nunca contesta deja la promesa pendiente para siempre.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), attemptTimeoutMs)

  return fetch(`${API_PREFIX}${path}`, {
    method,
    signal: controller.signal,

    // El navegador ve un solo sitio (ADR-006 §4), de modo que la cookie de
    // sesión es de primera parte y este valor basta para enviarla. Va escrito
    // y no implícito porque es el punto exacto que habría que cambiar a
    // 'include' si alguna vez se aplicara la alternativa del ADR-006 §4.
    credentials: 'same-origin',

    headers: {
      // Declara qué formato espera el cliente. Spring lo usa para elegir cómo
      // devolver los errores del ADR-008 §5, y refuerza la comprobación de
      // formato que hace readBody.
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).finally(() => clearTimeout(timer))
}

async function readBody(response) {
  if (response.status === 204) return null

  const text = await response.text()
  if (text === '') return null

  // El formato se decide por la cabecera que el servidor envía, no probando a
  // parsear a ver qué sale. Si /api dejara de llegar al backend —por ejemplo
  // con las reglas de reescritura en mal orden— la respuesta sería el HTML de
  // la aplicación con código 200. Adivinar el formato lo daría por bueno y la
  // aplicación informaría de un backend sano que no lo está.
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('json')) return text

  try {
    return JSON.parse(text)
  } catch (cause) {
    // Un cuerpo que se anuncia como JSON y no lo es es un error del servidor.
    // Debe fallar aquí, no propagarse disfrazado de dato válido.
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
  // Cuando el temporizador aborta la petición, `fetch` la rechaza con una
  // excepción cuyo `name` vale 'AbortError'. Como en este cliente no aborta
  // nadie más, esa marca identifica sin ambigüedad el tiempo agotado y lo
  // separa de un fallo de red, que son dos cosas distintas para el usuario.
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
  // Solo se reintentan las peticiones GET. Cuando se agota el tiempo de espera
  // no puede saberse si el backend llegó a procesar la petición, y repetir un
  // POST, un PUT o un DELETE crearía, modificaría o borraría dos veces. Un GET
  // no cambia nada, así que repetirlo es gratis.
  const canRetry = method === 'GET'
  const deadline = Date.now() + totalTimeoutMs
  let backoff = FIRST_BACKOFF_MS

  for (;;) {
    let response = null
    let failure = null

    try {
      response = await sendOnce(path, method, body, attemptTimeoutMs)
    } catch (error) {
      failure = error
    }

    if (response !== null && response.ok) {
      return readBody(response)
    }

    // La comprobación de `response` va escrita y no confiada a que el `||`
    // corte antes: una condición que solo es correcta por el orden en que
    // está escrita se rompe la primera vez que alguien la reordena.
    const isTransient =
      failure !== null || (response !== null && RETRYABLE_STATUSES.has(response.status))

    // Solo se espera si el reintento cabe entero dentro del plazo.
    if (canRetry && isTransient && Date.now() + backoff < deadline) {
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

export function get(path, options) {
  return request(path, { ...options, method: 'GET' })
}

export function post(path, body, options) {
  return request(path, { ...options, method: 'POST', body })
}

export function put(path, body, options) {
  return request(path, { ...options, method: 'PUT', body })
}

export function remove(path, options) {
  return request(path, { ...options, method: 'DELETE' })
}
