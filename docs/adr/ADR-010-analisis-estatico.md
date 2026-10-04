# ADR-010 — Análisis estático del código: SonarQube Cloud desde GitHub Actions, puerta de calidad y alcance

- **Fecha:** 2026-10-04
- **Estado:** Aceptado
- **Relacionado con:** ADR-009 (pruebas automatizadas)

## Contexto

El ADR-009 dejó una puerta abierta en su apartado 5: «si se incorpora una herramienta como SonarCloud, su puerta de calidad no lleva condición de cobertura». La herramienta ya se incorporó. El repositorio está enlazado con SonarQube Cloud, el nombre actual de SonarCloud, en el proyecto `nodoaula_nodoaula`, y el resultado aparece en cada Pull Request como el check **SonarCloud Code Analysis**.

Se empezó con el **análisis automático** del servicio, que no requiere configurar nada en el repositorio, y dejó a la vista un problema: **el backend no se analizaba**. El análisis automático solo reconoce un proyecto Java si el archivo de Maven o Gradle está en la raíz del repositorio, y aquí el `pom.xml` vive en `backend/`, conforme a los ADR-005 y 006. El frontend, los workflows, el Dockerfile y las migraciones se analizaban; las clases Java, ninguna. Quedaba fuera justamente lo que el ADR-009 identificó como frontera de riesgo —`SecurityConfig`, el mapeo de errores de `shared/error`, las consultas con `@Query`— y todo el módulo `account`.

Las pruebas del ADR-009 comprueban que el sistema **se comporta** como debe. Ninguna mira **cómo está escrito**: una credencial en un archivo de configuración, un bloque duplicado o una función que nadie puede seguir pasan todas las pruebas. Hasta ahora eso lo vigilaba solo la revisión humana del ADR-001, y con el criterio de las reglas de dependencia del ADR-008, que no abarcan nada de eso.

Cinco condiciones acotan la decisión:

1. **Presupuesto de $0 y repositorio público.** El ADR-002 fijó ambas cosas. SonarQube Cloud y los minutos de GitHub Actions son gratuitos para repositorios públicos, y en la organización de SonarQube Cloud solo existen las puertas de calidad predefinidas.
2. **El ADR-009 descartó un porcentaje mínimo de cobertura** y extendió esa decisión al análisis estático. Ningún mecanismo que se adopte puede reintroducirla por otra vía.
3. **Los checks obligatorios tienen un límite declarado.** El ADR-009 se comprometió a revisar en retrospectiva si el workflow de verificación pasa de cinco minutos. Cada paso que se le añada consume ese margen.
4. **El código ya entregado no se escribió pensando en un analizador.** Arrastra incidencias de fiabilidad, seguridad y mantenibilidad, y en el backend todavía no se conocen, porque nunca se analizó. Quedan tres sprints, y en ellos se construye lo que falta del OE2, el OE3 y el OE4.
5. **El repositorio mezcla lenguajes en carpetas separadas.** Java con Maven en `backend/`, JavaScript y JSX en `frontend/`, migraciones SQL, workflows en YAML, un Dockerfile y el `pom.xml`. Un mecanismo que solo entienda la raíz, o solo una de las carpetas, deja parte del sistema sin mirar.

## Decisión

### 1. El análisis lo ejecuta un workflow propio de GitHub Actions

El análisis corre en un workflow dedicado, `.github/workflows/sonar.yml`, en cada Pull Request hacia `develop` y en cada integración en `develop`. Tiene un solo trabajo con tres pasos:

1. **Obtiene el repositorio con su historial completo**, para que SonarQube Cloud atribuya cada línea a su commit y no tome por nuevo el código que ya existía.
2. **Compila el backend sin ejecutar pruebas** con `./mvnw -B test-compile dependency:copy-dependencies`. El analizador de Java exige el bytecode y las dependencias para resolver tipos; sin ellos, el análisis falla o pierde precisión. Al no ejecutar pruebas, el paso no necesita PostgreSQL.
3. **Ejecuta el scanner oficial**, `SonarSource/sonarqube-scan-action`, que se autentica con el secreto `SONAR_TOKEN` del repositorio. La acción se fija por el SHA completo de su commit y no por una etiqueta: una etiqueta puede moverse a otro código, y esta acción recibe el token.

