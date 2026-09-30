package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ResourceRepository extends JpaRepository<Resource, Long> {

	List<Resource> findByCourseId(Long courseId);

	/**
	 * Filtra el catálogo por curso, tema y tipo de recurso, combinados con AND
	 * (historia HU206). Cada filtro es opcional: un parámetro en null no
	 * restringe nada. El left join a temas no duplica filas porque topicId,
	 * cuando se usa, ya iguala un único tema.
	 */
	@Query("select distinct r from Resource r "
			+ "left join r.topics t "
			+ "where (:courseId is null or r.course.id = :courseId) "
			+ "and (:topicId is null or t.id = :topicId) "
			+ "and (:resourceTypes is null or r.resourceType in :resourceTypes) "
			+ "order by r.title")
	List<Resource> search(
			@Param("courseId") Long courseId,
			@Param("topicId") Long topicId,
			@Param("resourceTypes") List<ResourceType> resourceTypes);

}
