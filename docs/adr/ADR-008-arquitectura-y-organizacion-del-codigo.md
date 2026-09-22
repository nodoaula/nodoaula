# ADR-008 — Estilo arquitectónico y organización interna del código

- **Fecha:** 2026-09-15
- **Estado:** Aceptado

## Contexto

Los ADR-005, 006 y 007 fijaron con qué se construye el sistema, pero ninguno declaró **cómo se organiza por dentro**. La decisión estaba tomada de hecho sin estar escrita, que es exactamente la situación que el registro de decisiones existe para evitar.

Cuatro condiciones la acotan:

1. **Tres personas trabajan en ramas de feature paralelas** bajo Gitflow, con revisión obligatoria por otro integrante y sin pruebas automatizadas de funcionalidad, conforme al ADR-005. El check que ese ADR exige en cada Pull Request comprueba que la aplicación arranca, no que se comporte como debe. Sin un acuerdo previo sobre dónde va cada cosa, la lógica acaba en tres sitios distintos y la revisión se convierte en una discusión de estilo en lugar de una revisión de fondo.
2. **El proyecto tiene cinco sprints de construcción y un alcance acotado**: catálogo con sus apuntes, búsqueda, cuentas, foro y grupos, organizados en el tablero del ADR-003 como épicas y features. No es un sistema que vaya a crecer indefinidamente ni que vaya a mantener un equipo distinto del que lo escribe.
3. **El equipo estrena Gitflow, Azure Boards y despliegue a la vez.** Cualquier estructura que exija criterio propio para decidir dónde va cada archivo compite con ese aprendizaje.
4. **El problema aparece en dos proyectos.** El ADR-005 separó backend y frontend y el ADR-006 los publica como unidades distintas, de modo que la organización interna debe resolverse dos veces. Mantener criterios distintos en cada uno sería lo peor de ambos.

## Decisión

### 1. La aplicación es un monolito modular con cliente separado

El backend es **un único proceso desplegable** con una sola base de datos, dividido internamente en módulos por área del producto. El frontend es otra unidad de despliegue, conforme al ADR-006, pero eso no reparte el sistema: sigue habiendo un backend y un modelo de datos.

Los módulos son carpetas dentro del mismo programa. Cuando uno necesita algo de otro, lo llama en memoria, como cualquier clase llama a otra.

**Se descartan los microservicios.** Resuelven problemas que este proyecto no tiene: equipos independientes desplegando por separado, partes del sistema que escalan a ritmos distintos y tolerancia a fallos parciales. A cambio traen varios despliegues que coordinar, comunicación por red y datos repartidos, todo ello bajo un presupuesto de cero, un solo entorno y tres personas sin experiencia previa en despliegue. Sería un costo alto pagado por un beneficio inexistente a esta escala.

**Se descarta también la arquitectura hexagonal completa**, con un modelo de dominio independiente del framework, casos de uso como clases propias e interfaces para cada dependencia. Su beneficio es poder sustituir framework o base de datos sin tocar el dominio; su costo es duplicar las clases de cada concepto y convertir entre modelos en cada frontera. Los ADR-004 y 005 fijaron PostgreSQL y Spring para los cinco sprints, de modo que se pagaría una estructura por una sustitución que no va a ocurrir. De ese estilo se adopta lo que sí rinde aquí: la dirección de dependencias y la frontera de la API, ambas en el apartado 4, y un adaptador donde existe una dependencia externa reemplazable, que es el almacenamiento de archivos.

### 2. El backend se organiza por funcionalidad, con capas dentro de cada módulo

Una carpeta por área del producto. Dentro, las clases de todas las capas, distinguidas por el sufijo de su nombre.

```
backend/src/main/java/.../nodoaula/
├── catalog/              recursos del catálogo, apuntes y búsqueda
│   ├── ResourceController.java
│   ├── ResourceService.java       ← público: lo que otros módulos pueden usar
│   ├── ResourceRepository.java    ← no público
│   ├── Resource.java              ← entidad, no pública
│   └── ResourceDto.java
├── account/              registro, inicio de sesión, usuarios
├── forum/                mensajes del foro
├── studygroup/           grupos
└── shared/
    ├── security/         configuración de Spring Security
    ├── error/            manejador global de errores
    └── storage/          interfaz de almacenamiento y su implementación
```

