# ADR-005 — Backend, acceso a datos y gestión del esquema

- **Fecha:** 2026-09-12
- **Estado:** Aceptado

## Contexto

El Sprint 1 empieza el 14 de septiembre y ninguna de sus ocho historias puede implementarse sin saber sobre qué arquitectura de backend se construirá. Esta es la segunda de las decisiones de arquitectura que lo bloquean; la tercera, sobre el frontend, se resuelve en el ADR-006.

Cuatro condiciones acotan la elección:

1. **El ADR-004 ya fijó el entorno de ejecución.** La aplicación vive en Render, sobre la capa gratuita, y se despliega desde un Dockerfile incluido en el repositorio. Los datos están en PostgreSQL gestionado por Supabase. Este ADR no reabre esas elecciones: decide cómo se construye el backend sobre ellas.
2. **La Definition of Done exige verificación en la URL pública.** Cada historia se cierra el mismo día en que se integra, de modo que todo lo necesario para que la aplicación arranque, incluida la disponibilidad del esquema de base de datos, tiene que resolverse automáticamente, sin intervención manual. Se integra el Pull Request en `develop` y el resto ocurre solo.
3. **Hay un solo entorno.** No existe un espacio de pruebas separado, de modo que un fallo al arrancar deja la URL pública sin responder y afecta a la Definition of Done de todas las historias, no solo de la que introdujo el error.
4. **Tres personas trabajan en ramas de feature paralelas** bajo Gitflow, con revisión humana obligatoria y sin pruebas automatizadas. Lo que no sea revisable dentro de un Pull Request no queda revisado.

## Decisión

### 1. El backend expone una API REST

El backend sirve datos en JSON y no renderiza vistas. Al separar frontend y backend, estas responsabilidades se dividen. Con una API, el backend proporciona los servicios y distintos clientes pueden consumirlos. Esta separación permite que la interfaz evolucione de forma independiente del backend y facilita la construcción de interfaces con mayor interacción en el navegador. El frontend es un proyecto aparte, cuya tecnología se decide en el ADR-006. 

Se consideraron tres formas de organizar la aplicación:

- **Monolito con vistas renderizadas en el servidor**. El backend se encarga de procesar la lógica de la aplicación y de generar el HTML que recibe el navegador. El servidor web recibe la petición, consulta los datos, y genera las páginas HTML con plantillas mediante Thymeleaf, y el JavaScript que puedan tener lo ejecuta el navegador. Es un solo proyecto y un solo despliegue. Es la opción más simple porque simplifica el despliegue al concentrar la aplicación en un único proyecto.

- **Framework full-stack, como Next.js**. Permite tener frontend y determinadas funciones de servidor, como renderizado en servidor y rutas de API. Integra capacidades de frontend y backend dentro de una misma aplicación y unidad de despliegue, usando JavaScript/TypeScript. 

- **API REST y frontend separados**. El backend expone una API que devuelve datos, normalmente JSON, y el frontend construye y actualiza la interfaz en el navegador. Son dos proyectos y dos despliegues, y exigen configurar la comunicación entre ambos. La API define un contrato explícito entre pantallas y datos. Es una de las arquitecturas más extendidas en la industria.

Se adopta la tercera. Permite que los integrantes trabajen en paralelo sobre proyectos distintos con menos conflictos, reduce el acoplamiento entre la interfaz y la lógica del servidor y establece un contrato explícito de comunicación entre pantallas y datos. La misma API podría servir en el futuro a otros clientes, como una aplicación móvil, y el equipo adquiere experiencia en una arquitectura ampliamente extendida en la industria.

Las otras dos opciones se descartan por la misma razón: el monolito y Next.js concentran interfaz y servidor en una sola unidad, que es el acoplamiento que esta decisión busca evitar. El costo de la separación se declara en las consecuencias.

### 2. Java con Spring Boot

El backend se escribe en **Java 25**, la versión LTS más reciente de Java, sobre **Spring Boot 4.1.x** y se construye con **Maven**. La versión exacta de parche se fija en el `pom.xml` y se actualiza ahí sin modificar este ADR. Se despliega en **Render** como un servicio web construido desde un Dockerfile, conforme el ADR-004. Render no ofrece un entorno nativo para Java.

Se elige Spring porque reúne en un mismo ecosistema, con documentación y versiones coordinadas, lo que el proyecto necesita: servidor web, acceso a datos con Spring Data JPA y un módulo de seguridad propio para autenticación con Spring Security. La estrategia de autenticación se decide en el ADR-007.

