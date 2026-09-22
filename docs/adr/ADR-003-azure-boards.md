# ADR-003 — Gestión de proyecto en Azure Boards

- **Fecha:** 2026-09-22
- **Estado:** Aceptado
- **Relacionado con:** ADR-002 (repositorio de código en GitHub)

## Contexto

El proyecto necesita una herramienta de seguimiento del trabajo antes de que empiece el Sprint 1. El equipo trabaja con Scrum adaptado, en cinco sprints de construcción de once días, y necesita responder durante el semestre a tres tipos de pregunta: qué está pendiente y en curso ahora mismo, cuánto trabajo se completó por iteración, y qué evidencia respalda cada objetivo específico del anteproyecto.

Estas preguntas deben poder responderse también ante los pares académicos que evalúan el informe final y la sustentación. Un registro que solo exista en la memoria del equipo no sirve para eso.

El código vive en GitHub por decisión del ADR-002, con modelo de ramificación Gitflow y `develop` como rama por defecto.

## Decisión

Se adopta **Azure Boards** como herramienta de gestión del trabajo, con la configuración siguiente.

### 1. Plantilla de proceso: Agile

Se descarta la plantilla Scrum pese a que el equipo trabaja con Scrum. Dos razones:

- La plantilla Agile distingue el estado **Resolved** de **Closed**. Esa distinción modela una situación real del flujo del equipo: código integrado en `develop` pero todavía no desplegado ni verificado. La plantilla Scrum pasa de *Committed* a *Done* sin paso intermedio y no puede representarla.
- El término "historia de usuario" es más reconocible que "Product Backlog Item" y es el que emplea la literatura ágil general.

### 2. Un solo proyecto y un solo equipo

Un producto, un proyecto. Solo el servicio **Boards** queda habilitado; Repos, Pipelines, Test Plans y Artifacts se deshabilitan para reducir el ruido de navegación.

### 3. Jerarquía y clasificación

Jerarquía **Epic → Feature → User Story → Task**. Las épicas se alinean con el proceso transversal del producto —entrar, buscar, encontrar, consultar, colaborar— y no con los módulos técnicos, para que cada sprint pueda tocar varias épicas y entregar el recorrido completo.

Cuatro áreas: `Catálogo`, `Búsqueda`, `Colaboración` y `Plataforma`. Seis iteraciones con fechas, correspondientes a los sprints del cronograma.

### 4. Estimación en puntos, sin horas

Se estima con **story points** en escala Fibonacci (1, 2, 3, 5, 8, 13), con una historia de referencia fijada en 2 puntos. **No se estiman las tareas en horas** y no se usa la planificación por capacidad, porque mantener dos sistemas de estimación en paralelo no aporta información proporcional a su costo diario. El burndown de sprint se configura por conteo de elementos de trabajo.

### 5. Vinculación con GitHub sin cierre automático

Se instala la *Azure Boards App for GitHub* sobre el repositorio `nodoaula/nodoaula`. Los commits y pull requests referencian el elemento de trabajo con la sintaxis `AB#{id}`.

**No se usan los verbos de cierre automático** (`Fixes AB#`, `Closes AB#`). El motivo es directo: la transición automática se dispara cuando el commit llega a la rama por defecto, que bajo Gitflow es `develop`. La Definition of Done del equipo exige que la funcionalidad esté desplegada y verificada en el entorno público. Usar los verbos haría que el tablero declarara terminado algo que todavía no lo está, y la transparencia se perdería exactamente en el punto que más importa.

El paso a *Closed* se hace manualmente cuando la condición de despliegue se cumple. Un pull request sin referencia `AB#` no se aprueba.

### 6. Identificador EPXX en el título de las épicas

Cada épica recibe un identificador `EPXX` (`EP01`, `EP02`, ...) antepuesto a su título, con el formato `EPXX - <título>`. La numeración se da según el orden de creación.