**El módulo de una historia lo determina su feature en el tablero**, según esta correspondencia:

| Feature del tablero | Módulo |
|---|---|
| FE201 - Registro e inicio de sesión | `account` |
| FE301 - Modelo de recurso y carga manual | `catalog` |
| FE302 - Indexación semiautomática | `catalog` |
| FE303 - Apuntes como recurso | `catalog` |
| FE304 - Catálogo semilla | `catalog` |
| FE401 - Listado y filtrado, FE402 Búsqueda por texto y tema, FE403 Ficha de recurso | `catalog` |
| FE501 - Foro de preguntas y respuestas | `forum` |
| FE502 - Grupos de estudio | `studygroup` |
| FE101 - Stack y despliegue, FE102 Operación y mantenimiento | `shared` o configuración del proyecto |

Se usa la feature y no el área del tablero porque las áreas no coinciden con los módulos: las cuentas están en el área Plataforma, y el foro y los grupos comparten el área Colaboración.

La búsqueda no tiene módulo propio: es una operación sobre el catálogo y vive en `catalog`, aunque en el tablero sea una épica distinta.

**Los apuntes también viven en `catalog`.** El backlog los trata como un tipo de recurso: se clasifican por curso y tema y se encuentran junto a las video-clases. Un apunte es un recurso del catálogo con un archivo asociado, y el archivo se guarda a través de la interfaz de `shared/storage`. Se descarta un módulo propio de apuntes: necesitaría la entidad del catálogo y obligaría a romper la regla de que un módulo no accede a las clases internas de otro.

**Se descarta la organización por capas**, que habría puesto un paquete por capa con las clases de todo el producto dentro. Es la que aparece en la mayoría del material de Spring Boot, que muestra una sola entidad, y por eso resulta familiar. Se descarta por cuatro razones:

- **Cohesión.** Una historia casi nunca cambia todos los controladores; cambia todo lo de un área. Con módulos, el trabajo y el diff del Pull Request quedan en una carpeta.
- **Fronteras que el compilador protege.** Por capas, todas las clases deben ser públicas, porque cada capa vive en un paquete distinto, y las reglas del apartado 4 dependen solo de la revisión. Por módulos, el repositorio y la entidad de un área pueden no ser públicos, de modo que ningún otro módulo puede usarlos directamente.
- **La estructura comunica el sistema.** Quien abre el proyecto ve qué hace NodoAula, no qué framework usa.
- **Recortar alcance es más limpio.** Si una funcionalidad sale del alcance, es una carpeta y no archivos repartidos en cinco.

La condición 3 se respeta igualmente: dentro de cada módulo los nombres de capa son los de siempre, y el módulo de un archivo nuevo lo da la feature de su historia, de modo que nadie tiene que decidirlo.

### 3. El frontend se organiza con el mismo criterio

```
frontend/src/
├── app/                  router, layout y arranque
├── features/
│   ├── catalog/          páginas, componentes y llamadas a la API del catálogo
│   ├── account/
│   ├── forum/
│   └── studygroup/
├── components/ui/        componentes genéricos que no saben nada del producto
├── session/              estado del usuario conectado y ruta protegida
└── lib/apiClient.js      cliente único del backend: token CSRF y errores
```

Los módulos del frontend son los mismos del backend y se asignan con la misma tabla del apartado 2.

`lib/apiClient.js` es el módulo único por el que pasan todas las llamadas a la API, que el apartado 5 del ADR-006 exige; este ADR precisa dónde vive. Cada módulo de `features/` agrupa sus propias llamadas, y todas usan ese cliente.

**La única frontera que este ADR exige clasificar es la de `components/ui` frente a un componente de módulo**, y se decide con una sola pregunta: si el componente sabe algo de NodoAula. Un botón o un campo de texto no lo saben; la tarjeta de un recurso o el filtro por curso sí.

**Se descarta Atomic Design**, cuya frontera entre molécula y organismo es discutible en la mayoría de casos reales y trasladaría a cada revisión una discusión sobre categorías. Rinde con un sistema de diseño y muchas pantallas que lo reutilizan; a la escala de la condición 2, ordena menos de lo que cuesta.

### 4. Reglas de dependencia

Son las que evitan que la estructura se degrade, y las que se exigen en la revisión de cada Pull Request. Son la expresión concreta, en este stack, de la regla de dependencia y de los principios SOLID, DRY, KISS y YAGNI.

