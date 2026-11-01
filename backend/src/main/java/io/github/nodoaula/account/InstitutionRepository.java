package io.github.nodoaula.account;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface InstitutionRepository extends JpaRepository<Institution, Long> {

	List<Institution> findAllByOrderByName();

}
