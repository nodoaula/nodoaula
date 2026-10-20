-- Preguntas del foro de un curso (historia HU401). El curso, el recurso y las
-- cuentas viven en otros módulos y se relacionan por identificador, sin clave
-- foránea (ADR-008), como author_id y retired_by en resources.
--
-- retired_at y retired_by van juntas: ambas nulas en una pregunta visible y
-- ambas con valor en una retirada, que no se borra.
create table forum_questions (
    id          bigint generated always as identity primary key,
    course_id   bigint      not null,
    resource_id bigint,
    author_id   bigint      not null,
    title       text        not null,
    body        text        not null,
    created_at  timestamptz not null default now(),
    retired_at  timestamptz,
    retired_by  bigint,
    constraint forum_questions_retirement_check check ((retired_at is null) = (retired_by is null)),
    constraint forum_questions_title_check check (btrim(title) <> ''),
    constraint forum_questions_body_check check (btrim(body) <> '')
);

create index forum_questions_course_idx on forum_questions (course_id, created_at desc);