Lo que se analiza lo declara un único archivo en la raíz, `sonar-project.properties`: la clave del proyecto y de la organización, qué es código fuente y qué es prueba, dónde están el bytecode y las dependencias de Java y qué versión de Java se usa. El `pom.xml` no se modifica: la configuración del análisis no forma parte de la construcción del backend.

**Es un workflow aparte, y no un paso de `verify.yml`**, por dos razones. Los checks `Backend` y `Frontend` son obligatorios y su duración está acotada por la condición 3; el análisis corre en paralelo y no les suma tiempo. Además, un fallo del análisis, por ejemplo un token caducado, no debe impedir integrar, conforme al apartado 3.

**A diferencia de `verify.yml`, también corre al integrar en `develop`.** No es una repetición del análisis del Pull Request: aquel juzga el cambio, y este actualiza la rama principal del proyecto en SonarQube Cloud, que es la que guarda el historial, la deuda medida y las incidencias ya marcadas. Sin él, el panel del proyecto quedaría congelado en el último análisis y el código nuevo de cada Pull Request se compararía contra una rama desactualizada.

**Se descarta el análisis automático de SonarQube Cloud**, con el que se empezó. No exige workflow ni token, pero deja fuera el backend por la condición 5. Tampoco admite configurar exclusiones, la versión de Java ni el bytecode, y no publica registros con los que diagnosticar un análisis incompleto. Su comodidad no compensa dejar sin analizar la mitad del sistema de mayor riesgo. Además, en SonarQube Cloud ambas formas de análisis son excluyentes: el análisis automático queda desactivado en el proyecto.

**Se descarta el scanner de Maven**, el que SonarQube Cloud propone al detectar un proyecto Maven y que se configura con propiedades en el `pom.xml`. Analiza el módulo de Maven, es decir, `backend/`, de modo que el frontend, los workflows y el Dockerfile quedarían fuera o exigirían un segundo proyecto, con su propia puerta de calidad y su propio historial. El scanner genérico con el archivo de la raíz cubre todo el repositorio con un solo proyecto.

**Se descarta SonarQube Server autohospedado.** Necesita un servidor y una base de datos propios, en un proyecto cuyo único entorno es la capa gratuita de Render, donde el ADR-004 ya ajustó la memoria al límite.

**Se descarta limitarse al linter.** ESLint ya corre en el check `Frontend` y se mantiene, pero solo cubre JavaScript y sus reglas son de estilo y corrección del lenguaje. SonarQube añade reglas de seguridad, detección de duplicación, análisis de Java, YAML, Dockerfile y SQL, y un historial de la evolución del código que el linter no guarda.

### 2. La puerta de calidad es «Sonar way» y juzga solo el código nuevo

El proyecto usa la puerta predefinida **Sonar way**. Sus condiciones se aplican al **código nuevo**, no al total del proyecto. Las que se evalúan son cinco:

| Condición sobre el código nuevo | Métrica | Falla si |
|---|---|---|
| Fiabilidad | `new_reliability_rating` | la calificación es peor que A |
| Seguridad | `new_security_rating` | la calificación es peor que A |
| Mantenibilidad | `new_maintainability_rating` | la calificación es peor que A |
| Líneas duplicadas | `new_duplicated_lines_density` | supera el 3 % |
| Security hotspots revisados | `new_security_hotspots_reviewed` | es menor que el 100 % |

**La condición de cobertura no se evalúa.** Sonar way incluye una sexta condición, cobertura del código nuevo de al menos el 80 %. No basta con no enviar informes: en el análisis desde CI, los analizadores de Java y JavaScript declaran las líneas ejecutables de cada archivo aunque no llegue ningún informe, de modo que la cobertura se calcula como 0 % y la condición falla. Se comprobó en el primer análisis del workflow.

Por eso `sonar-project.properties` **excluye todos los archivos del cálculo de cobertura** con `sonar.coverage.exclusions=**`. Sin líneas por cubrir, la métrica no existe y la condición queda fuera de la evaluación. Así se cumple el ADR-009 sin mantener una puerta personalizada: en la organización solo existen las dos puertas predefinidas. El workflow, además, no ejecuta pruebas ni envía informes.

A diferencia del análisis automático, que no podía recibir cobertura aunque se quisiera, aquí la ausencia de cobertura **depende de una línea de configuración**. Por eso se declara como regla en los compromisos y no como una limitación del mecanismo.

