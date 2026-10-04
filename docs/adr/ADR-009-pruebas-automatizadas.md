# ADR-009 — Pruebas automatizadas: niveles, alcance y verificación en la integración

- **Fecha:** 2026-10-03
- **Estado:** Aceptado

## Contexto

La ausencia de pruebas automatizadas no era un descuido: era una **premisa declarada**, sobre la que se apoyan decisiones de tres ADR anteriores.

- El **ADR-001** la enuncia como condición: «No hay pruebas automatizadas ni se prevé construirlas dentro del semestre. Por lo tanto la verificación antes de integrar tiene que ser humana y obligatoria.»
- El **ADR-005** la repite en su condición 4: «Lo que no sea revisable dentro de un Pull Request no queda revisado.»
- El **ADR-008** la usa para justificar que las reglas de dependencia de su apartado 4 las verifique la revisión, y recuerda que el check de cada Pull Request «comprueba que la aplicación arranca, no que se comporte como debe».

Esa premisa deja de ser cierta, y por eso hace falta escribirlo: una condición que tres ADR dan por buena no puede caer sin dejar rastro.

Cinco circunstancias acotan la decisión:

1. **La asignatura las exige.** Dejan de ser una mejora deseable para convertirse en un requisito de entrega, al mismo nivel que los objetivos específicos del anteproyecto.
2. **La decisión ya está tomada de hecho.** Al cierre del Sprint 2 existen seis clases de prueba en el módulo `catalog` y Vitest configurado en el frontend, escritas antes de que ningún documento dijera cómo. Es la misma situación que el ADR-008 describió para la organización del código.
3. **Lo entregado hasta ahora se construyó sin ellas.** Quince historias están cerradas. En el cierre del Sprint 2 se cubrió parte del módulo `catalog` —catálogo semilla, registro de un recurso con la reutilización de cursos y temas, listado, filtros y búsqueda, y con ello las tres consultas con `@Query`—, pero `account` no tiene ninguna prueba, ni la ficha de un recurso, ni casi nada del frontend. Cubrir el resto por completo no cabe en los tres sprints restantes.
4. **Media infraestructura ya existe.** El workflow de verificación del ADR-005 levanta un PostgreSQL efímero en cada Pull Request y ejecuta `./mvnw -B test`; el entorno local de cada integrante tiene su propia base con Docker Compose. No hace falta inventar dónde corren.
5. **El backend tiene servicios delgados.** Reciben, delegan en el repositorio y convierten a DTO, conforme al apartado 5 del ADR-008. La lógica que puede fallar no vive en ellos.

## Decisión

### 1. El backend se prueba por integración, contra una base de datos real

Las pruebas del backend arrancan el contexto completo con `@SpringBootTest` y se ejecutan contra PostgreSQL, el mismo motor y la misma versión mayor que el entorno desplegado. Cada prueba se anota con `@Transactional`, de modo que sus datos se revierten al terminar y el orden entre pruebas es irrelevante. Cuando lo que se prueba es el contrato HTTP —códigos de estado, forma del JSON, acceso sin sesión— se añade `@AutoConfigureMockMvc` y se llama por la ruta; cuando lo que se prueba es una regla del producto, se llama al servicio.

La razón es la condición 5. Los defectos que este proyecto puede producir no están en los servicios, sino en las fronteras que un servicio no contiene:

- **Una consulta JPQL que se analiza bien y devuelve las filas equivocadas.** Los tres repositorios del catálogo tienen consultas con `@Query`; Hibernate las valida al arrancar, de modo que un error de sintaxis se detecta, pero uno de semántica no.
- **Las reglas de `SecurityConfig`.** Que el catálogo siga siendo público y que registrar un recurso siga exigiendo sesión depende de una lista de rutas; una línea mal puesta es un agujero de seguridad que ningún otro mecanismo detecta.
- **El mapeo de errores de `shared/error`.** Que un recurso inexistente responda 404 con su `code` y un correo repetido responda 409 es contrato con el frontend, no detalle interno.
- **Las relaciones perezosas con `open-in-view` desactivado.** El ADR-008 lo adoptó a propósito; su consecuencia es que tocar una relación fuera de la transacción falla. Ya ocurrió al escribir las primeras pruebas del catálogo semilla.

