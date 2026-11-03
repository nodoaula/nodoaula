-- Cuentas de prueba del equipo (HU507): las creadas antes de que el registro
-- pidiera la autorización del tratamiento de datos (HU510). Lo que aportaron
-- se muestra como del equipo, igual que el catálogo semilla, y no con el
-- nombre de la cuenta.
--
-- No es la marca de cuenta del equipo (team_member): no da ningún permiso de
-- moderación. Como aquella, se conserva el valor por defecto: una cuenta nueva
-- nunca es de prueba.
alter table accounts
    add column team_test_account boolean not null default false;

-- Desde HU510, una cuenta nueva guarda la autorización con la misma fecha con
-- que se crea. Las anteriores no la tienen o la dieron después, al completar
-- el perfil (HU506).
update accounts
    set team_test_account = true
    where data_processing_authorized_at is null
       or data_processing_authorized_at <> created_at;
