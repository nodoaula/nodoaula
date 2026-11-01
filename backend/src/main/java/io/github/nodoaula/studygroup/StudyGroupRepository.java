package io.github.nodoaula.studygroup;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

interface StudyGroupRepository extends JpaRepository<StudyGroup, Long> {

	/** Los grupos visibles de un curso, del más reciente al más antiguo. */
	List<StudyGroup> findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(Long courseId);

	boolean existsByCourseIdAndNormalizedNameAndRetiredAtIsNull(Long courseId, String normalizedName);

	// Bloqueado: si dos cuentas lo retiran a la vez, la segunda lo encuentra
	// ya retirado en lugar de volver a retirarlo.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<StudyGroup> findForUpdateByIdAndRetiredAtIsNull(Long id);

	// Con un bloqueo compartido: unirse y salir dependen de que el grupo siga
	// visible sin cambiarlo. Varias pueden ir a la vez; retirarlo espera a que
	// terminen.
	@Lock(LockModeType.PESSIMISTIC_READ)
	Optional<StudyGroup> findForShareByIdAndRetiredAtIsNull(Long id);

	Optional<StudyGroup> findByIdAndRetiredAtIsNull(Long id);

}
