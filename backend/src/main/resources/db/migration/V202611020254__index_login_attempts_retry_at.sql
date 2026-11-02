-- HU508: cada intento de inicio de sesión borra las filas que llevan 24 horas
-- vencidas. Sin este índice, ese borrado recorrería la tabla en cada intento.
create index login_attempts_retry_at_ix on login_attempts (retry_at);
