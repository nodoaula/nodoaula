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
