-- HU412: vista previa de un apunte, un PDF aparte con sus primeras páginas.
-- Un video no la tiene, ni un apunte de 3 páginas o menos.
alter table resources
    add column preview_key        text unique,
    add column preview_size_bytes bigint,
    add column preview_page_count integer,
    add constraint resources_preview_check check (
        (preview_key is null and preview_size_bytes is null and preview_page_count is null)
        or
        (resource_type = 'DOCUMENT' and preview_key is not null
            and preview_size_bytes is not null and preview_page_count is not null));
