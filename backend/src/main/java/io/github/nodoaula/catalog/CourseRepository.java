package io.github.nodoaula.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface CourseRepository extends JpaRepository<Course, Long> {

	@Query("select c from Course c where exists (select 1 from Resource r where r.course = c)")
	List<Course> findCoursesWithAtLeastOneResource();

	Optional<Course> findByName(String name);

	Optional<Course> findByNormalizedName(String normalizedName);

	/**
	 * Crea el curso si no existe uno con ese nombre normalizado, y no hace nada
	 * si ya existe. Con insert ... on conflict el duplicado de un registro
	 * simultáneo no lanza excepción: un fallo de la base dejaría inservible la
	 * sesión de Hibernate y la búsqueda posterior fallaría (AB#213).
	 */
	@Modifying
	@Query(value = "insert into courses (name, normalized_name) values (:name, :normalizedName) "
			+ "on conflict do nothing", nativeQuery = true)
	void insertIfAbsent(@Param("name") String name, @Param("normalizedName") String normalizedName);

}
