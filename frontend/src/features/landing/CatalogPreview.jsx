import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { listCoursesWithResources, listResources } from '../catalog/api.js'
import { formatDuration } from '../catalog/format.js'
import { getYouTubeVideoId } from '../catalog/sourcePlatform.js'

const PREVIEW_SIZE = 3

/**
 * Muestra del catálogo real en la página de entrada. El buscador y los cursos
 * llevan al catálogo ya filtrado, y cada tarjeta, a la ficha de su recurso.
 * Si el catálogo no responde o no hay videos que mostrar, no se pinta nada:
 * la página de entrada se entiende igual sin la muestra.
 */
export default function CatalogPreview() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [videos, setVideos] = useState([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([listResources(), listCoursesWithResources()])
      .then(([resources, loadedCourses]) => {
        if (!active) return
        setVideos(
          resources
            .map((resource) => ({ ...resource, videoId: getYouTubeVideoId(resource.url) }))
            .filter((resource) => resource.videoId !== null)
            .slice(0, PREVIEW_SIZE),
        )
        setCourses(loadedCourses)
      })
      .catch((error) => console.error('No se pudo cargar la muestra del catálogo', error))

    return () => {
      active = false
    }
  }, [])

  if (videos.length === 0) return null

  function handleSearch(event) {
    event.preventDefault()
    const query = searchText.trim()
    navigate(query ? `/catalogo?${new URLSearchParams({ q: query })}` : '/catalogo')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl shadow-black/60">
      <form onSubmit={handleSearch} role="search" className="border-b border-border p-4">
        <label htmlFor="landing-search" className="sr-only">
          Buscar en el catálogo
        </label>
        <input
          id="landing-search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar por título, descripción o tema…"
          className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-content placeholder:text-content-faint focus:border-accent focus:outline-none"
        />
      </form>

      <ul className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3.5">
        {courses.map((course) => (
          <li key={course.id} className="shrink-0">
            <Link
              to={`/catalogo?courseId=${course.id}`}
              className="block rounded-full border border-border-strong px-3.5 py-1.5 text-[13px] font-medium text-content-muted hover:border-content-muted hover:text-content"
            >
              {course.name}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="grid gap-4 p-4 sm:grid-cols-3">
        {videos.map((video) => (
          <li key={video.id}>
            <Link
              to={`/recursos/${video.id}`}
              className="block h-full overflow-hidden rounded-xl border border-border bg-surface-hover transition hover:-translate-y-0.5 hover:border-border-strong"
            >
              <div className="relative aspect-video bg-black">
                <img
                  src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {video.durationSeconds != null && (
                  <span className="absolute right-2 bottom-2 rounded bg-surface/85 px-1.5 py-0.5 font-mono text-[11px] font-medium text-content">
                    {formatDuration(video.durationSeconds)}
                  </span>
                )}
              </div>
              <div className="px-4 pt-3.5 pb-4">
                <h3 className="text-[15px] leading-snug font-semibold text-content">{video.title}</h3>
                <p className="mt-1 text-[13px] text-content-faint">{video.course}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {video.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent"
                    >
                      {topic}
                    </span>
                  ))}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
