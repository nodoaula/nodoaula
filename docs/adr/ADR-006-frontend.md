# ADR-006 — Frontend: tecnología, ubicación en el repositorio y unidad de despliegue

- **Fecha:** 2026-09-13
- **Estado:** Aceptado

## Contexto

El Sprint 1 empieza el 14 de septiembre y esta es la tercera de las decisiones de arquitectura que lo bloquean. Este ADR decide que el navegador ve la aplicación como un solo sitio. El mecanismo de sesión del usuario se decide en el ADR-007, sobre esa base.

Cuatro condiciones acotan la elección:

1. **El ADR-005 separó frontend y backend.** El backend expone una API REST y no renderiza vistas; la interfaz es un proyecto aparte que la consume. Este ADR no reabre esa separación: decide con qué se construye la interfaz, dónde vive y cómo se publica.
2. **El ADR-004 fijó Render como proveedor**, con un solo entorno servido desde `develop` y despliegue automático en cada integración. Lo que se decida aquí tiene que caber en ese entorno sin reabrir aquella decisión.
3. **El ADR-002 protege un único repositorio**, `nodoaula/nodoaula`, con Pull Request obligatorio y una aprobación sobre ambas ramas primarias. Bajo Gitflow, una historia se integra en un solo Pull Request.
4. **El Sprint 1 tiene diez días y no hay velocidad histórica.** Cinco de sus ocho historias tienen interfaz: US-03, US-04, US-06, US-08 y US-09.

## Decisión

### 1. React con JavaScript

La interfaz se construye con **React** en **JavaScript** y empaquetada con **Vite**.

Se elige React porque tiene el mayor volumen de documentación, componentes de terceros y ejemplos disponibles, lo que importa especialmente cuando la experiencia es limitada: ante un problema concreto, es más probable encontrar una solución documentada.

Se descartan **Vue**, **Angular** y **Svelte**. Ninguno por una carencia técnica: los tres resuelven el mismo problema de construir una interfaz por componentes con enrutamiento en el cliente.

- **Angular** impone una estructura y un conjunto de conceptos propios, como inyección de dependencias, módulos y RxJS, que suponen más aprendizaje del que el proyecto necesita.
- **Svelte** tiene una comunidad y una oferta de componentes de terceros menores, lo que eleva el riesgo de quedar sin una solución documentada ante un problema concreto.
- **Vue** es la alternativa más próxima a React en curva de aprendizaje y en tamaño de ecosistema, pero no ofrece una ventaja que compense apartarse de React.

Se descarta **TypeScript**. Detectaría antes los errores de tipos y haría explícito en el código el contrato con la API, pero sumaría una segunda curva de aprendizaje a la de React en el sprint de menor margen. El costo de esta elección se declara en las consecuencias.

### 2. Enrutamiento y estilos

**React Router** administra las diferentes rutas de la aplicación React y permite cambiar entre sus pantallas sin recargar todo el documento HTML en cada navegación, siguiendo el modelo de una aplicación de una sola página (SPA). La aplicación tiene varias pantallas o vistas, pero el navegador carga inicialmente el documento de la aplicación y, después, React actualiza la interfaz según la ruta actual. React Router se encarga de asociar cada URL con la vista correspondiente. Se usa en su modo declarativo, como biblioteca de enrutamiento en el cliente, y no en su modo framework, orientado al renderizado en servidor.

Los estilos se escriben con **Tailwind CSS**, estandarizando la construcción visual mediante clases utilitarias aplicadas directamente en los componentes. Este enfoque reduce la necesidad de mantener archivos de estilos y convenciones de nombres de clases separadas, y proporciona una escala común de diseño en cuanto a espaciado, tipografía y colores, lo que facilita mantener la consistencia visual entre pantallas construidas por personas distintas.

Se descartan **CSS tradicional** y **CSS Modules** porque requieren mantener hojas de estilo separadas y, en el caso del CSS tradicional, gestionar además convenciones de nombres para evitar conflictos. También se descartan bibliotecas de componentes con estilos propios, como **Bootstrap** o **MUI**, que introducen sus propias APIs y convenciones de diseño, que competirían con Tailwind. Este descarte no alcanza a las bibliotecas sin estilos (*headless*), que aportan comportamiento y accesibilidad sin imponer apariencia; su adopción puede decidirse al construir el primer componente interactivo.

### 3. Un solo repositorio, dos proyectos

El frontend vive en su propia carpeta dentro de `nodoaula/nodoaula`, junto a la del backend. No se crea un segundo repositorio.

