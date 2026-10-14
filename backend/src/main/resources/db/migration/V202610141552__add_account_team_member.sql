-- Marca de cuenta del equipo (historias HU311 y HU307, AB#218): una cuenta del
-- equipo puede corregir o retirar cualquier recurso, incluidos los del catálogo
-- semilla, que no tienen un autor con cuenta (author_id = 0). No hay pantalla
-- de administración: una cuenta se marca con una migración o directamente en
-- la base de datos (ADR-007).
--
-- A diferencia de entry_method, el valor por defecto se conserva: toda cuenta,
-- la que ya existía y la que se registre después, empieza sin la marca.
alter table accounts
    add column team_member boolean not null default false;