**Se juzga el código nuevo y no el total** por la condición 4. Exigir A sobre todo el proyecto dejaría la puerta en rojo hasta saldar una deuda que no cabe en los sprints restantes, y una puerta siempre en rojo deja de leerse. Juzgando lo nuevo, la deuda existente no impide trabajar, pero no puede crecer. Es el mismo criterio del apartado 5 del ADR-009: lo ya entregado se aborda por riesgo, no por completitud.

Esto vale también para el backend, que se analiza por primera vez. Gracias al historial completo del paso 1, SonarQube Cloud fecha cada incidencia con el commit de su línea, de modo que las que aparecen en código Java ya existente cuentan como deuda y no como código nuevo.

**Se descarta «Sonar way for Agentic AI»**, la otra puerta predefinida. Está pensada para código generado por agentes, cuenta incidencias por severidad en lugar de usar calificaciones y también incluye la condición de cobertura. No aporta nada que Sonar way no cubra para este proyecto.

Los perfiles de reglas son los predefinidos de cada lenguaje. No se activan ni desactivan reglas.

### 3. El resultado informa la revisión, no bloquea la integración

El check **SonarCloud Code Analysis** aparece en cada Pull Request, pero **no se añade a los checks obligatorios** de la protección de `develop`, que siguen siendo `Backend` y `Frontend`, conforme a los ADR-005 y 009. Un Pull Request con la puerta en rojo puede integrarse, pero no sin que la revisión lo haya visto: quien revisa lee el resultado y, para cada incidencia nueva, decide con el autor si se corrige en el mismo Pull Request, se acepta o se marca como falso positivo, siempre con una justificación escrita en SonarQube Cloud.

Se deja informativo por tres razones:

- **Hay falsos positivos conocidos**, descritos en el apartado 4. Un check obligatorio bloquearía la integración por una regla que no aplica, hasta que alguien con permisos en SonarQube Cloud la marcara, y eso ocurriría con más probabilidad al cierre de un sprint.
- **Depende de piezas externas al código.** Si el servicio no responde, el análisis se retrasa o el token caduca, un check obligatorio queda pendiente o en rojo e impide integrar sin que el código tenga ningún defecto. Es el mismo riesgo que el comentario de `verify.yml` señala para los filtros de ruta.
- **El backend se analiza por primera vez.** Todavía no se sabe cuánto ruido producen las reglas de Java sobre este código. Hacer obligatoria la puerta antes de conocerlo le daría una autoridad que aún no se ha ganado.

**Se descarta hacerlo obligatorio**, por las razones anteriores. Se reevalúa si cambian, como recoge el último compromiso.

### 4. Alcance: qué se analiza y qué no

**Se analiza todo el repositorio como código fuente**, salvo lo generado, las dependencias y la documentación: `node_modules`, `target`, `dist` y `docs/`. Eso incluye el backend en Java, el frontend, los workflows de `.github/`, `docker-compose.yml`, el Dockerfile, el `pom.xml` y las migraciones.

**Las pruebas se declaran como pruebas**: `backend/src/test`, `frontend/src/test` y los archivos `*.test.js` y `*.test.jsx`. SonarQube Cloud les aplica las reglas propias del código de prueba y no las cuenta como código de producción en las condiciones de la puerta.

**Java se analiza con su bytecode, sus dependencias y la versión declarada**, Java 25, la que fijó el ADR-005. El analizador desactiva las reglas que exigen una versión superior y, con las dependencias a la vista, resuelve los tipos de Spring y JPA en lugar de adivinarlos.

**Las migraciones se analizan con reglas de PL/SQL**, el dialecto de Oracle, porque SonarQube Cloud no tiene un analizador de PostgreSQL, el motor que fijó el ADR-005. Por eso aparecen incidencias como «Use VARCHAR2 instead of VARCHAR» o «Define a constant instead of duplicating this literal», que no tienen sentido en una migración de PostgreSQL ni en los datos del catálogo semilla. Además, el ADR-005 prohíbe modificar una migración integrada, de modo que esas incidencias no podrían corregirse aunque fueran pertinentes. Se marcan como falso positivo o aceptadas, con su justificación; no se corrigen.

