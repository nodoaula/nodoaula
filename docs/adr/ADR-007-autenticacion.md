# ADR-007 — Autenticación: mecanismo, sostenimiento de la sesión y alcance del acceso

- **Fecha:** 2026-09-14
- **Estado:** Aceptado

## Contexto

El registro de decisiones aplazaba esta decisión hasta después del Sprint 1, con el supuesto de que la primera iteración usaría el mecanismo nativo del framework que resultara del ADR-005. El equipo optó por cerrarla ahora, junto con el backend y el frontend, para no construir US-03 y US-04 sobre un supuesto.

Seis condiciones acotan la elección:

1. **El ADR-005 fijó el backend en Spring Boot**, que incluye un módulo de seguridad propio, y los datos en PostgreSQL gobernado por migraciones de Flyway.
2. **El ADR-006 separó la interfaz en una aplicación de una sola página que consume la API**, y dispuso que el navegador vea frontend y backend como un solo sitio. La autenticación no se resuelve con formularios renderizados por el servidor, sino entre una interfaz en el navegador y una API; eso la convierte en una decisión de arquitectura y no en una tarea de configuración.
3. **El proceso del backend se reinicia con frecuencia.** Por el ADR-004, cada integración a `develop` dispara un despliegue, y la capa gratuita de Render suspende el servicio tras quince minutos sin tráfico. Todo lo que viva solo en la memoria del proceso se pierde en cada uno de esos eventos.
4. **US-03 y US-04 se construyen en el Sprint 1**, un sprint de diez días, sin velocidad histórica y con la capacidad ya comprometida por el resto de historias habilitadoras.
5. **El alcance del acceso está definido.** La consulta del catálogo es pública y no requiere cuenta; la cuenta se necesita para aportar. No hay rol de administrador: cualquier usuario registrado puede catalogar. El registro no restringe el dominio del correo.
6. **No hay pruebas automatizadas de funcionalidad**, conforme al ADR-005, de modo que un error en el mecanismo de sesión no se detecta solo. La verificación es humana y ocurre sobre el entorno desplegado.

## Decisión

### 1. La autenticación la resuelve Spring Security

Se usa **Spring Security**, el módulo de seguridad del framework elegido en el ADR-005, con su cadena de filtros para proteger las operaciones que exigen cuenta y dejar públicas las de consulta.

Se descarta construir el mecanismo a mano. Bajo la condición 6, una implementación propia de credenciales y sesiones sería la pieza del sistema con mayor consecuencia en caso de error y sin revisión automatizada que la respalde.

El inicio de sesión usa el filtro de login del propio framework, configurado para responder como una API: 200 al autenticarse y 401 ante credenciales inválidas, sin redirecciones. Una petición sin sesión a una operación protegida responde 401, y el cierre de sesión responde sin redirigir. El comportamiento por defecto del framework, que redirige hacia una página de login, no sirve aquí: por la regla de reescritura del ADR-006, esas redirecciones terminarían en la aplicación del frontend y el cliente recibiría HTML donde espera una respuesta de la API.

Se descarta un controlador de login propio. Omitiría protecciones que el filtro del framework aplica por defecto, como guardar el contexto de seguridad en la sesión y renovar el identificador de sesión al autenticarse, que protege contra la fijación de sesión.

### 2. La sesión se sostiene con una cookie, no con un token

Al iniciar sesión, el servidor establece la sesión de su lado y entrega al navegador un identificador dentro de una **cookie**, que el navegador reenvía por sí solo en cada petición. La cookie se marca **HttpOnly**, para que ningún script de la página pueda leerla; **Secure**, para que solo viaje sobre conexión cifrada; y **SameSite=Lax**, para que el navegador no la envíe en peticiones que modifican datos iniciadas desde otros sitios.

Como el navegador ve un solo sitio, por el ADR-006, la cookie pertenece al dominio del frontend y no requiere configuración para cruzar entre sitios.

