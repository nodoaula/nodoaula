-- Catálogo semilla (AB#30 / AB#85): cinco video-clases reales de al menos
-- dos asignaturas distintas, cada una con curso y al menos un tema.
--
-- author_id = 0 es un valor fijo que representa "aportado por el equipo del
-- proyecto", mientras no existe el módulo account. Revisar esta migración
-- cuando ese módulo exista, por si conviene apuntar a un usuario real.

insert into courses (name) values
    ('Gestión de proyectos'),
    ('Arquitectura de Software'),
    ('Análisis y diseño de software 2');

insert into topics (course_id, name) values
    ((select id from courses where name = 'Gestión de proyectos'), 'Azure DevOps'),
    ((select id from courses where name = 'Gestión de proyectos'), 'Integración y despliegue continuo (CI/CD)'),
    ((select id from courses where name = 'Arquitectura de Software'), 'Spring Boot'),
    ((select id from courses where name = 'Arquitectura de Software'), 'Control de versiones'),
    ((select id from courses where name = 'Análisis y diseño de software 2'), 'Integración y desarrollo');

insert into resources (title, description, published_at, duration_seconds, channel, url, resource_type, course_id, author_id) values
    (
        'Azure DevOps desde la creación del proyecto hasta la gestión de backlog y Sprints 2026-2',
        'Recorrido completo por Azure DevOps: creación del proyecto, organización del backlog y gestión de Sprints.',
        date '2026-09-06',
        2371,
        'Fábrica Escuela - Canal de Formación',
        'https://www.youtube.com/watch?v=yhUh4ZmM45w',
        'VIDEO',
        (select id from courses where name = 'Gestión de proyectos'),
        0
    ),
    (
        'Harness Engineering JuanFQuintana 2026-2',
        'Introducción a Harness para integración y despliegue continuo de aplicaciones.',
        date '2026-09-10',
        7230,
        'Fábrica Escuela - Canal de Formación',
        'https://www.youtube.com/watch?v=S0TC_HDfKvA',
        'VIDEO',
        (select id from courses where name = 'Gestión de proyectos'),
        0
    ),
    (
        'Spring Boot 2026-2',
        'Fundamentos de Spring Boot para el desarrollo de aplicaciones backend en Java.',
        date '2026-09-10',
        5864,
        'Fábrica Escuela - Canal de Formación',
        'https://www.youtube.com/watch?v=yrir47Z__lY',
        'VIDEO',
        (select id from courses where name = 'Arquitectura de Software'),
        0
    ),
    (
        'Git y GitHub 2026-2',
        'Control de versiones con Git y colaboración en GitHub.',
        date '2026-09-09',
        1967,
        'Fábrica Escuela - Canal de Formación',
        'https://www.youtube.com/watch?v=Djy28T8gxYs',
        'VIDEO',
        (select id from courses where name = 'Arquitectura de Software'),
        0
    ),
    (
        'Taller Integración y desarrollo Nivel Básico 2026-2',
        'Taller práctico de integración y desarrollo de nivel básico.',
        date '2026-09-18',
        6672,
        'Fábrica Escuela - Canal de Formación',
        'https://www.youtube.com/watch?v=FWQi5MJ1erQ',
        'VIDEO',
        (select id from courses where name = 'Análisis y diseño de software 2'),
        0
    );

insert into resource_topics (resource_id, topic_id)
select r.id, t.id
from resources r
join topics t on (
    (r.url = 'https://www.youtube.com/watch?v=yhUh4ZmM45w' and t.name = 'Azure DevOps') or
    (r.url = 'https://www.youtube.com/watch?v=S0TC_HDfKvA' and t.name = 'Integración y despliegue continuo (CI/CD)') or
    (r.url = 'https://www.youtube.com/watch?v=yrir47Z__lY' and t.name = 'Spring Boot') or
    (r.url = 'https://www.youtube.com/watch?v=Djy28T8gxYs' and t.name = 'Control de versiones') or
    (r.url = 'https://www.youtube.com/watch?v=FWQi5MJ1erQ' and t.name = 'Integración y desarrollo')
);
