package io.github.nodoaula.forum;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface QuestionRepository extends JpaRepository<Question, Long> {

	/** Las preguntas visibles de un curso, de la más reciente a la más antigua. */
	List<Question> findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(Long courseId);

	Optional<Question> findByIdAndRetiredAtIsNull(Long id);

}