**Se descartan los tokens firmados en el cliente**, la solución que suele acompañar a un frontend separado. Tres razones. El trabajo es mayor: obliga a decidir dónde se guarda el token, cuándo caduca y cómo se renueva, mientras que con la cookie el frontend solo gestiona el token de protección CSRF de la sección 4. El margen de error es mayor: el fallo característico es guardar el token donde cualquier script puede leerlo, y la marca HttpOnly elimina esa categoría de problema por construcción. Y su ventaja no aplica aquí: los tokens compensan cuando varios servicios, aplicaciones móviles o terceros consumen la API, y NodoAula tiene un solo frontend, del mismo equipo que el backend. Si en el futuro aparece otro cliente, el mecanismo se revisa en un ADR nuevo.

**Esta decisión depende de que la reescritura del ADR-006 propague las cookies**, lo que se verifica en el Sprint 1. Si no lo hace y el frontend tiene que llamar directamente al backend, frontend y backend pasan a ser sitios distintos, porque `onrender.com` figura en la Public Suffix List, y la cookie de sesión se trataría como cookie de terceros, que exige `SameSite=None` y que los navegadores restringen cada vez más. En ese escenario esta decisión se reabre en un ADR posterior, con dos alternativas: un token en cabecera, con el costo descrito en esta sección, o un dominio propio, que tiene costo económico.

### 3. Las sesiones se guardan en la base de datos

Las sesiones se almacenan en PostgreSQL mediante **Spring Session JDBC**, no en la memoria del proceso. Sus tablas se crean con una migración de Flyway, conforme al ADR-005, y se desactiva la creación automática del esquema que trae la librería.

Se descarta guardar las sesiones en memoria. Bajo la condición 3, cada despliegue y cada suspensión por inactividad cerrarían las sesiones de todos los usuarios conectados. Durante el piloto del Sprint 5 bastaría con quince minutos sin tráfico para desconectar a todos los participantes, algo que no se evita congelando las integraciones.

Una sesión expira tras **dos horas de inactividad**. Es suficiente para cubrir una sesión de trabajo o de clase sin pedir un nuevo inicio de sesión, y lo bastante corta para limitar el riesgo de dejar una sesión abierta en un equipo compartido. El cierre de sesión invalida la sesión en el servidor.

### 4. La protección CSRF permanece activa

Una cookie que el navegador envía por sí solo también viaja en peticiones que otro sitio podría provocar. Spring Security protege contra ese ataque exigiendo un token adicional en cada petición que modifica datos, y esa protección se mantiene activa, configurada para una aplicación de una sola página: el backend entrega el token y el frontend lo envía en un encabezado en cada petición que crea, modifica o elimina datos.

El inicio de sesión también es una petición que modifica datos y exige el token. Por eso el frontend obtiene el token al cargar la aplicación, antes de cualquier petición que modifique datos, incluido el primer intento de inicio de sesión. El token se renueva al iniciar y al cerrar sesión, de modo que el frontend lee el token vigente en cada petición en lugar de conservar el que obtuvo al cargar.

Se descarta desactivar la protección. La marca SameSite=Lax reduce el riesgo, pero no sustituye al token.

### 5. No se adopta la autenticación de Supabase

Supabase se usa como base de datos y como almacenamiento de archivos, y no como proveedor de identidad.

Adoptarla habría sumado las cuentas de usuario a la concentración de datos y archivos que el ADR-004 aceptó en un solo proveedor, y la habría vuelto prácticamente irreversible: las credenciales de usuario son lo más caro de migrar de un proveedor a otro. Con el mecanismo del propio framework, las cuentas y las sesiones viven en las mismas tablas que el resto del modelo y se rigen por las mismas migraciones.

### 6. Contraseñas

Ninguna contraseña se guarda en texto plano ni de forma reversible. Se almacena su hash, calculado con **bcrypt** mediante el codificador delegante de Spring Security, que identifica el algoritmo en el propio valor almacenado y permitiría cambiarlo más adelante sin invalidar las contraseñas existentes. Se exige una longitud mínima de ocho caracteres y una máxima de sesenta y cuatro: bcrypt solo procesa los primeros 72 bytes de la contraseña, y con tildes o eñes un carácter puede ocupar más de un byte.

