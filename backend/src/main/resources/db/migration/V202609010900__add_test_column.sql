-- Archivo de prueba: su versión es ANTERIOR a la migración que ya está en
-- develop, a propósito. Sirve para comprobar que el check bloquea el Pull
-- Request. Esta rama no se fusiona nunca.
alter table resources add column test_column text;
