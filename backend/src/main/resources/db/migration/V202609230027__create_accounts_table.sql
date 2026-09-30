create table accounts (
    id            bigint      generated always as identity primary key,

    -- El servicio lo guarda recortado y en minúsculas, y la restricción lo
    -- exige: sin ella, un correo escrito con otras mayúsculas esquivaría la
    -- unicidad y crearía una segunda cuenta para la misma persona.
    email         text        not null unique check (email = lower(btrim(email))),

    -- Hash del codificador delegante de Spring Security, con el prefijo que
    -- identifica el algoritmo, p. ej. {bcrypt}$2a$10$... Nunca la contraseña.
    password_hash text        not null,

    created_at    timestamptz not null
);
