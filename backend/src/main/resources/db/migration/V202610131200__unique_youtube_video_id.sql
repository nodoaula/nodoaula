-- Un mismo video de YouTube no se registra dos veces (historia HU308, AB#136),
-- se pegue como se pegue el enlace. El identificador se guarda en video_id y la
-- base de datos impide repetirlo; el código Java lo calcula con YouTubeVideoIds,
-- igual que este script con los enlaces que ya existían.

alter table resources add column video_id text;

update resources set video_id = coalesce(
    substring(url from '^https?://(?:www\.)?youtu\.be/([A-Za-z0-9_-]{11})'),
    substring(url from '^https?://(?:www\.|m\.)?youtube(?:-nocookie)?\.com/(?:embed|shorts|live)/([A-Za-z0-9_-]{11})'),
    substring(url from '^https?://(?:www\.|m\.)?youtube\.com/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})'))
where url is not null;

-- Si ya hubiera el mismo video registrado más de una vez, se deja el más
-- antiguo; sus temas se borran con él (on delete cascade).
delete from resources r
using resources keeper
where r.video_id is not null
  and r.video_id = keeper.video_id
  and r.id > keeper.id;

alter table resources
    add constraint resources_video_id_key unique (video_id);