Se descarta separarlos. Bajo el ADR-002 obligaría a crear y proteger un repositorio nuevo, y bajo el ADR-001 a mantener dos historiales con sus propias ramas de release y sus propios tags por sprint. Además, historias como US-03 o US-06 tocan las dos partes, de modo que su integración exigiría dos Pull Requests coordinados para un solo elemento del tablero. Con una única raíz, lo establecido en los ADR-001 y 002 sigue funcionando sin modificación.

Esta decisión amplía el workflow de verificación del ADR-005. Además de arrancar el backend, el workflow instala las dependencias del frontend y lo compila. Se ejecuta completo en todos los Pull Requests hacia `develop`, toquen una carpeta o ambas, porque un check obligatorio que se omite por un filtro de rutas queda pendiente y bloquea la integración. Con un solo entorno, un frontend que no compila impediría el despliegue del Static Site y, bajo la Definition of Done, el cierre de cualquier historia.

### 4. Dos unidades de despliegue, un solo sitio para el navegador

El backend se publica como **Web Service**, según el ADR-005, y el frontend como **Static Site**: los archivos que genera Vite al construir el proyecto se sirven directamente, sin un proceso de aplicación que deba ejecutarlos. Ambas unidades se despliegan automáticamente desde `develop`, conforme al ADR-004, y cada una se construye solo cuando cambian los archivos de su carpeta.

El navegador se comunica únicamente con la dirección pública del frontend. El Static Site declara dos reglas de reescritura, en este orden:

1. `/api/*` se reescribe hacia la dirección pública del backend. Render procesa la petición mediante el Web Service, pero el navegador mantiene la dirección del frontend y no es redirigido al dominio del backend.
2. `/*` se reescribe hacia `/index.html`, para que React Router resuelva en el cliente cualquier ruta de la interfaz. Sin esta regla, refrescar la página o entrar directamente a una ruta distinta de la raíz devolvería un error 404, porque el servidor estático buscaría un archivo con ese nombre.

Se usa **reescritura** y no redirección porque la reescritura resuelve la petición hacia el destino sin cambiar la dirección que ve el navegador. Así, las peticiones a la API permanecen bajo el mismo origen que la interfaz; una redirección enviaría al navegador a la dirección del backend y volvería a separar los orígenes.

Se descarta que el frontend llame directamente a la dirección pública del backend, por dos razones. La primera es que frontend y backend serían orígenes distintos, y habría que configurar CORS y el envío de credenciales entre orígenes. La segunda, de más peso, es que `onrender.com` figura en la Public Suffix List, de modo que dos servicios bajo ese dominio son sitios distintos para el navegador: la cookie de sesión se convertiría en una cookie de terceros, que los navegadores restringen cada vez más. Un dominio propio lo evitaría, pero tiene costo. La reescritura mantiene la sesión como cookie del propio sitio con presupuesto cero.

El **Static Site** no se suspende por inactividad, como sí ocurre con el Web Service según el ADR-004: al servir archivos estáticos, no depende de un proceso que deba reactivarse, y no añade un segundo tiempo de espera de arranque.

**Esto no reabre el ADR-004.** Sigue habiendo un solo entorno, servido desde una sola rama, con despliegue automático en cada integración y bajo el mismo presupuesto de cero. Lo que cambia es que ese entorno está compuesto por dos unidades de despliegue en lugar de una, y esta decisión se registra aquí.

**Si la reescritura no cumple.** El proveedor documenta que el destino de una reescritura puede ser una URL externa, pero no su comportamiento como proxy: métodos, cuerpos, cookies, cabeceras y tiempo de espera ante un backend suspendido. Ese comportamiento se verifica en US-02 antes de construir funcionalidad sobre él. Si no cumple, el frontend llama directamente al backend, este configura CORS y la dirección del backend pasa a una variable de construcción de Vite. Como todas las llamadas a la API pasan por el módulo único de la sección 5, el cambio no toca los componentes. Lo que ocurre con la sesión en ese escenario lo declara el ADR-007.

### 5. La dirección del backend es configuración, no código

El código del frontend llama a la API mediante rutas relativas, como `/api/resources`, y nunca contiene la dirección del backend. Esa dirección vive únicamente en la regla de reescritura declarada en el proveedor. Es el mismo criterio que el ADR-004 aplicó a los secretos y el ADR-005 a la cadena de conexión: lo que depende de dónde se ejecuta la aplicación se declara en el proveedor, de modo que un cambio de dirección o de proveedor no modifica el código. En desarrollo local, el servidor de Vite reenvía `/api` al backend local de la misma forma.