Un usuario con sesión iniciada puede cambiar su contraseña confirmando la actual.

Los intentos fallidos de inicio de sesión se limitan antes del piloto mediante un **retraso creciente por correo intentado**, registrado en la base de datos. El retraso se aplica rechazando de inmediato los intentos, con una respuesta 429, hasta que vence la espera, y no reteniendo la petición: una petición retenida ocupa un hilo del servidor durante toda la espera, y en la instancia gratuita unas pocas bastarían para degradar el servicio a todos los usuarios. El registro se lleva por el correo intentado, exista o no una cuenta con él, para que la respuesta no revele qué correos tienen cuenta.

Se descarta bloquear la cuenta tras varios intentos, porque permitiría a cualquiera que conozca un correo dejar a ese usuario sin acceso. Se descarta limitar por dirección IP, porque detrás de la reescritura del ADR-006 y del proxy de Render depende de interpretar correctamente la dirección reenviada, y un error limitaría a todos los usuarios a la vez. Y se descartan los contadores en memoria, que se perderían con cada reinicio del proceso por la condición 3. Hasta que el límite se implemente, el riesgo se acepta, porque los únicos usuarios son el equipo.

La recuperación de contraseña por correo queda **pendiente de decidir antes del piloto**. Exigiría un proveedor de correo y, como la capa gratuita de Render bloquea el tráfico saliente hacia los puertos SMTP, el envío tendría que hacerse mediante la API web de un servicio externo. Incorporar ese proveedor tiene entidad propia: si se adopta, se registra en un ADR aparte.

### 7. Alcance del acceso y autorización

- El catálogo se lista y se consulta **sin cuenta**. La sesión hace falta únicamente para aportar.
- **No hay rol de administrador.** Cualquier usuario registrado puede catalogar recursos.
- **Un recurso del catálogo solo puede modificarlo o eliminarlo el usuario que lo creó.** Las reglas para el contenido de sprints posteriores se definen en sus historias.
- El registro **no restringe el dominio del correo** ni verifica que el correo pertenezca a quien lo registra.
- El mensaje de error de inicio de sesión no distingue entre correo inexistente y contraseña incorrecta. El registro sí indica cuando un correo ya está en uso, porque de otro modo el usuario no sabría por qué falla.

## Consecuencias

**Positivas**

- US-03 y US-04 se resuelven mayoritariamente con configuración del framework, incluido el inicio de sesión, que conserva las protecciones del filtro de login.
- La marca HttpOnly impide que un script de la página extraiga el identificador de sesión, la vía de robo de credenciales más común en interfaces separadas. No impide que un script malicioso haga peticiones en nombre del usuario mientras la página está abierta; esa vía se cierra evitando la inyección de scripts, no con la cookie.
- Las sesiones sobreviven a despliegues, reinicios y suspensiones por inactividad, de modo que ni el desarrollo ni el piloto dependen de que el proceso siga vivo.
- Las cuentas y las sesiones viven en el mismo modelo de datos que el resto del sistema y se versionan con las mismas migraciones; ninguna parte del estado existe solo en el panel de un proveedor.

**Negativas**

