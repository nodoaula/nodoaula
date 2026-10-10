import { useId, useRef, useState } from 'react'

/**
 * Pestañas accesibles: las flechas izquierda y derecha, Inicio y Fin mueven
 * entre ellas y las activan, como en el patrón de pestañas de WAI-ARIA. Los
 * paneles no elegidos se ocultan pero siguen montados, para que un video no
 * se detenga al mirar otra pestaña.
 *
 * `tabs` es una lista de { id, label, content }.
 */
export default function Tabs({ label, tabs }) {
  const baseId = useId()
  const [selectedId, setSelectedId] = useState(tabs[0].id)
  const tabRefs = useRef({})

  function selectAt(index) {
    const tab = tabs[(index + tabs.length) % tabs.length]
    setSelectedId(tab.id)
    tabRefs.current[tab.id]?.focus()
  }

  function handleKeyDown(event, index) {
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    selectAt(moves[event.key])
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-7 border-b border-border">
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[tab.id] = element
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`-mb-px border-b-2 py-3 text-body transition-colors ${
                selected ? 'border-accent font-medium text-content' : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selectedId}
          tabIndex={0}
          className="pt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
