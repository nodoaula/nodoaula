-- Fecha en que se aportó cada recurso (HU507), para que quien lo vea valore su
-- procedencia. Es un día y no un instante, como la fecha de un apunte.
alter table resources
    add column contributed_on date;

-- Un apunte se aporta el día en que se sube, que es su fecha de publicación.
-- Los videos aportados antes de esta historia se quedan sin fecha: no se sabe
-- cuándo se aportaron y no se inventa.
update resources
    set contributed_on = published_at
    where resource_type = 'DOCUMENT';
