package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ResourceRepository extends JpaRepository<Resource, Long> {

	List<Resource> findByCourseId(Long courseId);

	/**
	 * Filtra el catálogo por curso, tema y tipo de recurso, combinados con AND
	 * (historia HU206). Cada filtro es opcional y admite varios valores a la
	 * vez (por ejemplo, dos cursos): una lista en null no restringe nada, y
	 * dentro de cada filtro los valores se combinan con OR. El left join a
	 * temas puede duplicar filas cuando un recurso tiene varios temas que
	 * coinciden con la lista elegida; distinct() lo evita.
	 */
	@Query("select distinct r from Resource r "
			+ "left join r.topics t "
			+ "where (:courseIds is null or r.course.id in :courseIds) "
			+ "and (:topicIds is null or t.id in :topicIds) "
			+ "and (:resourceTypes is null or r.resourceType in :resourceTypes) "
			+ "order by r.title")
	List<Resource> search(
			@Param("courseIds") List<Long> courseIds,
			@Param("topicIds") List<Long> topicIds,
			@Param("resourceTypes") List<ResourceType> resourceTypes);

	/** Bytes que ocupan en el almacenamiento los archivos de todos los apuntes. */
	@Query("select coalesce(sum(r.file.sizeBytes), 0) from Resource r")
	long totalStoredBytes();

}
