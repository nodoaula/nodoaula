# ADR-002 — Repositorio de código en GitHub: organización, visibilidad y protección de ramas

- **Fecha:** 2026-09-09
- **Estado:** Aceptado

---

## Contexto

El proyecto necesita un repositorio remoto que aloje el código y los registros de decisión, accesible por los tres integrantes en condiciones iguales.

Cuatro restricciones acotan la decisión:

1. **Presupuesto de $0.** No se contrata ningún plan de pago.
2. **ADR-001 adopta Gitflow**, que depende de que nadie integre directamente en `main` ni en `develop`. Conviene que esa regla la haga cumplir la plataforma y no solo la disciplina del equipo.
3. **El proyecto debe sobrevivir a la cuenta de cualquier integrante.** Alojarlo en una cuenta personal lo ata a esa persona y a la vigencia de su correo institucional.
4. **La gestión del tablero ocurre en Azure Boards** (ADR-003), lo que exige integración entre ambas plataformas.

Sobre la plataforma, se consideraron Azure Repos —que unificaría código y tablero, pero implica trabajar sobre una herramienta menos difundida que la que el equipo encontrará fuera del curso— y GitLab, funcionalmente equivalente pero sin ventaja frente a la combinación elegida. La integración oficial entre GitHub y Azure Boards resuelve la fragmentación que motivaba a Azure Repos.

Sobre la visibilidad, la restricción 2 choca con la 1: en GitHub Free para organizaciones, las reglas de protección de ramas solo pueden aplicarse a repositorios públicos. Un repositorio privado dejaría Gitflow como acuerdo de honor, y los errores de integración ocurren bajo presión, que es cuando la disciplina falla.

## Decisión

- Plataforma: **GitHub**. El tablero permanece en Azure Boards, enlazado mediante la integración oficial.
- Titularidad: **organización** `nodoaula`, con los tres integrantes como *Owners*. La organización es una cuenta independiente cuya propiedad se comparte, lo que satisface la restricción 3.
- Visibilidad: **pública**. El proyecto es de naturaleza académica, no maneja datos personales ni información sujeta a reserva, de modo que la visibilidad no expone nada y habilita la protección de ramas sin costo.
- Ramas `main` y `develop` creadas desde el inicio, con `develop` como rama por defecto, de modo que clones y Pull Requests apunten a ella automáticamente.
- Protección sobre **ambas** ramas primarias: Pull Request obligatorio y una aprobación antes de integrar. Se protegen las dos porque bajo Gitflow la mayoría de los PR se dirigen a `develop`.
- Estructura documental mínima: `/docs/adr/` y `README.md`. Las guías de aprendizaje no residen en el repositorio.
- Ninguna credencial, clave de API ni archivo de configuración con secretos entra al repositorio. El `.gitignore` se configura antes del primer commit de código.

## Consecuencias

**Positivas**
- Gitflow deja de depender de la memoria del equipo: la plataforma rechaza cualquier push directo a las ramas primarias.
- La titularidad compartida elimina el riesgo de que el proyecto quede inaccesible por la pérdida de una cuenta.
- El código queda disponible para consulta de la tutora y de los pares académicos evaluadores sin gestión de permisos.

**Negativas**
- El código es visible para cualquiera desde el primer commit. El riesgo real no es el código sino la filtración accidental de credenciales, que en un repositorio público se vuelve inmediata.
- La visibilidad pública no es reversible en la práctica: volver a privado implicaría perder la protección de ramas.
- Los beneficios del plan educativo asociados a las cuentas personales de los integrantes no se extienden a la organización, que opera bajo plan gratuito.

## Referencias

- ADR-001 — Adopción de Gitflow como modelo de ramificación.
- ADR-003 — Gestión de proyecto en Azure Boards.