**Se descarta la pirámide de pruebas clásica**, con muchas unitarias y pocas de integración. Supone una capa de dominio gruesa donde probar reglas aisladas rinde. Aquí el comportamiento vive en el mapeo JPA, en la consulta y en la configuración de seguridad, de modo que la base de la pirámide probaría lo que menos puede romperse.

**Se descarta aislar los servicios con simulacros.** Sustituir el repositorio por un doble convierte la prueba en una comprobación de que el simulacro devuelve lo que se le dijo que devolviera. Una consulta mal escrita pasaría esa prueba, que es precisamente el defecto que importa cazar.

**Se descarta `@DataJpaTest`.** Exigiría un starter adicional y probaría el repositorio aislado del servicio, cuando lo que interesa es que servicio, consulta y esquema concuerden. Además sustituye por omisión PostgreSQL por una base en memoria: las migraciones de Flyway —que el ADR-005 declaró gobierno único del esquema— correrían contra otro motor, y lo que fuera propio de PostgreSQL fallaría o se comportaría distinto.

**Se descarta Testcontainers.** Levanta la base desde la propia prueba, lo que resolvería un problema que este proyecto no tiene: la CI ya aporta un contenedor de PostgreSQL como servicio y el entorno local ya se levanta con Docker Compose. Añadirlo duplicaría ese mecanismo y alargaría la suite.

### 2. El frontend prueba funciones puras y comportamiento de pantalla

Las pruebas del frontend se ejecutan con **Vitest**, que comparte configuración y transformaciones con Vite y no obliga a mantener una cadena de herramientas paralela, sobre **jsdom** y con **Testing Library**.

Se cubren dos cosas distintas:

- **Las funciones puras de cada módulo**, que no necesitan navegador ni servidor: el troceado de temas y las validaciones de `features/catalog/validation.js`, el formato de duración y tipo de `format.js`, y el filtrado de enlaces de `sourcePlatform.js`. Esta última es la más urgente de todas: existe para impedir que un enlace `javascript:` guardado en la base se convierta en un enlace pulsable, es una protección de seguridad, y hasta ahora nada comprobaba que funcionara.
- **El comportamiento observable de una pantalla**, interactuando como lo haría una persona —escribir en un campo, pulsar un botón, leer lo que aparece— y nunca a través del estado interno del componente. Una prueba que inspecciona el estado se rompe al reorganizar el componente aunque la pantalla siga comportándose igual.

**Se descartan las pruebas de extremo a extremo**, con Playwright o Cypress. Exigen los dos servicios levantados y un navegador real, y su mantenimiento compite con los tres sprints que quedan. La Definition of Done ya obliga a verificar cada historia en el entorno público, que es una comprobación de extremo a extremo hecha por una persona.

### 3. Las pruebas corren en cada Pull Request y bloquean la integración

El workflow de verificación ejecuta `./mvnw -B test` en el trabajo de backend, contra el PostgreSQL efímero que ya levantaba, y `npm run test` en el de frontend, entre el linter y la compilación. Ambos trabajos son checks obligatorios en la protección de `develop` establecida por el ADR-005, de modo que una prueba en rojo impide integrar.

No se añade ningún check nuevo: se amplía lo que los dos existentes comprueban. El check de backend pasa de verificar que la aplicación arranca a verificar también que se comporta como debe.

### 4. Las pruebas entran en la Definition of Done

La columna **En desarrollo** del tablero exige ahora, además de los criterios de aceptación cumplidos localmente y de que no haya credenciales en el código, **pruebas automatizadas de la lógica nueva, en verde**.

Se escribe ahí y no en los criterios de cada historia porque es una regla del equipo y no de una funcionalidad concreta. Una historia que no introduzca lógica —un cambio de texto, un ajuste de estilos— no inventa pruebas para cumplir el trámite.

### 5. Lo ya entregado se cubre por riesgo, no por completitud

Lo que quedó sin cubrir se aborda en una historia propia del Sprint 3, en este orden:

1. Las reglas de acceso de `SecurityConfig`.
2. El mapeo de errores a `ProblemDetail`.
3. Las funciones puras del frontend, empezando por el filtrado de enlaces.

