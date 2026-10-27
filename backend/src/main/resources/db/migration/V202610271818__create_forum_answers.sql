-- Respuestas a las preguntas del foro (historia HU402). La pregunta y sus
-- respuestas son del mismo módulo, así que entre ellas sí hay clave foránea;
-- el autor se guarda por identificador, como en las preguntas.
--
-- retired_at y retired_by van juntas, como en forum_questions.
create table forum_answers (
    id          bigint generated always as identity primary key,
    question_id bigint      not null references forum_questions (id),
    author_id   bigint      not null,
    body        text        not null,
    created_at  timestamptz not null default now(),
    retired_at  timestamptz,
    retired_by  bigint,
    -- Destino de la clave compuesta de abajo; su índice sirve también para
    -- leer y contar las respuestas de una pregunta.
    constraint forum_answers_question_id_id_key unique (question_id, id),
    constraint forum_answers_retirement_check check ((retired_at is null) = (retired_by is null)),
    -- btrim solo quita espacios: un texto de solo saltos de línea pasaría.
    constraint forum_answers_body_check check (body ~ '\S')
);

-- La respuesta útil que elige quien preguntó: una columna, así que hay una
-- como mucho. La clave compuesta obliga a que sea de la misma pregunta; con
-- la columna nula no se comprueba. Que no esté retirada lo vigila el servicio.
alter table forum_questions
    add column useful_answer_id bigint,
    add constraint forum_questions_useful_answer_fkey
        foreign key (id, useful_answer_id) references forum_answers (question_id, id);
