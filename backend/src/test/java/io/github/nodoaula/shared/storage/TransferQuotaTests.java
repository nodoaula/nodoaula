package io.github.nodoaula.shared.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Cubre el tope de transferencia contra PostgreSQL. Usa ciclos del año 2000,
 * que nunca coinciden con los de una base de desarrollo, y los borra al
 * terminar.
 *
 * No es @Transactional: la prueba de concurrencia necesita que cada hilo
 * confirme su propia reserva.
 */
@SpringBootTest
class TransferQuotaTests {

	private static final LocalDate JANUARY_CYCLE = LocalDate.of(2000, 1, 19);
	private static final Clock IN_JANUARY_CYCLE = Clock.fixed(Instant.parse("2000-01-25T12:00:00Z"), ZoneOffset.UTC);
	private static final Clock IN_FEBRUARY_CYCLE = Clock.fixed(Instant.parse("2000-02-20T12:00:00Z"), ZoneOffset.UTC);

	@Autowired private JdbcClient jdbc;

	@AfterEach
	void cleanUp() {
		jdbc.sql("delete from storage_transfer where cycle_start < date '2001-01-01'").update();
	}

	@Test
	void theCycleStartsOnThe19thOfEachMonth() {
		assertEquals(LocalDate.of(2026, 10, 19), TransferQuota.cycleStart(LocalDate.of(2026, 10, 19)));
		assertEquals(LocalDate.of(2026, 9, 19), TransferQuota.cycleStart(LocalDate.of(2026, 10, 18)));
		assertEquals(LocalDate.of(2025, 12, 19), TransferQuota.cycleStart(LocalDate.of(2026, 1, 5)));
	}

	@Test
	void reservesUpToTheLimitAndThenRefusesWithoutAddingAnything() {
		TransferQuota quota = new TransferQuota(jdbc, IN_JANUARY_CYCLE);

		assertTrue(quota.reserve(TransferQuota.LIMIT_BYTES - 10));
		assertTrue(quota.reserve(10));
		assertFalse(quota.reserve(1));
		assertEquals(TransferQuota.LIMIT_BYTES, used(JANUARY_CYCLE));
	}

	@Test
	void aFileLargerThanTheLimitIsRefusedEvenAtTheStartOfACycle() {
		assertFalse(new TransferQuota(jdbc, IN_JANUARY_CYCLE).reserve(TransferQuota.LIMIT_BYTES + 1));
		assertEquals(0, jdbc.sql("select count(*) from storage_transfer where cycle_start = ?")
				.param(JANUARY_CYCLE).query(Long.class).single());
	}

	@Test
	void eachCycleStartsFromZero() {
		TransferQuota january = new TransferQuota(jdbc, IN_JANUARY_CYCLE);
		assertTrue(january.reserve(TransferQuota.LIMIT_BYTES));
		assertFalse(january.reserve(1));

		assertTrue(new TransferQuota(jdbc, IN_FEBRUARY_CYCLE).reserve(TransferQuota.LIMIT_BYTES));
	}

	// Caben exactamente cuatro reservas: de diez a la vez, entran cuatro, y no
	// cinco por leer el total antes de que otra lo cambie.
	@Test
	void simultaneousReservationsNeverExceedTheLimit() throws Exception {
		TransferQuota quota = new TransferQuota(jdbc, IN_JANUARY_CYCLE);
		long size = TransferQuota.LIMIT_BYTES / 4;
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Boolean>> results = new ArrayList<>();

		try (ExecutorService pool = Executors.newFixedThreadPool(10)) {
			for (int i = 0; i < 10; i++) {
				results.add(pool.submit(() -> {
					start.await();
					return quota.reserve(size);
				}));
			}
			start.countDown();
			long accepted = 0;
			for (Future<Boolean> result : results) {
				if (Boolean.TRUE.equals(result.get(30, TimeUnit.SECONDS))) {
					accepted++;
				}
			}
			assertEquals(4, accepted);
		}
		assertEquals(TransferQuota.LIMIT_BYTES, used(JANUARY_CYCLE));
	}

	private long used(LocalDate cycleStart) {
		return jdbc.sql("select bytes from storage_transfer where cycle_start = ?")
				.param(cycleStart).query(Long.class).single();
	}

}
