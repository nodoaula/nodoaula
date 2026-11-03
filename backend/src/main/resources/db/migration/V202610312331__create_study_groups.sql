-- Grupos de estudio de un curso (historia HU404). El curso, las cuentas y el
-- hilo del foro viven en otros módulos y se relacionan por identificador, sin
-- clave foránea (ADR-008), como en forum_questions.
--
-- normalized_name es la forma comparable del nombre, la misma de los cursos y
-- los temas (HU308): la calcula el código Java con NameNormalizer.
--
-- retired_at y retired_by van juntas: ambas nulas en un grupo visible y ambas
-- con valor en uno retirado, que no se borra.
create table study_groups (
    id              bigint generated always as identity primary key,
    course_id       bigint      not null,
    name            text        not null,
    normalized_name text        not null,
    description     text,
    creator_id      bigint      not null,
    thread_id       bigint      not null,
    created_at      timestamptz not null default now(),
    retired_at      timestamptz,
    retired_by      bigint,
    constraint study_groups_thread_id_key unique (thread_id),
    constraint study_groups_retirement_check check ((retired_at is null) = (retired_by is null)),
    -- Algún carácter que no sea un espacio ASCII, como el texto del foro.
    constraint study_groups_name_check check (name ~ '[^ \t\n\r\f\v]' and char_length(name) <= 200),
    constraint study_groups_description_check check (char_length(description) <= 2000)
);

-- En un mismo curso no hay dos grupos visibles con el mismo nombre. Uno
-- retirado deja de verse y libera el nombre. El índice sirve también para
-- listar los grupos de un curso.
create unique index study_groups_course_id_normalized_name_key
    on study_groups (course_id, normalized_name)
    where retired_at is null;

-- Quiénes pertenecen a cada grupo. Grupo y miembros son del mismo módulo, así
-- que entre ellos sí hay clave foránea; la cuenta se guarda por identificador.
create table study_group_members (
    id         bigint generated always as identity primary key,
    group_id   bigint      not null references study_groups (id),
    account_id bigint      not null,
    joined_at  timestamptz not null default now(),
    constraint study_group_members_group_id_account_id_key unique (group_id, account_id)
);

-- Para saber de qué grupos es miembro una cuenta.
create index study_group_members_account_idx on study_group_members (account_id);