Esa misma historia produce la evidencia del OE5: un conjunto de consultas representativas definido de antemano, cada una con el recurso que debe devolver, ejecutado como prueba en cada Pull Request.

Lo que no entre en esa historia queda como deuda registrada en el tablero, no como pendiente implícito.

**Se descarta fijar un porcentaje mínimo de cobertura.** Un número obliga a perseguir las líneas más baratas de cubrir, que son las que menos fallan —constructores, getters, mapeos triviales—, y deja sin tocar la consulta de tres cláusulas que es donde está el riesgo. El criterio es el orden anterior, no una cifra. Esto alcanza también al análisis estático: si se incorpora una herramienta como SonarCloud, su puerta de calidad no lleva condición de cobertura.

### 6. Lo que este ADR no regula

No regula los nombres de los archivos ni de los métodos de prueba, ni obliga a escribir la prueba antes que el código. Siguen el mismo criterio que el ADR-001 aplicó a las convenciones de rama y el ADR-008 al formato del código: viven fuera del expediente de decisiones.

## Consecuencias

**Positivas**

- **La premisa que sostenía tres ADR deja de ser una debilidad declarada.** La revisión humana del ADR-001 sigue siendo obligatoria, pero deja de ser el único filtro: parte de lo que el ADR-008 encomendaba a la revisión queda ahora comprobado por una máquina en cada Pull Request.
- **Una consulta mal escrita se detecta antes de integrar**, no en el entorno desplegado, que es el único que hay.
- **El contrato de la API queda fijado por pruebas.** Los códigos de estado y la forma del JSON que el frontend espera dejan de depender de que nadie los cambie sin darse cuenta.
- **El indicador del OE5 se puede producir automáticamente**: un conjunto de consultas representativas y el recurso que cada una debe devolver es una prueba más, que corre en cada integración.
- **La refactorización deja de ser arriesgada** en el tramo final del proyecto, que es cuando más se toca código ya entregado.

**Negativas**

- **`@SpringBootTest` arranca el contexto completo**, de modo que la suite tarda más que una de pruebas unitarias y crecerá con cada historia. El check del Pull Request tardará más y el ciclo local también.
- **Las pruebas del backend exigen una base de datos viva en todas partes.** Quien no tenga Docker levantado no puede ejecutar la suite.
- **La reversión por `@Transactional` oculta una clase de defecto**: lo que solo falla al confirmar la transacción, como una restricción diferida, no aparece.
- **Queda deuda sin cubrir**, y la más grande es el módulo `account`: el registro, el inicio de sesión y la expiración no tienen ninguna prueba, y son lo que un fallo deja peor. Se asume con los ojos abiertos; no se cierra en este proyecto.
- **Cada historia cuesta más a partir de ahora**, y los tres sprints restantes absorben ese coste sin que el alcance se haya reducido.
- **La trampa de las relaciones perezosas del ADR-008 reaparece en las pruebas.** Ya obligó a una corrección al escribir las primeras del catálogo semilla, y volverá a aparecer cada vez que una prueba toque una relación fuera de la transacción.

**Compromisos asumidos**

- Ninguna historia se cierra sin las pruebas de la lógica que introduce, desde esta decisión y no de forma retroactiva.
- La deuda de lo ya entregado se cubre en la historia correspondiente del Sprint 3, en el orden de riesgo del apartado 5. Lo que no quepa se registra en el tablero.
- Si el workflow de verificación pasa de cinco minutos, se revisa en retrospectiva antes de añadir más pruebas de integración, no a mitad de sprint.
- La condición de los ADR-001, 005 y 008 que afirma que no hay pruebas automatizadas queda derogada por este ADR. Las decisiones que esos ADR tomaron no se reabren: la revisión humana sigue siendo obligatoria y las reglas de dependencia siguen verificándose en ella.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-002 — Repositorio de código en GitHub.
- ADR-005 — Backend, acceso a datos y gestión del esquema.
- ADR-006 — Frontend: tecnología, ubicación en el repositorio y unidad de despliegue.
- ADR-007 — Autenticación: mecanismo, sostenimiento de la sesión y alcance del acceso.
- ADR-008 — Estilo arquitectónico y organización interna del código.
