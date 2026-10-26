-- HU411: bytes de los enlaces de descarga entregados en cada ciclo de
-- facturación de Supabase, para no pasar del cupo de transferencia del plan
-- gratuito. Una fila por ciclo, identificado por el día en que empieza.
create table storage_transfer (
    cycle_start date   primary key,
    bytes       bigint not null check (bytes >= 0)
);