Todas las llamadas a la API se hacen desde un único módulo del frontend; ningún componente llama a la API directamente. Así, la forma de llegar al backend, el envío del token CSRF que exige el ADR-007 y el tratamiento de errores se resuelven en un solo lugar.

## Consecuencias

**Positivas**

- El frontend se publica como contenido estático, la forma más barata y estable de servirlo bajo la capa gratuita, y no se suspende por inactividad.
- Al ver un solo sitio, el navegador no requiere permisos de peticiones entre orígenes, y la sesión del usuario no queda sujeta a las restricciones de credenciales de terceros.
- Una historia que toca frontend y backend se integra en un solo Pull Request.
- Un cambio en la dirección del backend se resuelve modificando una regla en el proveedor, sin reconstruir el frontend.
- El Static Site no consume horas de instancia, de modo que el cupo mensual de horas del plan gratuito queda íntegro para el Web Service.

**Negativas**

- **Cada historia con interfaz toca dos proyectos**, de modo que sus Pull Requests son mayores y su revisión más lenta, en un equipo donde la revisión ya es el cuello de botella previsto por los límites de trabajo en curso del tablero del ADR-003. US-02 debe dejar desplegadas dos unidades en lugar de una.
- **Hay dos despliegues que pueden fallar o terminar por separado.** Una integración puede dejar el backend publicado y el frontend no, o al revés; y aun cuando ambos se despliegan bien, el Static Site termina en segundos y el backend en minutos. Los cambios aditivos en la API, como un endpoint o un campo nuevo, se integran junto con la pantalla que los usa en un solo Pull Request, y se acepta que esa pantalla falle durante los minutos que tarda el backend en desplegarse. Los cambios que rompen el contrato, como eliminar o renombrar un campo o un endpoint que el frontend desplegado ya usa, se hacen en dos integraciones: primero se agrega lo nuevo y el frontend pasa a usarlo; después se elimina lo anterior. Durante el piloto del Sprint 5 esa ventana de minutos deja de ser aceptable y se revisa junto con la estrategia de despliegue.
- **Las peticiones a la API dependen del arranque del backend.** Tras la suspensión del Web Service, la primera petición que atraviesa la reescritura espera a que el backend arranque. Si la verificación de US-02 muestra que la reescritura no tolera esa espera, se aplica lo previsto al final de la sección 4; en cualquier caso, el módulo único de la sección 5 es el lugar donde el frontend trata esa espera.
- **Las dos unidades comparten los cupos del plan gratuito.** El Static Site también consume minutos de construcción y ancho de banda de salida, que el ADR-004 dimensionó pensando en el backend. Si cada unidad no se limita a construirse cuando cambia su carpeta, cada integración reconstruye ambas.
- **Sin tipos, los desajustes con la API aparecen al ejecutar.** Un nombre de campo mal escrito o un cambio en la forma de una respuesta no se detecta al escribir el código, sino al usar la pantalla. Solo lo previenen la revisión del Pull Request y la verificación en la URL pública.
- **Las reglas de reescritura son configuración del proveedor.** Se suman a la configuración que el ADR-004 ya declaró ligada a Render y habría que rehacerlas al mudarse.
- **Los componentes interactivos requieren trabajo propio.** Sin una biblioteca de componentes con estilos, cada modal, menú desplegable o grupo de pestañas se escribe con Tailwind. Una biblioteca headless puede aportar su comportamiento y accesibilidad; mientras no se adopte, ese trabajo también recae en las historias con interfaz.

**Compromisos asumidos**

- Los criterios de aceptación de US-02 se amplían: el Static Site se despliega automáticamente al integrar en `develop`; cada unidad se construye solo cuando cambian los archivos de su carpeta; las reglas de reescritura de `/api/*` y `/*` están declaradas en ese orden; las rutas del backend se exponen bajo `/api`; el servidor de desarrollo de Vite reenvía `/api` al backend local; el workflow del Pull Request compila el frontend; y se verifica, a través de la reescritura, el comportamiento de una petición con el backend suspendido, la propagación de cookies en ambos sentidos, el paso de todos los métodos HTTP y las cabeceras que recibe el backend.
- Los criterios de aceptación de US-06, US-08 y US-09 se revisan para reflejar que la interfaz consume la API y no páginas del servidor. El comportamiento exigido no cambia.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-002 — Repositorio de código en GitHub.
- ADR-003 — Gestión de proyecto en Azure Boards.
- ADR-004 — Proveedor de hospedaje y estrategia de despliegue.
- ADR-005 — Backend, acceso a datos y gestión del esquema.
- ADR-007 — Autenticación.
