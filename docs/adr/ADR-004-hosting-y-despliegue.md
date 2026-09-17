# ADR-004 — Proveedor de hospedaje y estrategia de despliegue

- **Fecha:** 2026-09-11
- **Estado:** Aceptado

## Contexto

La Definition of Done exige que la funcionalidad esté desplegada y verificada en el entorno público. Ninguna historia del Sprint 1 puede cerrarse sin un entorno en línea, de modo que esta decisión bloquea el sprint.

Tres condiciones acotan la elección:

1. **Presupuesto operativo de $0.** El anteproyecto contempla $240.000 de hospedaje calculados como si el proyecto fuera real; la restricción efectiva es cero. 
2. **El entorno debe permanecer disponible 78 días**, del 14 de septiembre al 30 de noviembre, y seguir accesible el día de la sustentación.
3. **ADR-001 adopta Gitflow**, con `develop` como rama de integración y `main` reservada a las versiones publicadas.

## Decisión

### 1. Un solo entorno, desplegado desde `develop`

La URL pública sirve el último estado integrado en `develop`. El despliegue se dispara automáticamente con cada integración, sin intervención manual.

Se descarta desplegar desde `main`. Bajo Gitflow, `main` recibe la rama `release/` una sola vez por sprint, de modo que ninguna historia podría verificarse en línea hasta el último día y todas se cerrarían en bloque. El tablero dejaría de reflejar el avance real durante nueve de los diez días del sprint, que es exactamente la pérdida de transparencia que el ADR-003 evita al rechazar los verbos de cierre automático de GitHub.

**Esta decisión matiza una consecuencia declarada en el ADR-001**, según la cual `main` reflejaría en todo momento lo que está desplegado. Deja de ser cierto: `main` conserva el historial de versiones etiquetadas, pero no alimenta ningún despliegue. La decisión del ADR-001, que es el modelo de ramificación, no se altera.

### 2. Aplicación en Render

Render ejecuta la aplicación como un proceso de larga vida: arranca una vez y permanece corriendo mientras la instancia esté activa, atendiendo peticiones. Es lo que un backend web convencional necesita, porque permite mantener recursos en memoria, como un pool de conexiones a la base de datos, y reutilizarlos entre peticiones. 

Capa gratuita. Despliegue automático a partir del repositorio `nodoaula/nodoaula`, rama `develop`.

Se descarta **Vercel** por la cláusula de uso personal y no comercial de su plan gratuito, y por su modelo de ejecución orientado a funciones sin servidor. La plataforma puede reutilizar una instancia de una función mientras permanezca activa, pero no garantiza que su memoria o su proceso estén disponibles entre invocaciones. Además, las conexiones a la base de datos deben gestionarse teniendo en cuenta la naturaleza efímera y concurrente de las funciones: una conexión puede reutilizarse mientras una instancia permanezca activa, pero pueden existir múltiples instancias y nuevas conexiones cuando se creen nuevos entornos de ejecución, por lo que es necesario controlar adecuadamente el número de conexiones. Vercel es una buena opción para aplicaciones con un modelo serverless y con contenido estático; no con un backend que necesita un proceso web convencional de larga duración, con recursos de ejecución reutilizables mientras la instancia permanece activa.

### 3. Base de datos y almacenamiento de archivos en Supabase

Capa gratuita. Supabase proporciona dos servicios que el proyecto necesita con un solo proveedor: una base de datos PostgreSQL gestionada, donde se almacenan los datos de la aplicación como usuarios, recursos del catálogo, apuntes, mensajes del foro y grupos; y Storage, un servicio de almacenamiento de objetos para los archivos de los apuntes del Sprint 3. La base de datos es administrada por Supabase, por lo que el equipo no necesita instalar ni mantener un servidor PostgreSQL por su cuenta; Storage permite almacenar los archivos por separado de los datos estructurados y acceder a ellos desde la aplicación.

**Los límites de la capa gratuita no son restrictivos a la escala del proyecto.** Los 500 MB de base de datos se destinan a datos estructurados, principalmente texto y número. Para los archivos, la medición de los apuntes disponibles da un promedio cercano a 620 KB por documento, por lo que 1 GB permite almacenar alrededor de 1.600 apuntes. El plan limita cada archivo a 50 MB y no incluye copias de seguridad.

**Se descarta Neon**, que ofrece una solución PostgreSQL gestionada, especialmente adecuada para arquitecturas que requieren un modelo de cómputo bajo demanda, con suspensión y reanudación automática del cómputo cuando no está en uso. Esa ventaja no es relevante para este proyecto; la decisión prioriza reducir el número de servicios. Neon resuelve la base de datos pero no el almacenamiento de archivos, de modo que adoptarlo obliga a incorporar otro proveedor para los archivos en octubre y a mantener separados dos servicios para necesidades que Supabase cubre con uno. 

### 4. Tarea programada de mantenimiento de actividad

Los proyectos gratuitos de Supabase pueden pausarse cuando presentan actividad insuficiente durante un período de siete días, requiriendo restauración manual. Para evitarlo, se establece una tarea programada en GitHub Actions que solicita una vez al día una ruta de la aplicación que realiza una consulta a la base de datos. Así se genera actividad real sobre el proyecto y se reduce el riesgo de suspensión por inactividad. El workflow debe residir en `develop`, porque GitHub solo ejecuta flujos programados desde la rama por defecto.

**La tarea debe notificar sus fallos**, no solo ejecutarse. Si falla y nadie recibe una notificación, el equipo puede creer que el mantenimiento está funcionando cuando en realidad el proyecto sigue expuesto a la suspensión por inactividad.

