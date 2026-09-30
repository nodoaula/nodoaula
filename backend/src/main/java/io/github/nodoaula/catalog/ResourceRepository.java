package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ResourceRepository extends JpaRepository<Resource, Long> {

	List<Resource> findByCourseId(Long courseId);

}
