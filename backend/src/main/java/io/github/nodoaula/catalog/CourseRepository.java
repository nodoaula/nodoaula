package io.github.nodoaula.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface CourseRepository extends JpaRepository<Course, Long> {

	@Query("select c from Course c where exists (select 1 from Resource r where r.course = c)")
	List<Course> findCoursesWithAtLeastOneResource();

	Optional<Course> findByName(String name);

}
