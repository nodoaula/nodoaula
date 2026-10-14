-- Retiro lógico de un recurso (historia HU307): el registro permanece, para que
-- no queden huérfanas las preguntas del foro que lo referencien, y se puede
-- volver a publicar. Un recurso está retirado cuando retired_at tiene valor.
--
-- retired_by es la cuenta que lo retiró, la única que puede volver a
-- publicarlo. Sin clave foránea: la cuenta vive en otro módulo y se relaciona
-- por identificador (ADR-008), como author_id.
--
-- Las dos columnas van juntas: ambas nulas en un recurso publicado y ambas con
-- valor en uno retirado. Los recursos que ya existen quedan publicados.
alter table resources
    add column retired_at timestamptz,
    add column retired_by bigint,
    add constraint resources_retirement_check check ((retired_at is null) = (retired_by is null));
