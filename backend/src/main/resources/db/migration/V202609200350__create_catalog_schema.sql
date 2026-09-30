create table courses (
    id   bigint generated always as identity primary key,
    name text   not null unique
);

create table topics (
    id        bigint generated always as identity primary key,
    course_id bigint not null references courses (id),
    name      text   not null,
    unique (course_id, name)
);

create table resources (
    id               bigint  generated always as identity primary key,
    title            text    not null,
    description      text,
    published_at     date,
    duration_seconds integer,
    channel          text,
    url              text    not null,
    resource_type    text    not null check (resource_type in ('VIDEO', 'DOCUMENT')),
    course_id        bigint  not null references courses (id),

    -- Sin clave foránea: el usuario vive en otro módulo y su tabla la crea
    -- la historia de registro de cuentas.
    author_id        bigint  not null
);

-- Un recurso trata de varios temas, así que la relación no cabe en una columna.
create table resource_topics (
    resource_id bigint not null references resources (id) on delete cascade,
    topic_id    bigint not null references topics (id),
    primary key (resource_id, topic_id)
);

-- El filtro por curso es el más usado, y la agrupación por tema es la que
-- recorre la página de un curso.
create index on resources (course_id);
create index on resource_topics (topic_id);
