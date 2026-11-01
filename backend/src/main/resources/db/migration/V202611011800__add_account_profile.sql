-- Perfil de la cuenta (HU506): quién es y de dónde, para que quien vea lo que
-- aporta pueda valorar su procedencia.

-- La institución se elige de una lista cerrada y no se escribe: escrita a mano,
-- «UdeA», «Universidad de Antioquia» y «udea» serían tres instituciones
-- distintas. La lista la carga la migración siguiente, desde el SNIES.
create table institutions (
    id         bigint  generated always as identity primary key,

    -- Código SNIES de la institución principal. Solo «Otra» no lo tiene.
    snies_code integer unique,

    name       text    not null unique check (name = btrim(name) and name <> '')
);

-- Una sola fila sin código, que es «Otra».
create unique index institutions_single_other on institutions ((snies_code is null)) where snies_code is null;

-- Quedan vacías en las cuentas creadas antes de pedirlos, hasta que completen
-- el perfil al volver a iniciar sesión.
alter table accounts
    -- El servicio lo guarda recortado y con los espacios repetidos reducidos.
    add column name           text   check (name = btrim(name) and name <> '' and char_length(name) <= 100),
    add column institution_id bigint references institutions (id),
    add column user_type      text   check (user_type in ('STUDENT', 'TEACHER')),

    -- El perfil se guarda entero o no se guarda: es lo que dice si la cuenta
    -- tiene que completarlo, y se completa en un solo paso, junto con la
    -- autorización de la política que lo menciona.
    add constraint accounts_profile_all_or_nothing check (
        (name is null and institution_id is null and user_type is null)
        or (name is not null and institution_id is not null and user_type is not null));