Se descartan **Express y NestJS sobre Node.js**, pese a la ventaja de usar un solo lenguaje (JavaScript/TypeScript) en frontend y backend. Ambos obligan a elegir y combinar librerías de terceros para datos y autenticación, por ejemplo entre TypeORM o Prisma para datos, y Passport para autenticación. La ventaja de un único lenguaje no compensa el trabajo de seleccionar y ensamblar esas piezas.

Se descartan **Django con Python** y **Laravel con PHP**. Ofrecen una integración comparable a la de Spring, pero exigirían aprender un framework nuevo, lo que consume tiempo que el cronograma no tiene, empezando por el Sprint 1, que es el de menor margen.

A cambio se acepta un costo de recursos. De las alternativas evaluadas, Spring Boot con Hibernate es la de mayor consumo de memoria y arranque más lento, sobre una instancia gratuita de memoria limitada. Su efecto se declara en las consecuencias.

### 3. Acceso a datos con Spring Data JPA

La persistencia se resuelve con **Spring Data JPA** utilizando Hibernate como implementación de JPA, para las entidades del dominio: usuarios, catálogo, apuntes, foro y grupos. Estas entidades se declaran como clases Java y se mapean a las estructuras correspondientes de la base de datos. Las operaciones CRUD y las consultas ordinarias se gestionan mediante repositorios de Spring Data JPA, utilizando métodos derivados y otros mecanismos de consulta según sea necesario. Se utiliza SQL explícito únicamente cuando una consulta concreta lo requiera. 

**Persistencia** implica guardar y recuperar información de forma permanente en la base de datos. **JPA (Java Persistence API)** define una forma estándar de representar y manipular datos de una base de datos relacional mediante objetos Java, utilizando el mapeo objeto-relacional (ORM) para relacionar las clases y objetos Java con las estructuras correspondientes de la base de datos. **Hibernate** implementa JPA, realiza el mapeo y gestiona las operaciones necesarias para interactuar con la base de datos. **JDBC (Java Database Connectivity)** es la API estándar de Java que permite establecer la conexión con una base de datos y ejecutar operaciones sobre ella. De forma simplificada, el flujo es: código Java → Spring Data JPA → JPA → Hibernate → JDBC → PostgreSQL.

**Se descarta usar SQL directo como mecanismo principal de persistencia:** Spring Data JPA cubre las operaciones CRUD y las consultas ordinarias previstas para el proyecto, por lo que escribir SQL directamente para todas las operaciones no aporta una ventaja suficiente para justificar el trabajo adicional de implementación y mantenimiento.

### 4. El esquema lo gobierna Flyway, no Hibernate

Cada cambio del esquema se registra mediante una migración en un archivo SQL versionado dentro del repositorio, que **Flyway** aplica automáticamente al arrancar la aplicación. Hibernate queda configurado en modo **`validate`**: comprueba al iniciar que las entidades Java sean compatibles con las tablas existentes y falla si detecta discrepancias, pero no modifica el esquema.

**El esquema de la base de datos** es la estructura que define cómo están organizados los datos dentro de la base de datos. Incluye elementos como tablas, columnas, tipos de datos, claves primarias, claves foráneas, restricciones y otros objetos estructurales. Por tanto, un cambio del esquema modifica la estructura, no los datos almacenados en ella. **Flyway** es una herramienta de migración de bases de datos. Permite gestionar cambios controlados sobre la estructura de la base de datos mediante archivos versionados y ejecutarlos en el orden correspondiente. Mantiene un historial de las migraciones aplicadas en la propia base de datos. Las operaciones que crean o modifican tablas quedan definidas explícitamente en migraciones SQL, que Flyway se encarga de ejecutar.

**Cada migración se nombra utilizando la fecha y hora de su creación**, por ejemplo `V202609141030__create_users_table.sql`. La hora distingue migraciones creadas el mismo día, lo que evita colisiones de versión entre ramas paralelas.

**Regla de integración.** Flyway aplica las migraciones en el orden de sus versiones y rechaza una migración con versión anterior a la última ya aplicada, de modo que una rama integrada después de otra más reciente impediría arrancar la aplicación. Para evitarlo, el check del Pull Request falla si alguna migración nueva tiene una versión menor que la última presente en `develop`; el autor la renombra con la fecha y hora actuales, lo cual es válido porque todavía no se ha aplicado en el entorno desplegado. Así el orden de aplicación coincide siempre con el de las versiones, sin depender de que alguien lo recuerde.