- **Cada petición con sesión consulta la base de datos.** Leer y actualizar la sesión añade una operación contra PostgreSQL, a través del pooler, en cada petición autenticada, y la librería elimina periódicamente las sesiones expiradas. A la escala del proyecto el costo es menor, pero existe.
- **La protección CSRF añade una condición al frontend.** Una petición que modifica datos sin el token es rechazada con un error 403, que puede confundirse con un problema de permisos. Es el fallo más probable de US-03 y US-04, empezando por el primer intento de inicio de sesión si el frontend no obtuvo el token al cargar.
- **La sesión depende de una verificación pendiente.** Si la reescritura del ADR-006 no propaga las cookies, el mecanismo de la sección 2 se reabre, con el costo de un ADR nuevo y de rehacer US-03 y US-04 dentro del Sprint 1.
- **El registro abierto, sin verificación de correo, permite crear cuentas falsas.** Como no hay administrador y solo el autor puede modificar o eliminar un recurso, el contenido indebido de una cuenta falsa solo puede retirarlo el equipo mediante una migración de datos, conforme al ADR-005. Esas migraciones contienen identificadores que solo existen en la base desplegada: en las bases locales y en la del workflow de verificación no tienen efecto, pero quedan en el historial de migraciones. Queda como materia del informe final.
- **Mientras la recuperación de contraseña esté pendiente, quien olvida su contraseña debe crear una cuenta nueva con otro correo**, porque el registro rechaza un correo ya en uso. No hay panel de administración, y restablecerla mediante una migración expondría en el repositorio el hash de una contraseña temporal. Los recursos de la cuenta anterior quedan sin posibilidad de edición, porque solo su autor puede modificarlos.
- **Hasta el Sprint 4 no se limitan los intentos fallidos de inicio de sesión.** Se acepta el riesgo de ataques de fuerza bruta mientras los únicos usuarios son el equipo; el costo de cálculo de bcrypt los ralentiza, pero no los impide.
- **El retraso por correo permite a un tercero demorar el acceso de un usuario** fallando a propósito con su correo. Es un efecto menor que el bloqueo de cuenta, que se descartó por esa razón, y se acepta.
- **El registro permite averiguar si un correo tiene cuenta.** Se acepta como riesgo menor frente a la claridad para el usuario.

**Compromisos asumidos**

- Los criterios de aceptación de US-03 y US-04 se amplían: el inicio de sesión usa el filtro del framework y responde 200 o 401 sin redirecciones; una operación protegida sin sesión responde 401; las tablas de sesión se crean mediante migración de Flyway; las sesiones expiran tras dos horas de inactividad; el cierre de sesión invalida la sesión en el servidor; el frontend obtiene el token CSRF al cargar, lee el token vigente en cada petición y lo envía en las que modifican datos, incluido el inicio de sesión; las contraseñas exigen entre ocho y sesenta y cuatro caracteres; y el error de inicio de sesión no distingue la causa. El trabajo adicional se refleja en su estimación.
- Como parte de US-04 se verifica en el entorno desplegado, no solo en local: que la cookie llega al navegador a través de la reescritura del ADR-006 con las marcas HttpOnly, Secure y SameSite=Lax; que el backend reconoce que opera detrás del proxy de Render, condición para emitir la cookie como Secure; y que una sesión abierta sigue activa tras un nuevo despliegue y tras una suspensión por inactividad. Si la cookie no llega a través de la reescritura, se aplica lo previsto al final de la sección 2 dentro del Sprint 1.
- Las historias que modifiquen o eliminen recursos del catálogo incorporan la regla de autoría como criterio de aceptación.
- El cambio de contraseña con sesión iniciada se incorpora como criterio de aceptación de la historia que el equipo designe, sin exigirlo en el Sprint 1.
- El retraso creciente ante intentos fallidos se incorpora al backlog como tarea técnica planificada para el Sprint 4, antes del piloto.
- Antes del piloto se decide si se incorpora la recuperación de contraseña por correo. Si se incorpora, el proveedor de correo se decide en un ADR propio; si no, la consecuencia declarada sobre las cuentas nuevas se mantiene durante el piloto.
- Ninguna credencial de usuario se almacena ni se transmite fuera de lo establecido aquí, y ninguna configuración con secretos entra al repositorio, conforme al ADR-002.
- La deuda técnica de autenticación registrada en el registro de decisiones queda cerrada por este ADR.

## Referencias

- ADR-002 — Repositorio de código en GitHub.
- ADR-004 — Proveedor de hospedaje y estrategia de despliegue.
- ADR-005 — Backend, acceso a datos y gestión del esquema.
- ADR-006 — Frontend: tecnología, ubicación en el repositorio y unidad de despliegue.
