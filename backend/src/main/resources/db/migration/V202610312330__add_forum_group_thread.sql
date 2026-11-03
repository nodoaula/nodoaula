-- El hilo de un grupo de estudio (historia HU404) es una pregunta del foro de
-- su curso, marcada como de grupo: la lee cualquiera y solo la responden los
-- miembros del grupo. Las preguntas que ya existen no son de grupo.
alter table forum_questions
    add column group_thread boolean not null default false;

-- El cuerpo del hilo es la descripción del grupo, que es opcional: el de un
-- hilo de grupo puede quedar vacío, pero no ser solo espacios, igual que el
-- de cualquier otra pregunta.
alter table forum_questions
    drop constraint forum_questions_body_check,
    add constraint forum_questions_body_check
        check (body ~ '[^ \t\n\r\f\v]' or (group_thread and body = ''));
