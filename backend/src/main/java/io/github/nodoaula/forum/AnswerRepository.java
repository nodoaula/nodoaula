package io.github.nodoaula.forum;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface AnswerRepository extends JpaRepository<Answer, Long> {

	/** Las respuestas visibles de una pregunta, de la más antigua a la más reciente. */
	List<Answer> findByQuestionIdAndRetiredAtIsNullOrderByCreatedAtAscIdAsc(Long questionId);

	Optional<Answer> findByIdAndRetiredAtIsNull(Long id);

}