Con un identificador fijo y conocido de antemano, no se requiere un esquema de numeración más elaborado: basta un identificador corto y estable para citarlas en el anteproyecto, el informe final y los ADR sin exponer el `System.Id` interno de Azure Boards.

### 7. Identificador FEXXX en el título de las features

Cada feature recibe un identificador `FEXXX` antepuesto a su título, con el formato `FEXXX - <título>`. El primer dígito indica la épica a la que pertenece la feature y los dos dígitos siguientes son su secuencia dentro de esa épica (`FE101`, `FE102` para las features de `EP01`; `FE201` para la única feature de `EP02`; y así sucesivamente).

Una feature suele extenderse a lo largo de varios sprints, así que no se puede numerar por sprint como las historias: su identificador tiene que derivarse de la épica que la contiene, que es estable durante todo el proyecto.

### 8. Identificador HUXXX en el título de las historias

Cada historia de usuario recibe un identificador `HUXXX` antepuesto a su título, con el formato `HUXXX - <título>`. El primer dígito indica el sprint en el que se trabaja la historia y los dos dígitos siguientes son su secuencia dentro de ese sprint, en el orden del ID interno de Azure Boards (`HU101`, `HU102`, ... para el Sprint 1; `HU201` para el Sprint 2; y así sucesivamente).

A diferencia de la épica y la feature, una historia vive en un único sprint, y anclar su identificador al sprint permite leer de un vistazo en qué iteración se trabajó sin abrir el elemento. Numerar en dos dígitos por sprint —en vez de sobre el total de historias— también deja margen para agregar o dividir historias dentro de un sprint ya numerado sin desplazar la numeración de los sprints siguientes; no se esperan más de cien historias por sprint, así que el esquema es holgado.

El identificador `AB#{id}` que ya provee Azure Boards es estable pero no es legible ni referenciable en prosa: no permite citar una épica, una feature o una historia en el documento de anteproyecto, en el informe final o en la sustentación sin exponer el ID interno de la herramienta. `EPXX`, `FEXXX` y `HUXXX` dan al equipo y a los pares evaluadores una referencia corta y jerárquica —de la épica a la feature y de la feature a la historia— desacoplada del ID autogenerado, para citar elementos de trabajo en la documentación académica y en los ADR.

Estos identificadores son una convención de título, no un campo estructurado de Azure Boards: no reemplazan el `System.Id` ni la sintaxis `AB#{id}` usada en commits y pull requests, que se mantienen sin cambios.

## Consecuencias

**Positivas**
- El equipo obtiene burndown, velocidad y flujo acumulado sin configuración adicional.
- El estado *Resolved* hace visible el trabajo integrado pero no desplegado, que en otras configuraciones queda confundido con trabajo terminado.
- Las etiquetas `evidencia-OE1` a `evidencia-OE6` permiten comprobar en cualquier momento que ningún objetivo específico va a llegar al final sin respaldo.
- La etiqueta `deuda-tecnica` convierte los atajos tomados bajo presión de tiempo en una lista consultable.
- La trazabilidad entre elemento de trabajo y código queda establecida desde el primer commit.
- Los identificadores `EPXX`, `FEXXX` y `HUXXX` permiten citar épicas, features e historias de usuario en los informes y los ADR con una referencia corta y jerárquica, sin exponer el ID interno de Azure Boards.

**Negativas**
- Cada integrante tiene que recordar escribir `AB#` en sus mensajes de commit, y no hay nada que lo obligue.
- El cierre manual de los elementos introduce un paso que puede olvidarse. Si se olvida sistemáticamente, el tablero deja de reflejar la realidad y pierde su valor.
- El `HUXXX` es correlativo por sprint: si una historia cambia de sprint, su identificador cambia con ella. El `FEXXX` es correlativo por épica: si una feature cambiara de épica —algo que no se espera, dado que las épicas están fijadas por el proceso transversal del producto—, tendría el mismo problema.
- El burndown por conteo de elementos es menos fino que el de horas restantes. Se acepta como intercambio consciente.
