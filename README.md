# nodoaula
Plataforma web para la gestión colaborativa de recursos de estudio y apoyo académico

## Glosario del dominio

El código, las tablas y las columnas se nombran en inglés, conforme al ADR-008. Los campos de un recurso siguen el esquema de metadatos del proyecto, basado en Dublin Core. Si aparece un término nuevo, se agrega aquí antes de escribir la clase.

| Español | Inglés | Tabla |
|---|---|---|
| Recurso del catálogo | `Resource` | `resources` |
| Tipo de recurso | `ResourceType` (`VIDEO`, `DOCUMENT`) | columna `resource_type` |
| Curso (asignatura) | `Course` | `courses` |
| Tema | `Topic` | `topics` |
| Mensaje del foro | `ForumPost` | `forum_posts` |
| Grupo de estudio | `StudyGroup` | `study_groups` |
| Usuario | `User` | `users` |

Un apunte es un `Resource` de tipo `DOCUMENT`.

## Decisiones de arquitectura

Las decisiones de arquitectura están registradas en `docs/adr/`, del ADR-001 al ADR-008. Cada una explica qué se decidió, qué alternativas se descartaron y qué consecuencias se aceptaron.

## Entorno de desarrollo local

Cada integrante trabaja contra su propia base de datos y nunca contra la desplegada (ADR-005).

```bash
sudo docker compose up -d              # PostgreSQL 17 en 127.0.0.1:5432
cd backend  && ./mvnw spring-boot:run  # backend en :8080
cd frontend && npm run dev             # interfaz en :5173
```

El servidor de desarrollo de Vite reenvía `/api` al backend local, igual que hace en producción la regla de reescritura del sitio estático. Por eso el código llama a la API con rutas relativas y nunca contiene la dirección del backend (ADR-006 §5).

## Migraciones de base de datos

Las migraciones viven en `backend/src/main/resources/db/migration/`, que es donde Flyway las busca. Ninguna tabla del entorno desplegado se crea ni se modifica desde el panel de Supabase.

### Convención de nombres

```
V<AAAAMMDDhhmm>__<descripcion_en_ingles>.sql
```

Ejemplo: `V202609181430__create_resource_table.sql`

| Parte | Regla |
|---|---|
| `V` | Prefijo de migración versionada |
| `AAAAMMDDhhmm` | Fecha y hora de creación **en UTC**, doce dígitos seguidos, sin separadores |
| `__` | Doble guion bajo, separa la versión de la descripción |
| descripción | En inglés y en `snake_case`, igual que las tablas y las columnas |

Para obtener la versión:

```bash
date -u +V%Y%m%d%H%M
```

**Sin separadores dentro de la versión.** Flyway convierte en puntos los guiones bajos que encuentra en ella: `V2026_09_18__crear.sql` se interpreta como la versión `2026.9.18` y no como una fecha. Los doce dígitos seguidos se comparan como un único número.

### Lo que impide arrancar la aplicación

| Si… | Qué ocurre |
|---|---|
| Una migración nueva tiene una versión **menor** que la última aplicada | Flyway la rechaza. Se renombra con la fecha y hora actuales, válido mientras no se haya aplicado en el entorno desplegado |
| Se **modifica** una migración ya aplicada | Flyway detecta el cambio y la rechaza. Toda corrección entra como una migración nueva |
| Dos migraciones comparten **versión** | `Found more than one migration with version…` |

Si la base local queda en un estado que no arranca, se borra el contenedor y el esquema se reconstruye desde cero:

```bash
sudo docker compose down -v && sudo docker compose up -d
```

## Despliegue

Lo dispara la integración en `develop`: cada fusión despliega automáticamente, sin intervención manual (ADR-004). `main` conserva las versiones etiquetadas y no alimenta ningún despliegue.

**URL del producto:** https://nodoaula.onrender.com

| Servicio | Proveedor | Qué es |
|---|---|---|
| `nodoaula` | Render | Static Site. Raíz `frontend`, construcción `npm ci && npm run build`, publica `dist` |
| `nodoaula-backend` | Render | Web Service construido desde el Dockerfile de `backend`. Health check en `/actuator/health/liveness` |
| `nodoaula` | Supabase | PostgreSQL 17, accedido por el pooler en modo sesión, puerto 5432 |

Cada servicio se reconstruye solo cuando cambian los archivos de su carpeta.

Un workflow programado consulta la base una vez al día para que Supabase no pause el proyecto por inactividad; si falla, abre una incidencia en el repositorio.

### Variables de entorno

Solo las necesita el backend y se declaran en Render, nunca en el repositorio (ADR-002, ADR-004). Cuáles hacen falta y qué forma tienen está en [`.env.example`](.env.example). El sitio estático no necesita ninguna: la dirección del backend vive en su regla de reescritura.

### Reglas de reescritura del sitio estático

En este orden, y ambas de tipo *Rewrite*, no *Redirect*:

| Origen | Destino |
|---|---|
| `/api/*` | la dirección pública del backend, conservando la ruta |
| `/*` | `/index.html` |

La primera mantiene la API bajo el mismo origen que la interfaz, de modo que la cookie de sesión es de primera parte (ADR-006 §4). La segunda deja que React Router resuelva en el cliente cualquier ruta distinta de la raíz.

## Mediciones del despliegue

Tomadas el 19 de septiembre de 2026.

| | Render |
|---|---|
| Construcción del backend | 1 min 38 s – 1 min 59 s |
| Construcción del frontend | 116 ms (despliegue completo, 10,4 s) |
| Arranque en frío, directo al backend | 114,8 s |
| Arranque en frío a través de la reescritura | 102,9 s, con respuesta 200 |

El plan gratuito suspende el Web Service tras quince minutos sin tráfico y la primera visita posterior paga ese arranque; el Static Site no se suspende. La reescritura no expira mientras el backend arranca.

### Consumo del cupo de construcción

El plan gratuito incluye **500 minutos de construcción al mes**, compartidos por los dos servicios. Cada despliegue del backend cuesta unos 2 minutos; el del frontend es despreciable.

| Ritmo de integración | Consumo mensual estimado |
|---|---|
| 1 despliegue al día | ~60 min |
| 5 despliegues al día en días hábiles | ~200 min |

En los seis primeros días del Sprint 1 se consumieron unos 5 minutos. El cupo no restringe el ritmo de trabajo previsto.
