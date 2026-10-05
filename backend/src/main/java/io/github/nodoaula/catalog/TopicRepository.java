package io.github.nodoaula.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface TopicRepository extends JpaRepository<Topic, Long> {

	Optional<Topic> findByCourseAndName(Course course, String name);

	/**
	 * Temas con al menos un recurso. Con courseIds se restringen a esos
	 * cursos (uso original: sugerirlos al registrar un recurso, HU105, con un
	 * único curso; también el selector de tema del catálogo cuando hay uno o
	 * varios cursos elegidos, HU206); sin ellos se listan todos.
	 */
	@Query("select t from Topic t where (:courseIds is null or t.course.id in :courseIds) "
			+ "and exists (select 1 from Resource r join r.topics rt where rt = t) "
			+ "order by t.name")
	List<Topic> findTopicsWithAtLeastOneResource(@Param("courseIds") List<Long> courseIds);

}
