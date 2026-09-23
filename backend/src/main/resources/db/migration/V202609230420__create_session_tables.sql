-- Tablas de Spring Session JDBC: las sesiones viven en la base y no en la
-- memoria del proceso, de modo que sobreviven a un despliegue o a la
-- suspensión del servicio. Es el esquema de la librería para PostgreSQL
-- (schema-postgresql.sql de spring-session-jdbc), con un único cambio,
-- señalado abajo. La librería no lo crea por su cuenta: lo impide
-- spring.session.jdbc.initialize-schema=never.

create table spring_session (
    primary_id            char(36)     not null,
    session_id            char(36)     not null,
    creation_time         bigint       not null,
    last_access_time      bigint       not null,
    max_inactive_interval int          not null,
    expiry_time           bigint       not null,

    -- La librería usa varchar(100), pero aquí se guarda el correo de la
    -- cuenta, que admite hasta 254 caracteres: con 100, iniciar sesión con un
    -- correo largo fallaría al guardar la sesión.
    principal_name        varchar(254),

    constraint spring_session_pk primary key (primary_id)
);

create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);

create table spring_session_attributes (
    session_primary_id char(36)     not null,
    attribute_name     varchar(200) not null,
    attribute_bytes    bytea        not null,

    constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
    constraint spring_session_attributes_fk foreign key (session_primary_id)
        references spring_session (primary_id) on delete cascade
);
