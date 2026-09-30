/**
 * Carga una sola vez la API del reproductor de YouTube. Se usa la API y no un
 * iframe suelto porque es la única forma de saber que un video no permite
 * incrustarse: el iframe es de otro origen y la página no puede leer lo que
 * muestra, pero la API avisa con un evento de error.
 */

const SCRIPT_URL = 'https://www.youtube.com/iframe_api'

// Un bloqueador de contenido puede dejar el script cargado a medias, sin que
// llegue nunca el aviso de que está listo. Pasado este plazo se da por
// fallido y la ficha ofrece el enlace.
const LOAD_TIMEOUT_MS = 15_000

let apiPromise = null

export function loadYouTubeIframeApi() {
  if (apiPromise !== null) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const script = document.createElement('script')

    function fail(message) {
      // Sin esto, un fallo pasajero dejaría la promesa rechazada para
      // siempre y ninguna ficha volvería a intentarlo sin recargar.
      apiPromise = null
      script.remove()
      reject(new Error(message))
    }

    const timer = setTimeout(() => fail('La API del reproductor de YouTube no respondió a tiempo'), LOAD_TIMEOUT_MS)

    // La API avisa llamando a esta función global cuando está lista.
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      previousCallback?.()
      resolve(window.YT)
    }

    script.src = SCRIPT_URL
    script.async = true
    script.onerror = () => {
      clearTimeout(timer)
      fail('No se pudo cargar la API del reproductor de YouTube')
    }
    document.head.appendChild(script)
  })

  return apiPromise
}
