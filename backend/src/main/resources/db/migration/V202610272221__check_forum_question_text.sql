-- El título y el cuerpo de las preguntas, con la regla del texto de las
-- respuestas: btrim dejaba pasar un texto de solo saltos de línea. Las
-- preguntas guardadas la cumplen, porque la API ya descartaba los espacios.
alter table forum_questions
    drop constraint forum_questions_title_check,
    drop constraint forum_questions_body_check,
    add constraint forum_questions_title_check check (title ~ '[^ \t\n\r\f\v]'),
    add constraint forum_questions_body_check check (body ~ '[^ \t\n\r\f\v]');
