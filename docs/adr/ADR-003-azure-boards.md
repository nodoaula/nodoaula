# **ADR-003 — Gestión de proyecto en Azure Boards**

- **Fecha:** 2026-09-10
- **Estado:** Aceptado
- **Relacionado con:** ADR-002 (repositorio de código en GitHub)

## **Contexto**

El proyecto necesita una herramienta de seguimiento del trabajo antes de que empiece el Sprint 1. El equipo trabaja con Scrum adaptado, en cinco sprints de construcción de once días, y necesita responder durante el semestre a tres tipos de pregunta: qué está pendiente y en curso ahora mismo, cuánto trabajo se completó por iteración, y qué evidencia respalda cada objetivo específico del anteproyecto.

Estas preguntas deben poder responderse también ante los pares académicos que evalúan el informe final y la sustentación. Un registro que solo exista en la memoria del equipo no sirve para eso.

El código vive en GitHub por decisión del ADR-002, con modelo de ramificación Gitflow y `develop` como rama por defecto.

## **Decisión**

Se adopta **Azure Boards** como herramienta de gestión del trabajo, con la configuración siguiente.

### **1. Plantilla de proceso: Agile**

Se descarta la plantilla Scrum pese a que el equipo trabaja con Scrum. Dos razones:

- La plantilla Agile distingue el estado **Resolved** de **Closed**. Esa distinción modela una situación real del flujo del equipo: código integrado en `develop` pero todavía no desplegado ni verificado. La plantilla Scrum pasa de *Committed* a *Done* sin paso intermedio y no puede representarla.
- El término "historia de usuario" es más reconocible que "Product Backlog Item" y es el que emplea la literatura ágil general.

### **2. Un solo proyecto y un solo equipo**

Un producto, un proyecto. Solo el servicio **Boards** queda habilitado; Repos, Pipelines, Test Plans y Artifacts se deshabilitan para reducir el ruido de navegación.

### **3. Jerarquía y clasificación**

Jerarquía **Epic → Feature → User Story → Task**. Las épicas se alinean con el proceso transversal del producto —entrar, buscar, encontrar, consultar, colaborar— y no con los módulos técnicos, para que cada sprint pueda tocar varias épicas y entregar el recorrido completo.

Cuatro áreas: `Catálogo`, `Búsqueda`, `Colaboración` y `Plataforma`. Seis iteraciones con fechas, correspondientes a los sprints del cronograma.

### **4. Estimación en puntos, sin horas**

Se estima con **story points** en escala Fibonacci (1, 2, 3, 5, 8, 13), con una historia de referencia fijada en 2 puntos. **No se estiman las tareas en horas** y no se usa la planificación por capacidad, porque mantener dos sistemas de estimación en paralelo no aporta información proporcional a su costo diario. El burndown de sprint se configura por conteo de elementos de trabajo.

### **5. Vinculación con GitHub sin cierre automático**

Se instala la *Azure Boards App for GitHub* sobre el repositorio `nodoaula/nodoaula`. Los commits y pull requests referencian el elemento de trabajo con la sintaxis `AB#{id}`.

**No se usan los verbos de cierre automático** (`Fixes AB#`, `Closes AB#`). El motivo es directo: la transición automática se dispara cuando el commit llega a la rama por defecto, que bajo Gitflow es `develop`. La Definition of Done del equipo exige que la funcionalidad esté desplegada y verificada en el entorno público. Usar los verbos haría que el tablero declarara terminado algo que todavía no lo está, y la transparencia se perdería exactamente en el punto que más importa.

El paso a *Closed* se hace manualmente cuando la condición de despliegue se cumple. Un pull request sin referencia `AB#` no se aprueba.

## **Consecuencias**

### **Favorables**

- El equipo obtiene burndown, velocidad y flujo acumulado sin configuración adicional.
- El estado *Resolved* hace visible el trabajo integrado pero no desplegado, que en otras configuraciones queda confundido con trabajo terminado.
- Las etiquetas `evidencia-OE1` a `evidencia-OE6` permiten comprobar en cualquier momento que ningún objetivo específico va a llegar al final sin respaldo.
- La etiqueta `deuda-tecnica` convierte los atajos tomados bajo presión de tiempo en una lista consultable.
- La trazabilidad entre elemento de trabajo y código queda establecida desde el primer commit.

### **Adversas**

- Cada integrante tiene que recordar escribir `AB#` en sus mensajes de commit, y no hay nada que lo obligue.
- El cierre manual de los elementos introduce un paso que puede olvidarse. Si se olvida sistemáticamente, el tablero deja de reflejar la realidad y pierde su valor.
- El burndown por conteo de elementos es menos fino que el de horas restantes. Se acepta como intercambio consciente.
