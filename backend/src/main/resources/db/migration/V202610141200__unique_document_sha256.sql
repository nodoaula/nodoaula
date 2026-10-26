-- HU413: huella SHA-256 del contenido de cada apunte, única para que el mismo
-- archivo no se suba dos veces. Los apuntes anteriores no la tienen (el archivo
-- está en el almacenamiento, no en la base) y los videos tampoco: varios NULL
-- no chocan entre sí en una restricción única.
alter table resources
    add column file_sha256 text,
    add constraint resources_file_sha256_key unique (file_sha256);