Se implementa en el Sprint 1 como tarea de US-02, no más tarde. La tarea no busca mantener activa la instancia de Render.

### 5. El backend se despliega desde un contenedor

Render construye una imagen Docker a partir de un Dockerfile incluido en el repositorio y crea un contenedor a partir de esa imagen para ejecutar la aplicación como un servicio web. Es la vía de despliegue que no depende del lenguaje del backend. Render ofrece entornos de ejecución nativos solo para un conjunto de lenguajes, mientras que un contenedor admite cualquiera. Así, esta decisión no condiciona la elección del backend ni queda condicionada por ella.

Se descarta el despliegue sobre los entornos nativos del proveedor. Ataría la elección del backend a los lenguajes que Render soporta, u obligaría a reabrir esta decisión si el elegido no estuviera entre ellos.

### 6. Los secretos viven en el proveedor

Las cadenas de conexión, claves y cualquier configuración sensible que necesite la aplicación se declaran como variables de entorno en Render, donde se ejecuta el backend. El repositorio no contiene ninguna de estas credenciales, conforme al ADR-002. 

## Consecuencias

**Positivas**

- Cada historia puede verificarse en línea y cerrarse el mismo día en que se integra. El burndown y el diagrama de flujo acumulado reflejan el avance real, y esas gráficas son evidencia de seguimiento exigible en el informe final.
- Un fallo de despliegue aparece con una sola historia dentro y con días de margen, en lugar de aparecer el último día del sprint con todas las historias acumuladas.
- La elección de Render es barata de revertir: el backend se define en un Dockerfile que funciona en cualquier proveedor que acepte contenedores y el código no depende del proveedor, de modo que un ADR posterior puede sustituirla con costo bajo. No ocurre lo mismo con Supabase, como se declara en las consecuencias negativas.

**Negativas**

- **El servicio gratuito de Render se suspende temporalmente tras quince minutos sin tráfico**, y la primera visita posterior puede experimentar un tiempo de espera de arranque adicional de alrededor de un minuto. Durante los sprints 1 a 4 el efecto es irrelevante, pero contaminaría el cronometraje del OE5 en el piloto. Se calienta la instancia manualmente antes de cada sesión; la medida se incorpora al guion de US-28.
- **Lo que está en la URL pública es trabajo en curso**, no una versión estabilizada. Se acepta porque hasta el Sprint 5 no hay usuarios ajenos al equipo. Para presentar el incremento se utiliza el tag correspondiente en `main`.
- **Las cuentas de ambos proveedores son personales.** Es una condición común a las capas gratuitas y no discrimina entre alternativas. No afecta al despliegue, que se dispara desde el repositorio, pero sí la administración según los permisos disponibles: determinadas acciones, como consultar registros de error de un despliegue fallido, modificar variables de entorno, reiniciar el servicio o restaurar un proyecto pausado, requieren la cuenta del dueño; en Render, además, un espacio de trabajo gratuito no admite miembros. La consecuencia práctica es que una incidencia que requiera permisos que solo tenga uno de los integrantes puede bloquear a los demás hasta que este la atienda. Bajo una Definition of Done que ata el cierre de cada historia al despliegue, esto puede detener el sprint.
- **Parte de la configuración de despliegue queda ligada al proveedor**. El Dockerfile del backend es portable, pero la configuración de cada servicio —variables de entorno y rama de despliegue— se declara en Render y habría que rehacerla al mudarse.
- **El Sprint 1 asume el trabajo de definir el entorno de ejecución en un Dockerfile**, en el sprint con menor margen del cronograma. Un error en esa definición impide desplegar sobre el único entorno.
- **Los despliegues dependen de un cupo mensual de construcción**. El plan gratuito incluye 500 minutos de construcción al mes, compartidos por todos los servicios del espacio de trabajo, y cada construcción de la imagen del backend los consume. Si se agotan, Render deja de construir hasta el mes siguiente; el servicio sigue activo con la última imagen, pero, bajo la Definition of Done, ninguna historia puede cerrarse.
- **El ancho de banda de salida también tiene cupo**. Si se agota sin método de pago registrado, Render suspende todos los servicios gratuitos hasta el mes siguiente.

**Compromisos asumidos**

- Los criterios de aceptación de US-02 se ajustan a esta decisión: el despliegue se dispara automáticamente al integrar en `develop`, el backend se construye desde un Dockerfile incluido en el repositorio, las variables de entorno y credenciales se declaran en el proveedor y no en el repositorio, y la tarea de mantenimiento de actividad, con notificación de fallos, se incorpora como trabajo de la historia. Tras el primer despliegue se mide la duración de la construcción y se proyecta el consumo mensual de minutos contra el cupo del plan gratuito. El ajuste está aplicado en el backlog.
- US-17 deja de investigar dónde se almacenan los archivos: esa pregunta la resuelve este ADR. La historia conserva la comprobación de que un archivo subido sobrevive a un nuevo despliegue, que es verificación empírica y no elección de proveedor, y se le añade la definición de formatos admitidos y tamaño máximo por archivo. El ajuste está aplicado en el backlog.
- La verificación empírica de esta decisión es US-02 misma. Si el primer despliegue revela que algún proveedor no cumple, el cambio de proveedor se hace dentro del Sprint 1, cuando todavía no hay funcionalidad construida encima y el costo se limita a rehacer la configuración de despliegue.

## Referencias

- ADR-001 — Gitflow.
- ADR-002 — Repositorio en GitHub.
- ADR-003 — Gestión en Azure Boards.
- ADR-005 — Backend y base de datos.