**El controlador no contiene lógica del producto.** Recibe la petición, delega en el servicio y devuelve el resultado. Es la única capa que sabe que existe la web.

**La entidad no sale nunca por la API.** Lo que se devuelve es un DTO, declarado como `record`. Si se devolviera la entidad, cualquier cambio en la base de datos alteraría la forma de la API sin que nadie lo decidiera, y quedarían expuestos campos que no deben salir, empezando por el hash de contraseña del ADR-007.

**El repositorio se llama solo desde el servicio de su propio módulo.** Saltarse la capa intermedia es el atajo que más rápido vacía de sentido a la estructura, porque cuando aparece lógica deja de haber un sitio evidente donde ponerla.

**Un módulo no accede a las clases internas de otro.** Si `studygroup` necesita datos de un usuario, llama al servicio de `account`, nunca a su repositorio ni a su entidad. Solo el servicio y los DTO de un módulo son públicos.

**Entre módulos, las entidades se relacionan por identificador.** Un recurso guarda el identificador de su autor, no una referencia a la entidad de usuario de `account`. Así ninguna entidad necesita ser pública, y la regla anterior la protege el compilador y no solo la revisión. Cuando un módulo necesita datos de otro, como el nombre de quien aportó un recurso, los pide al servicio de ese módulo. Dentro de un mismo módulo, las entidades sí se relacionan entre sí con normalidad.

**Las dependencias externas reemplazables se usan detrás de una interfaz propia.** El caso del proyecto es el almacenamiento de archivos: los módulos dependen de una interfaz declarada en `shared/storage`, y la implementación para Supabase es la única clase que conoce al proveedor. Es coherente con el criterio de portabilidad del ADR-005.

**En el frontend, las llamadas al backend no viven dentro de los componentes.** Cada módulo agrupa las suyas, y todas pasan por el cliente único de `lib/apiClient.js`, que es donde viven el token CSRF del ADR-007 y el tratamiento de errores.

**Qué protege el compilador y qué protege la revisión.** El compilador impide que un módulo use el repositorio o las entidades de otro, porque no son públicos. Las demás reglas ocurren dentro de un mismo paquete, donde el compilador no distingue capas: que el controlador no contenga lógica, que la entidad no salga por la API y que el repositorio solo se llame desde su servicio. Esas las verifica la revisión.

**Se descarta verificar las fronteras con Spring Modulith.** Su verificación considera internas las clases de los subpaquetes de cada módulo, lo que obliga a mover repositorios y entidades a una subcarpeta y, en Java, a hacerlos públicos para que el servicio los alcance: se cambiaría la protección del compilador por una prueba adicional y una dependencia nueva en el sprint de menor margen. Con clases no públicas y entidades relacionadas por identificador, el compilador ya cubre la regla entre módulos. Si la visibilidad no pública resulta inviable, esta alternativa se reevalúa.

### 5. Dónde vive cada responsabilidad

Los ADR anteriores crearon responsabilidades que la estructura por sí sola no ubica:

- **Validación del formato de la entrada**, como campos obligatorios, longitudes o formato del correo: en el DTO, con Bean Validation, activada desde el controlador.
- **Reglas del producto**, incluida la regla de autoría del ADR-007 y la comprobación de un correo ya registrado: en el servicio.
- **Transacciones y conversión de entidad a DTO**: en el servicio, dentro de la misma transacción. La aplicación se configura sin `open-in-view`, de modo que la conexión no queda retenida durante toda la petición; el ADR-005 declaró limitado el número de conexiones del pooler.
- **Traducción de errores a respuestas**: en un manejador global de `shared/error`, con un formato único basado en `ProblemDetail`. Los rechazos que produce Spring Security antes de llegar a un controlador, como la falta de sesión o de token CSRF, no pasan por ese manejador: se configuran en `shared/security` para responder con el mismo formato. El frontend interpreta todos los errores en un solo lugar, lo que permite distinguir un rechazo por CSRF de uno por permisos.

### 6. El código se escribe en inglés

Clases, métodos, variables, tablas y columnas se nombran en inglés. Los textos que ve el usuario y la documentación del proyecto van en español. Spring, JPA y React están en inglés, de modo que nombrar en español produciría mezclas como `findByTitulo` junto a `getRecursos`, además de tildes y eñes en identificadores.

