package io.github.nodoaula.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface TopicRepository extends JpaRepository<Topic, Long> {

	Optional<Topic> findByCourseAndName(Course course, String name);

	@Query("select t from Topic t where t.course.id = :courseId "
			+ "and exists (select 1 from Resource r join r.topics rt where rt = t)")
	List<Topic> findTopicsWithAtLeastOneResource(Long courseId);

}
