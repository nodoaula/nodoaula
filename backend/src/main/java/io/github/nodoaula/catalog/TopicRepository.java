package io.github.nodoaula.catalog;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface TopicRepository extends JpaRepository<Topic, Long> {

	Optional<Topic> findByCourseAndName(Course course, String name);

}
