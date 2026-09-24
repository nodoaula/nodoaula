import { useEffect, useRef, useState } from 'react'

import { getYouTubeVideoId } from './sourcePlatform.js'
import { loadYouTubeIframeApi } from './youtubeIframeApi.js'

/**
 * Reproduce el video dentro de la ficha con el reproductor oficial de YouTube
 * (historia HU108). NodoAula no descarga ni aloja el archivo. Si el enlace no
 * es de YouTube, o el video no permite incrustarse, no hay reproductor: la
 * ficha ofrece el enlace a la plataforma de origen, que siempre está visible.
 */
export default function ResourcePlayer({ url, title }) {
  const videoId = getYouTubeVideoId(url)
  const wrapperRef = useRef(null)

  // Se guarda para qué video falló y no un simple sí o no, de modo que el
  // aviso no se quede pegado si la ficha pasa a mostrar otro video.
  const [failedVideoId, setFailedVideoId] = useState(null)
  const embedFailed = videoId !== null && failedVideoId === videoId

  useEffect(() => {
    if (videoId === null) return

    const wrapper = wrapperRef.current
    let active = true
    let player = null

    loadYouTubeIframeApi()
      .then((YT) => {
        if (!active) return

        // La API sustituye el nodo que recibe por su iframe. Se le da uno
        // creado aquí y no uno de React, que al desmontar intentaría quitar
        // un nodo que ya no existe.
        const target = document.createElement('div')
        wrapper.appendChild(target)

        player = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          // Modo de privacidad mejorada: el mismo reproductor oficial, pero
          // YouTube no deja cookies hasta que el usuario pulsa reproducir.
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0 },
          events: {
            onReady: (event) => {
              // Un lector de pantalla anuncia el iframe por su título.
              event.target.getIframe().title = `Reproductor de video: ${title}`
            },
            // Llega con 101 o 150 cuando el propietario no permite
            // incrustarlo, y con otros códigos cuando el video no existe o
            // es privado. En todos los casos lo útil es ofrecer el enlace.
            onError: (event) => {
              console.error('El reproductor de YouTube no pudo reproducir el video', event.data)
              if (active) setFailedVideoId(videoId)
            },
          },
        })
      })
      .catch((error) => {
        console.error('No se pudo preparar el reproductor de YouTube', error)
        if (active) setFailedVideoId(videoId)
      })

    return () => {
      active = false
      player?.destroy()
      wrapper.replaceChildren()
    }
  }, [videoId, title])

  if (videoId === null) {
    return (
      <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Este recurso no se puede reproducir dentro de NodoAula. Ábrelo en su plataforma de origen con el enlace de
        abajo.
      </p>
    )
  }

  return (
    <div>
      {/* El contenedor sigue montado aunque falle, para que el efecto pueda
          limpiarlo; solo se oculta. */}
      <div
        ref={wrapperRef}
        hidden={embedFailed}
        className="aspect-video w-full overflow-hidden rounded-md bg-slate-900"
      />

      {embedFailed && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Este video no permite reproducirse fuera de YouTube. Ábrelo en su plataforma de origen con el enlace de abajo.
        </p>
      )}
    </div>
  )
}