### 7. Lo que este ADR no regula

Los nombres concretos de archivos, el formato del código y los demás criterios de revisión no son materia de ADR. Siguen el mismo criterio que el ADR-001 aplicó a las convenciones de rama y de commit: viven fuera del expediente de decisiones.

## Consecuencias

**Positivas**

- Un archivo nuevo tiene un sitio evidente en cualquiera de los dos proyectos: el módulo que corresponde a la feature de su historia y el sufijo de su capa.
- El compilador impide que un módulo use el repositorio o las entidades de otro, porque no son públicos, de modo que la frontera entre áreas no depende solo de la revisión.
- Las reglas del apartado 4 dan a la revisión un criterio objetivo, que bajo la condición 1 es la verificación principal que el proyecto tiene.
- Los dos proyectos se organizan con el mismo criterio y los mismos módulos, de modo que cambiar de uno a otro no exige cambiar de forma de pensar.
- La estructura comunica el dominio, lo que facilita explicar el sistema en la sustentación.
- Retirar o aplazar una funcionalidad afecta a una carpeta y no a cinco.

**Negativas**

- **Hay casos ambiguos que la tabla no resuelve.** Una historia que toca dos módulos, o una clase que podría ir en `shared`, se discute en la revisión.
- **`shared/` puede convertirse en un cajón de sastre.** Todo lo que no encuentra módulo termina ahí si nadie lo vigila.
- **Los datos de otro módulo se piden a su servicio.** Al relacionar entidades por identificador, mostrar datos de otra área, como el autor de un recurso, exige una llamada al servicio de ese módulo en lugar de una relación que JPA resuelve sola, y una consulta que cruza áreas se escribe en dos pasos.
- **La protección del compilador depende de que las clases no públicas funcionen con el framework.** Spring Data y Hibernate deben aceptar repositorios y entidades no públicos; se verifica en la primera historia que crea un módulo, y si no fuera viable, esas clases se hacen públicas y la regla entre módulos queda a cargo de la revisión.
- **Dentro de un módulo, las reglas dependen de la revisión.** El compilador no distingue capas dentro de un mismo paquete.
- **La organización es menos parecida a los ejemplos de Spring Boot**, que muestran la organización por capas; al copiar un ejemplo hay que ubicarlo en su módulo.
- **Separar entidad y DTO añade trabajo en cada historia**, porque obliga a mantener dos representaciones del mismo dato y a convertir entre ellas.
- **La frontera entre componentes genéricos y de módulo admite casos discutibles**, aunque sea una sola y no cinco.
- **Los archivos compartidos siguen siendo puntos de conflicto.** La configuración de seguridad, el router del frontend, `pom.xml` y `package.json` los tocan varias ramas a la vez, con cualquier organización.

**Compromisos asumidos**

- Un Pull Request que incumpla cualquiera de las reglas del apartado 4 no se aprueba. La plantilla de Pull Request las lista; su creación se incorpora como tarea de la historia Verificación de migraciones en la integración.
- El módulo de una historia lo determina su feature según la tabla del apartado 2. Los casos ambiguos se resuelven en la revisión y no crean módulos nuevos sin acuerdo del equipo; si se crea una feature nueva, se añade a la tabla.
- El glosario de términos del dominio en inglés se escribe en el README del repositorio antes de la primera migración de la historia Modelo de recurso según el esquema de metadatos, porque esa migración fija los primeros nombres de tablas y columnas, y renombrarlos después cuesta otra migración. Su redacción se incorpora como tarea de esa historia.
- En la historia Modelo de recurso según el esquema de metadatos se verifica que el repositorio y la entidad funcionan sin ser públicos.
- Si `shared/` crece más allá de configuración, errores y almacenamiento, se registra como deuda técnica en el tablero y se evalúa en retrospectiva, no se reorganiza a mitad de sprint.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-002 — Repositorio de código en GitHub.
- ADR-003 — Gestión de proyecto en Azure Boards.
- ADR-005 — Backend, acceso a datos y gestión del esquema.
- ADR-006 — Frontend: tecnología, ubicación en el repositorio y unidad de despliegue.
- ADR-007 — Autenticación: mecanismo, sostenimiento de la sesión y alcance del acceso.