**Esta decisión amplía la protección de `develop` establecida en el ADR-002**, que exigía Pull Request y una aprobación. Se le añade que el check de migraciones sea obligatorio y que la rama esté actualizada antes de integrar; sin esto, dos Pull Requests validados por separado podrían integrarse en un orden que el check no vio. El modelo de ramificación y la revisión humana no se alteran.

**Verificación en el Pull Request.** Un workflow de GitHub Actions comprueba en cada Pull Request hacia `develop` que ninguna migración nueva tenga una versión menor que la última presente en `develop`, y arranca la aplicación contra una base PostgreSQL efímera, en la misma versión mayor que la de Supabase. Si el orden de versiones no se respeta, si Flyway no logra aplicar las migraciones o si la validación de Hibernate falla, el check falla y el Pull Request no se integra.

**Se descarta la generación automática de esquema por Hibernate en modo `update`**. Hibernate modifica el esquema a partir de las entidades sin dejar el cambio representado explícitamente como una migración versionada en el repositorio. Además, ante determinados cambios, como el renombrado de un atributo, no puede determinar de forma general que se trata de un renombrado de la columna existente y puede terminar creando una nueva columna vacía en lugar de ejecutar una operación explícita de renombrado, con el riesgo de dejar la columna anterior y perder la correspondencia esperada con los datos. Los cambios de esquema deben quedar representados como código revisable en el Pull Request y aplicarse mediante migraciones controladas.

### 5. Conexión a PostgreSQL por JDBC a través de Supavisor

La aplicación se conecta a PostgreSQL mediante el **controlador JDBC de PostgreSQL**, utilizando **Supavisor** como pooler de conexiones de Supabase, en **modo sesión**. La cadena de conexión y las credenciales se configuran mediante variables de entorno en el proveedor de despliegue.

Se utiliza Supavisor porque la conexión directa de Supabase utiliza IPv6 por defecto, mientras que Render no proporciona conectividad IPv6 para el entorno de ejecución utilizado por el proyecto. Supavisor permite acceder a la base de datos mediante un endpoint compatible con el entorno de despliegue.

Se elige el **modo sesión** porque el backend es un proceso persistente que utiliza un pool de conexiones propio. En este modo, cada conexión del cliente permanece asociada a una conexión del servidor durante la sesión, lo que se ajusta al modelo de conexión utilizado por el backend. El **modo transacción**, en cambio, asigna las conexiones por transacción y está orientado a escenarios en los que se busca maximizar la reutilización de conexiones, por lo que introduce restricciones adicionales para aplicaciones que dependen del estado de una conexión. 

Se descarta el acceso mediante el cliente HTTP de Supabase para las operaciones sobre datos estructurados, porque la aplicación ya accede directamente a PostgreSQL mediante JDBC. Utilizar JDBC mantiene el acceso basado en PostgreSQL y el cambio a otro proveedor compatible con PostgreSQL se reduce principalmente a modificar la configuración de conexión.

Esta sección cubre únicamente el acceso a **datos estructurados en PostgreSQL**. La forma en que el backend accede al almacenamiento de archivos no se decide aquí; se resuelve junto con la US-17.

### 6. Los datos iniciales entran como migración

Los recursos del catálogo mínimo de US-07 se cargan mediante una migración de datos de Flyway. Al no existir panel de administración, es el camino que deja registro versionado de qué se cargó y cuándo. Las correcciones posteriores a esos datos entran como migraciones nuevas.

## Consecuencias

**Positivas**

- El esquema de base de datos queda versionado en el repositorio y viaja en el mismo Pull Request que el código que lo necesita, sujeto a la misma revisión humana que todo lo demás.
- El despliegue automático crea o actualiza las tablas sin que nadie entre al panel del proveedor, lo que permite cerrar una historia el mismo día en que se integra.
- El modo `validate` convierte en error de arranque lo que de otro modo sería una divergencia silenciosa entre las clases Java y las tablas.
- Una migración o una entidad que impide arrancar se detecta en el Pull Request, antes de llegar al único entorno.

**Negativas**

