-- Cuándo autorizó la cuenta el tratamiento de sus datos personales: la Ley 1581
-- de 2012 exige poder probarlo. La fecha dice también qué versión de la
-- política aceptó. Queda vacía en las cuentas creadas antes de pedirla, hasta
-- que la den.
alter table accounts
    add column data_processing_authorized_at timestamptz;
