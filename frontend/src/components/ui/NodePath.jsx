import { Link } from 'react-router'

/**
 * Ruta de navegación dibujada como el gráfico de nodos de la página de
 * entrada: cada paso es un nodo unido al siguiente, y el actual se marca en
 * turquesa. `items` son los pasos anteriores, con su enlace; `current`, el
 * nombre de la página en la que se está.
 */
export default function NodePath({ label, items, current }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-y-2 text-label text-content-muted">
        {items.map((item) => (
          <li key={item.to} className="flex items-center">
            <Link to={item.to} className="flex items-center gap-2 hover:text-content">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-content" />
              {item.label}
            </Link>
            <span aria-hidden="true" className="mx-2.5 h-px w-4 bg-border-strong sm:w-8" />
          </li>
        ))}
        <li aria-current="page" className="flex items-center gap-2 text-content">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-accent outline outline-offset-2 outline-accent/45"
          />
          {current}
        </li>
      </ol>
    </nav>
  )
}
