package io.github.nodoaula.forum;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

interface QuestionRepository extends JpaRepository<Question, Long> {

	/** Las preguntas visibles de un curso, de la más reciente a la más antigua. */
	List<Question> findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(Long courseId);

	boolean existsByIdAndRetiredAtIsNull(Long id);

	// Hibernate reescribe la fila entera al guardar: sin el bloqueo, marcar la
	// útil a la vez que se retira la pregunta podría devolverla a la vista.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<Question> findForUpdateByIdAndRetiredAtIsNull(Long id);

	@Lock(LockModeType.PESSIMISTIC_READ)
	Optional<Question> findForShareByIdAndRetiredAtIsNull(Long id);

	/**
	 * La pregunta visible, con la fila bloqueada hasta el final de la
	 * transacción. Lo usa toda escritura que cambia la pregunta, antes de
	 * bloquear una de sus respuestas, y tiene que ser su primera lectura: si
	 * la pregunta ya está cargada en la transacción, Hibernate devuelve la que
	 * tiene sin releerla.
	 *
	 * @throws QuestionNotFoundException si no existe o está retirada
	 */
	default Question getVisibleForUpdate(Long id) {
		return findForUpdateByIdAndRetiredAtIsNull(id).orElseThrow(QuestionNotFoundException::new);
	}

	/**
	 * Como getVisibleForUpdate, pero con un bloqueo compartido: para escrituras
	 * que dependen de que la pregunta siga visible sin cambiarla, como
	 * responderla. Varias pueden ir a la vez; retirarla espera a que terminen.
	 */
	default Question getVisibleForShare(Long id) {
		return findForShareByIdAndRetiredAtIsNull(id).orElseThrow(QuestionNotFoundException::new);
	}

}
