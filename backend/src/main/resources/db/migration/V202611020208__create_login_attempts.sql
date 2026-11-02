-- HU508: fallos seguidos de inicio de sesión por correo intentado, exista o no
-- una cuenta con él (ADR-007). En la base y no en memoria, para que el límite
-- sobreviva a los despliegues y a las suspensiones del servicio.
create table login_attempts (
    -- SHA-256 del correo normalizado, no el correo: aquí llega cualquier texto
    -- que alguien escriba en el campo, de cualquier longitud y sin que haya
    -- autorizado guardarlo, a veces hasta la contraseña por error.
    email_hash bytea       primary key check (octet_length(email_hash) = 32),

    failures   integer     not null check (failures > 0),

    -- Hasta cuándo se rechaza cualquier intento con este correo.
    retry_at   timestamptz not null
);
