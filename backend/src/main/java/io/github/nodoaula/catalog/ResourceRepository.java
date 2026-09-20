package io.github.nodoaula.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

interface ResourceRepository extends JpaRepository<Resource, Long> {
}