- **Algunas capacidades que el Sprint 1 necesita deben implementarse o configurarse explícitamente.** No se adopta un panel de administración, de modo que US-07 exige escribir la carga inicial; y la autenticación, tratada en el ADR-007, requiere configuración adicional en el backend.
- **Mayor consumo de memoria y arranque en frío más lento.** Sobre los 512 MB de la capa gratuita de Render, la espera de la primera visita tras la suspensión puede superar el minuto de referencia del ADR-004, lo que afecta al cronometraje del OE5 y al tiempo de espera de la tarea de mantenimiento de actividad. Si el proceso excede la memoria disponible, Render lo reinicia. Se limita la memoria de la JVM y el tamaño del pool de conexiones, y la duración real del arranque se mide tras el primer despliegue de US-02.
- **Separar frontend y backend añade trabajo de integración.** Son dos proyectos con despliegue propio que se coordinan mediante una API, cuyo contrato hay que mantener. Cómo ve el navegador ambas unidades se decide en el ADR-006, y la sesión del usuario, en el ADR-007.
- **Una migración que falle impide arrancar la aplicación entera.** El check del Pull Request lo detecta sobre una base vacía, pero no detecta los fallos que dependen de datos existentes, como agregar una columna `NOT NULL` sin valor por defecto a una tabla con filas. Quien escribe la migración y quien la revisa deben considerar ese caso.
- **Una base local puede quedar en un estado que no arranca**. Al cambiar de rama, una base local puede tener aplicada una migración con versión posterior a otra que todavía está pendiente, y Flyway rechazará esa migración anterior. Se resuelve borrando el contenedor y dejando que Flyway reconstruya el esquema desde cero.
- **El pool de conexiones compite con el límite del pooler.** En modo sesión, cada conexión del pool del backend ocupa una conexión de Supavisor, y la capa gratuita las limita. El tamaño del pool debe mantenerse por debajo de ese límite.
- **Flyway añade un paso a cada cambio de modelo.** Modificar una entidad obliga a escribir también su migración; olvidarlo hace fallar la validación al arrancar en lugar de que la divergencia pase inadvertida. Es trabajo adicional en cada historia que modifique el esquema, a cambio de que el cambio quede explícito y revisable.
- **Una migración integrada no se puede modificar.** Flyway detecta el cambio y la aplicación no arranca. Cualquier corrección entra como una migración nueva.
- **Cada integración obliga a actualizar los demás Pull Requests abiertos.** La regla de rama actualizada aplica a todos los Pull Requests hacia `develop`, tengan o no migraciones, de modo que tras cada integración los demás deben actualizarse y repetir el check antes de integrarse.

**Compromisos asumidos**

- Los criterios de aceptación de US-05 se precisan por Pull Request: el esquema se crea o modifica mediante una migración de Flyway, y las entidades Java se validan contra él al arrancar.
- Los criterios de aceptación de US-02 se amplían con: la conexión a la base de datos por variable de entorno a través de Supavisor en modo sesión; la ejecución automática de migraciones en el despliegue; el límite de memoria de la JVM en el Dockerfile; un tamaño de pool acorde al límite del pooler; el workflow que en cada Pull Request comprueba el orden de versiones de las migraciones y el arranque de la aplicación, y la regla de protección de `develop` que lo hace obligatorio con la rama actualizada; la medición del arranque en frío tras el primer despliegue; el entorno local con Docker Compose; y la desactivación de la Data API de Supabase. El trabajo adicional se considera en la estimación de US-02, que se revisa en el Sprint Planning.
- El compromiso del Sprint 1 se revisa en el Sprint Planning a la luz de esta decisión y de la del ADR-006.
- Ninguna tabla del entorno desplegado se crea ni se modifica desde el panel del proveedor. Todo cambio de esquema entra por migración.
- La verificación empírica de esta decisión es US-02. Si el primer despliegue revela que el proveedor no levanta la aplicación en las condiciones previstas, el cambio se hace dentro del Sprint 1, con margen.
- El desarrollo local usa una base PostgreSQL propia de cada integrante, levantada con Docker Compose y en la misma versión mayor que la de Supabase, nunca la base de Supabase. Una aplicación arrancada en local contra el entorno desplegado aplicaría en él las migraciones de una rama no integrada, y un renombrado posterior de esas migraciones impediría arrancar. Las credenciales de Supabase existen únicamente como variables de entorno en Render.
- La Data API de Supabase, su capa REST y GraphQL sobre el esquema público, se desactiva en el proyecto. El backend accede por JDBC y no la usa, y las tablas creadas por Flyway no llevan políticas de seguridad a nivel de fila. Se verifica como parte de US-02.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-002 — Repositorio de código en GitHub.
- ADR-004 — Proveedor de hospedaje y estrategia de despliegue.
- ADR-006 — Frontend.
- ADR-007 — Autenticación.
