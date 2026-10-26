-- Un apunte se sube como archivo (historia HU302): un video tiene enlace y
-- un apunte tiene archivo, nunca las dos cosas ni ninguna.
alter table resources
    alter column url drop not null,
    add column file_key        text unique,
    add column file_size_bytes bigint,
    add column page_count      integer,
    add constraint resources_link_or_file_check check (
        (resource_type = 'VIDEO'    and url is not null and file_key is null
            and file_size_bytes is null and page_count is null)
        or
        (resource_type = 'DOCUMENT' and url is null and file_key is not null
            and file_size_bytes is not null and page_count is not null));
