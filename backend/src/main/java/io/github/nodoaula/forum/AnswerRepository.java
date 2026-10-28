package io.github.nodoaula.forum;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface AnswerRepository extends JpaRepository<Answer, Long> {

	/** Las respuestas visibles de una pregunta, de la más antigua a la más reciente. */
	List<Answer> findByQuestionIdAndRetiredAtIsNullOrderByCreatedAtAscIdAsc(Long questionId);

	// Solo el identificador, sin cargar la respuesta: así se bloquea primero su
	// pregunta, en el mismo orden que el resto de escrituras del foro.
	@Query("select a.questionId from Answer a where a.id = :id and a.retiredAt is null")
	Optional<Long> findQuestionIdOfVisibleAnswer(Long id);

	// Bloqueada: si dos cuentas la retiran a la vez, la segunda la encuentra ya
	// retirada en lugar de volver a retirarla.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<Answer> findForUpdateByIdAndRetiredAtIsNull(Long id);

	Optional<Answer> findByIdAndQuestionIdAndRetiredAtIsNull(Long id, Long questionId);

}
