package io.github.nodoaula.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface TopicRepository extends JpaRepository<Topic, Long> {

	Optional<Topic> findByCourseAndName(Course course, String name);

	/**
	 * Temas con al menos un recurso. Con courseId se restringen a ese curso
	 * (uso original: sugerirlos al registrar un recurso, HU105); sin él se
	 * listan todos, para el selector de tema del catálogo sin curso elegido
	 * (HU206).
	 */
	@Query("select t from Topic t where (:courseId is null or t.course.id = :courseId) "
			+ "and exists (select 1 from Resource r join r.topics rt where rt = t) "
			+ "order by t.name")
	List<Topic> findTopicsWithAtLeastOneResource(@Param("courseId") Long courseId);

}
