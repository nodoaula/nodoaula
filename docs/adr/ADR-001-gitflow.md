# ADR-001 — Adopción de Gitflow como modelo de ramificación

- **Fecha:** 2026-09-09
- **Estado:** Aceptado

---

## Contexto

Tres personas trabajan sobre una misma base de código. Git no impone un modelo de ramificación: hay que elegirlo, y sin un acuerdo explícito el trabajo paralelo produce pérdida silenciosa de cambios, historial ilegible y bloqueos mutuos.

Tres condiciones del proyecto acotan la elección:

1. **Se trabaja por sprints con entrega de valor al cierre de cada uno.** Cada sprint produce un incremento funcional, desplegado y usable de punta a punta. Son entregas versionadas discretas, no un único despliegue al final del semestre.
2. **No hay pruebas automatizadas** ni se prevé construirlas dentro del semestre. Por lo tanto la verificación antes de integrar tiene que ser humana y obligatoria.
3. **El equipo no tiene experiencia previa** con ningún modelo de ramificación.

Las condiciones 1 y 2 empujan hacia un modelo con ramas de versión y revisión obligatoria. La condición 3 empuja en dirección contraria, hacia el modelo más simple posible. La decisión resuelve esa tensión a favor de las dos primeras.

El análisis comparativo de los modelos disponibles está en la guía de aprendizaje asociada.

## Decisión

Se adopta **Gitflow**, con dos ramas primarias y tres tipos de rama de soporte:

- `main` almacena el historial de versiones publicadas. Solo recibe merges de `release/` y `hotfix/`, cada uno etiquetado con su tag. Commits directos bloqueados.
- `develop` es la rama de integración y la rama por defecto del repositorio.
- `feature/` nace de `develop` y vuelve a `develop`. Nunca toca `main`.
- `release/` nace de `develop` al cierre de cada sprint y se integra hacia `main` **y** hacia `develop`.
- `hotfix/` nace de `main` y se propaga hacia `main` **y** hacia `develop`.
- Toda integración ocurre por Pull Request con aprobación de al menos otro integrante.
- Versionado semántico, con una versión menor por sprint: `v0.1.0` al cerrar el Sprint 1, hasta `v1.0.0` en la entrega del piloto.

Las convenciones de nombres de rama, formato de mensajes de commit y criterios de revisión están en la guía de aprendizaje, no en este documento.

## Consecuencias

**Positivas**
- `main` refleja en todo momento lo que está desplegado; su historial equivale a la lista de entregas del proyecto.
- Las ramas de release permiten estabilizar la entrega de un sprint sin detener el trabajo del siguiente.
- La revisión obligatoria distribuye el conocimiento del sistema y evita que alguien quede como único conocedor de un módulo.

**Negativas**
- Mayor carga de proceso que modelos más simples: cinco tipos de rama y dos merges por versión.
- Curva de aprendizaje que consume tiempo del primer sprint.
- El punto de falla más frecuente es omitir la propagación de `release/` y `hotfix/` hacia `develop`, cuyo síntoma es que errores ya corregidos reaparecen en la versión siguiente sin explicación aparente.

**Compromisos asumidos**
- Las ramas de feature no exceden la duración de un sprint. Si una tarea lo requiere, la historia de usuario está mal dimensionada y debe partirse.
- Toda decisión de arquitectura entra al repositorio por el mismo flujo que el código, con prefijo `docs/`.

## Referencias

- Guía de aprendizaje: *Control de versiones y modelos de ramificación: Gitflow*.
- ADR-002 — Repositorio de código en GitHub.
