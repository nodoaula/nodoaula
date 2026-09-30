# nodoaula
Plataforma web para la gestión colaborativa de recursos de estudio y apoyo académico

## Entorno de desarrollo local

Cada integrante trabaja contra su propia base de datos, nunca contra la desplegada.

```bash
sudo docker compose up -d              # PostgreSQL 17 en 127.0.0.1:5432
cd backend  && ./mvnw spring-boot:run  # backend en :8080
cd frontend && npm run dev             # interfaz en :5173
```

El servidor de desarrollo de Vite reenvía `/api` al backend local, así que el código llama a la API con rutas relativas y nunca contiene la dirección del backend.

Si la base local queda en un estado que no arranca:

```bash
sudo docker compose down -v && sudo docker compose up -d
```

## Migraciones

Van en `backend/src/main/resources/db/migration/` y se nombran así:

```
V<AAAAMMDDhhmm>__<descripcion_en_ingles>.sql
```

Ejemplo: `V202609181430__create_resource_table.sql`. La versión son doce dígitos seguidos en UTC, sin separadores, y se obtiene con:

```bash
date -u +V%Y%m%d%H%M
```

Una migración ya integrada no se renombra ni se modifica: toda corrección entra como una migración nueva.

## Despliegue

Lo dispara la integración en `develop`. `main` conserva las versiones etiquetadas y no alimenta ningún despliegue.

**URL del producto:** https://nodoaula.onrender.com

| Servicio | Proveedor | Qué es |
|---|---|---|
| `nodoaula` | Render | Static Site. Raíz `frontend`, construcción `npm ci && npm run build`, publica `dist` |
| `nodoaula-backend` | Render | Web Service desde el Dockerfile de `backend`. Health check en `/actuator/health/liveness` |
| `nodoaula` | Supabase | PostgreSQL 17, por el pooler en modo sesión, puerto 5432 |

Las variables de entorno solo las necesita el backend y se declaran en Render; cuáles hacen falta está en [`.env.example`](.env.example).

Reglas de reescritura del Static Site, en este orden y ambas de tipo *Rewrite*:

| Origen | Destino |
|---|---|
| `/api/*` | la dirección pública del backend, conservando la ruta |
| `/*` | `/index.html` |

Un workflow programado consulta la base una vez al día para que Supabase no pause el proyecto; si falla, abre una incidencia en el repositorio.

## Decisiones de arquitectura

En `docs/adr/`, del ADR-001 al ADR-008.