**Se descarta, por ahora, excluir las migraciones del análisis.** El archivo de propiedades lo permite con una línea, pero excluir oculta en lugar de resolver, y hasta que el backend lleve un sprint analizado no se sabe qué parte del ruido total aportan. Se reevalúa en retrospectiva.

### 5. Tratamiento de la deuda existente

La deuda que el análisis muestra no se aborda en una historia propia ni con el fin de dejar el contador en cero. Se trata por riesgo, igual que la deuda de pruebas del ADR-009:

1. **Las vulnerabilidades y los security hotspots.** Entre las ya conocidas, las contraseñas escritas en `docker-compose.yml` y en `verify.yml` son las de la base local y la base efímera de CI, valores ficticios y no secretos conforme al ADR-002; se marcan como revisadas con esa justificación. La recomendación de instalar las dependencias del frontend con `--ignore-scripts` se evalúa por si es aplicable sin romper la compilación.
2. **Las incidencias del backend en las fronteras de riesgo del ADR-009**, en su mismo orden: las reglas de acceso de `SecurityConfig`, el mapeo de errores de `shared/error` y las consultas con `@Query`.
3. **Los falsos positivos de las migraciones**, del apartado 4.
4. **El resto**, cuando una historia toque el archivo afectado. Una incidencia antigua en un archivo que se modifica pasa a ser responsabilidad de ese Pull Request.

### 6. Relación con los objetivos específicos

El análisis estático **no produce el indicador de ningún objetivo específico**. El anteproyecto prevé dos niveles de prueba —funcionales al cierre de cada sprint y una prueba de usabilidad con el piloto— y ninguno de los dos mira la calidad interna del código. Este ADR no sustituye a ninguno: actúa sobre lo que se construye para alcanzarlos.

Por eso importa dónde va a caer el código nuevo en los tres sprints restantes, que es donde la puerta actúa, ahora tanto en el frontend como en el backend:

- **OE2 — gestión colaborativa de apuntes con usuarios registrados.** Introduce la subida de archivos y el control de autoría del ADR-007, en su mayor parte en el backend. Es el objetivo con más superficie de seguridad, y las reglas de seguridad y los security hotspots son lo más valioso del analizador para él.
- **OE3 — obtención semiautomática de metadatos.** Supone consumir servicios externos e interpretar datos que el proyecto no controla, que es donde aparecen los hotspots sobre peticiones a terceros y el manejo de entradas no confiables.
- **OE4 — grupos de estudio y foro.** Muestra a unos estudiantes lo que escriben otros. El riesgo es que un contenido se interprete como código en el navegador, que vigilan las reglas de seguridad del frontend, o que una regla de acceso deje ver o modificar lo ajeno, que vigilan las del backend.

El **OE1** y el **OE6** son, sobre todo, un esquema documentado, un catálogo semilla y una encuesta; su única huella en el código son las migraciones, cuyo análisis el apartado 4 ya acota. El **OE5** se construyó en el Sprint 2 y está cubierto por las pruebas de búsqueda del ADR-009; su código de backend entra al análisis como deuda existente y se trata según el apartado 5.

### 7. Lo que este ADR no regula

No regula quién atiende cada incidencia, ni el texto de las justificaciones, ni la configuración del proyecto en la interfaz de SonarQube Cloud más allá de lo dicho. Siguen el mismo criterio que los ADR-001, 008 y 009 aplicaron a sus convenciones: viven fuera del expediente de decisiones.

## Consecuencias

**Positivas**

- **Todo el sistema queda bajo análisis**, incluido el backend, que es donde están las fronteras de riesgo del ADR-009 y donde se construirá buena parte del OE2, el OE3 y el OE4.
- **La revisión humana deja de ser la única mirada sobre cómo está escrito el código.** Lo que el ADR-008 no cubre —credenciales, duplicación, complejidad, riesgos de seguridad— lo señala una máquina en cada Pull Request.
- **La deuda existente queda medida y no puede crecer sin que se vea.** Cada incidencia tiene archivo, línea y regla, y la puerta sobre el código nuevo impide que aumenten en silencio.
- **El historial del proyecto se conserva.** El paso del análisis automático al workflow mantiene la misma clave de proyecto, de modo que los análisis anteriores, las incidencias ya marcadas y las revisiones de hotspots siguen ahí. El primer análisis del workflow aparece como un escalón en las métricas, al entrar el backend.
- **El análisis es configurable y diagnosticable.** Exclusiones, versión de Java y separación entre fuente y prueba viven en un archivo versionado y revisable en el Pull Request, y cada análisis deja un registro en GitHub Actions.
- **Los checks obligatorios no se alargan.** El análisis corre en paralelo, en su propio workflow.
- **El historial del proyecto en SonarQube Cloud** sirve como evidencia de la evolución de la calidad del código ante la tutora y en la sustentación.

