-- Un curso o un tema que solo se diferencian en mayúsculas, tildes o espacios
-- son el mismo (historia HU308, AB#136). La forma comparable se guarda en
-- normalized_name y la base de datos impide repetirla; el código Java la
-- calcula con NameNormalizer, igual que este script.

alter table courses add column normalized_name text;
alter table topics  add column normalized_name text;

update courses set normalized_name = lower(translate(
    regexp_replace(btrim(name), '\s+', ' ', 'g'),
    'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñÇç',
    'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNnCc'));

update topics set normalized_name = lower(translate(
    regexp_replace(btrim(name), '\s+', ' ', 'g'),
    'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñÇç',
    'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNnCc'));

-- Si ya hubiera cursos o temas que choquen con la regla, se unifican antes de
-- imponerla: sobrevive el más antiguo y sus recursos pasan a él.
create temp table course_map as
select id as old_id,
       min(id) over (partition by normalized_name) as new_id
from courses;

-- Los temas se unifican por curso de destino y nombre normalizado.
create temp table topic_map as
select t.id as old_id,
       min(t.id) over (partition by cm.new_id, t.normalized_name) as new_id
from topics t
join course_map cm on cm.old_id = t.course_id;

insert into resource_topics (resource_id, topic_id)
select distinct rt.resource_id, tm.new_id
from resource_topics rt
join topic_map tm on tm.old_id = rt.topic_id
where tm.old_id <> tm.new_id
on conflict do nothing;

delete from resource_topics rt
using topic_map tm
where rt.topic_id = tm.old_id and tm.old_id <> tm.new_id;

delete from topics t
using topic_map tm
where t.id = tm.old_id and tm.old_id <> tm.new_id;

update topics t
set course_id = cm.new_id
from course_map cm
where t.course_id = cm.old_id and cm.old_id <> cm.new_id;

update resources r
set course_id = cm.new_id
from course_map cm
where r.course_id = cm.old_id and cm.old_id <> cm.new_id;

delete from courses c
using course_map cm
where c.id = cm.old_id and cm.old_id <> cm.new_id;

drop table topic_map;
drop table course_map;

alter table courses
    alter column normalized_name set not null,
    add constraint courses_normalized_name_key unique (normalized_name);

alter table topics
    alter column normalized_name set not null,
    add constraint topics_course_id_normalized_name_key unique (course_id, normalized_name);
