-- Vía por la que entró cada recurso al catálogo (historia HU202, AB#141):
-- indexación automática desde YouTube o formulario manual. La necesitan
-- también HU205 y HU504 para el reparto automático/manual.
--
-- El valor por defecto solo existe para marcar como manuales los recursos que
-- ya estaban, incluidos los del catálogo semilla. Después se retira, para que
-- toda inserción posterior tenga que declarar su vía y ninguna quede como
-- manual por omisión.
alter table resources
    add column entry_method text not null default 'MANUAL'
        check (entry_method in ('MANUAL', 'AUTOMATIC'));

alter table resources
    alter column entry_method drop default;