**Negativas**

- **El repositorio gana un secreto.** `SONAR_TOKEN` es un token de una cuenta personal de SonarQube Cloud: si caduca, se revoca o su titular deja el proyecto, el análisis falla hasta que alguien genere otro. Es la clase de dependencia de una persona que la condición 3 del ADR-002 quiso evitar para el repositorio.
- **El backend se compila dos veces por Pull Request**, una en `Backend` y otra en el análisis. No retrasa los checks obligatorios, pero el resultado de SonarQube Cloud tarda más en aparecer que con el análisis automático.
- **La configuración hay que mantenerla.** Si cambia dónde vive el bytecode, aparece una carpeta de pruebas con otro patrón o cambia la versión de Java, `sonar-project.properties` debe acompañar el cambio; de lo contrario el análisis falla o clasifica mal los archivos.
- **La ausencia de cobertura depende de una línea de configuración**, no de una imposibilidad técnica. Basta con que alguien retire la exclusión de `sonar-project.properties` para que la condición del 80 % entre en la puerta, y falle.
- **Una puerta en rojo no impide integrar.** Su efecto depende de que la revisión lea el resultado, que es la misma dependencia que el ADR-009 quiso reducir para las pruebas.
- **Los falsos positivos cuestan trabajo.** Cada uno exige marcarlo y justificarlo, y las migraciones seguirán produciéndolos mientras se analicen como PL/SQL.
- **Las calificaciones globales del proyecto pueden quedar por debajo de A** mientras no se trate la deuda del apartado 5, aunque la puerta esté en verde. Quien mire solo el panel principal puede sacar una impresión equivocada.
- **Se depende de un servicio externo** y de las condiciones de su plan gratuito, que el proyecto no controla.

**Compromisos asumidos**

- La condición de cobertura no aparece en la evaluación de la puerta. Si aparece, se trata como un error de configuración y se corrige antes de seguir integrando.
- `sonar-project.properties` mantiene la exclusión de todos los archivos del cálculo de cobertura, y el workflow no ejecuta pruebas ni envía informes. Cualquier cambio en eso reabre primero el apartado 5 del ADR-009.
- El token se guarda únicamente como secreto del repositorio, nunca en un archivo. Quién lo generó y cuándo caduca se registra en el tablero, para que su renovación no dependa de la memoria de una persona.
- Las vulnerabilidades, los security hotspots y los falsos positivos conocidos del apartado 5 se resuelven o se marcan, con justificación, antes del cierre del Sprint 3.
- La plantilla de Pull Request incorpora una casilla que confirma que el resultado de SonarQube Cloud se revisó y que cada incidencia nueva quedó corregida o justificada.
- Ninguna incidencia se marca como falso positivo o aceptada sin una justificación escrita en SonarQube Cloud.
- Tras un sprint con el backend analizado, se evalúa en retrospectiva si las migraciones se excluyen del análisis.
- Si se integran Pull Requests con la puerta en rojo sin justificación, o la deuda crece de un sprint a otro, se revisa en retrospectiva si el check pasa a ser obligatorio.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-002 — Repositorio de código en GitHub.
- ADR-004 — Proveedor de hospedaje y estrategia de despliegue.
- ADR-005 — Backend, acceso a datos y gestión del esquema.
- ADR-006 — Frontend: tecnología, ubicación en el repositorio y unidad de despliegue.
- ADR-007 — Autenticación: mecanismo, sostenimiento de la sesión y alcance del acceso.
- ADR-008 — Estilo arquitectónico y organización interna del código.
- ADR-009 — Pruebas automatizadas: niveles, alcance y verificación en la integración.
- Anteproyecto del proyecto, apartado 6 (objetivos específicos) y apartado 7 (metodología).
- `.github/workflows/sonar.yml` y `sonar-project.properties`.
- Proyecto en SonarQube Cloud: `nodoaula_nodoaula`, https://sonarcloud.io/project/overview?id=nodoaula_nodoaula
