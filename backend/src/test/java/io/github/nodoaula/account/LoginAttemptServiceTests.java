package io.github.nodoaula.account;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Cubre las esperas de HU508 contra PostgreSQL, con el reloj fijado para no
 * tener que esperarlas. Cada llamada usa una instancia nueva del servicio, de
 * modo que lo único que se conserva entre un intento y otro es lo que está en
 * la base: lo mismo que tras un despliegue o una suspensión.
 *
 * Cada prueba usa un correo único y borra solo su fila, y el reloj está en el
 * año 2000, de modo que la purga de lo vencido no alcanza a las filas de una base
 * de desarrollo. Así no depende de lo que haya en la base. No es @Transactional:
 * la prueba de concurrencia necesita que cada hilo confirme su propio intento.
 */
@SpringBootTest
class LoginAttemptServiceTests {

	private static final Instant START = Instant.parse("2000-01-01T00:00:00Z");

	@Autowired private JdbcClient jdbc;

	private String email;

	@BeforeEach
	void chooseEmail() {
		email = AccountTestSupport.uniqueEmail();
	}

	@AfterEach
	void cleanUp() {
		service(START).reset(email);
	}

	private LoginAttemptService service(Instant now) {
		return new LoginAttemptService(jdbc, Clock.fixed(now, ZoneOffset.UTC));
	}

	private long attempt(Instant now) {
		return service(now).claimAttempt(email);
	}

	private void failSixTimes(Instant now) {
		for (int failure = 1; failure <= 6; failure++) {
			assertEquals(0, attempt(now), "El fallo " + failure + " no tiene espera delante");
		}
	}

	@Test
	void theFirstFiveFailuresHaveNoWaitAndTheSixthOpensOneOf30Seconds() {
		for (int failure = 1; failure <= 5; failure++) {
			assertEquals(0, attempt(START));
		}
		assertEquals(0, attempt(START), "El quinto fallo no abre ninguna espera");

		assertEquals(30, attempt(START), "El sexto fallo abre la primera");
	}

	@Test
	void theWaitDoublesWithEachFailureUpTo15Minutes() {
		failSixTimes(START);

		Instant now = START;
		long previousWait = 30;
		for (long expectedWait : new long[] { 60, 120, 240, 480, 900, 900, 900 }) {
			assertEquals(previousWait, attempt(now));

			// Vencida la espera, el intento se evalúa y, al fallar, abre la siguiente.
			now = now.plusSeconds(previousWait);
			assertEquals(0, attempt(now));

			assertEquals(expectedWait, attempt(now));
			previousWait = expectedWait;
		}
	}

	@Test
	void aRejectedAttemptNeitherCountsAsAFailureNorExtendsTheWait() {
		failSixTimes(START);

		for (int rejected = 0; rejected < 20; rejected++) {
			assertEquals(30, attempt(START));
		}
		assertEquals(10, attempt(START.plusSeconds(20)), "La espera no se alarga con los rechazos");

		Instant afterTheWait = START.plusSeconds(30);
		assertEquals(0, attempt(afterTheWait));
		assertEquals(60, attempt(afterTheWait), "Con veinte fallos más serían 15 minutos");
	}

	@Test
	void theRemainingSecondsAreRoundedUp() {
		failSixTimes(START);

		assertEquals(1, attempt(START.plus(Duration.ofMillis(29_500))));
	}

	@Test
	void resettingLetsTheEmailStartOver() {
		failSixTimes(START);

		service(START).reset(email);

		failSixTimes(START);
		assertEquals(30, attempt(START));
	}

	@Test
	void capitalsAndSurroundingSpacesAreTheSameEmail() {
		failSixTimes(START);

		assertEquals(30, service(START).claimAttempt(email.toUpperCase()));
		assertEquals(30, service(START).claimAttempt("  " + email + " "));
	}

	@Test
	void eachEmailHasItsOwnCount() {
		failSixTimes(START);

		String other = AccountTestSupport.uniqueEmail();
		try {
			assertEquals(0, service(START).claimAttempt(other));
		} finally {
			service(START).reset(other);
		}
	}

	@Test
	void theCountRestartsAfter24HoursWithoutNewFailures() {
		failSixTimes(START);
		assertEquals(30, attempt(START));

		// Un segundo antes de las 24 horas, el contador sigue donde estaba.
		Instant almostThere = START.plusSeconds(30).plus(Duration.ofHours(24)).minusSeconds(1);
		assertEquals(0, attempt(almostThere));
		assertEquals(60, attempt(almostThere), "Es el séptimo fallo seguido");

		Instant afterALongTime = almostThere.plusSeconds(60).plus(Duration.ofHours(24));
		failSixTimes(afterALongTime);
		assertEquals(30, attempt(afterALongTime), "Vuelve a empezar: seis intentos sin espera y luego 30 segundos");
	}

	@Test
	void theCountAtTheMaximumWaitAlsoRestartsAndTheWaitNeverPasses15Minutes() {
		jdbc.sql("insert into login_attempts (email_hash, failures, retry_at) values (?, ?, ?)")
				.param(LoginAttemptService.hash(email))
				.param(50)
				.param(Timestamp.from(START))
				.update();

		assertEquals(0, attempt(START));
		assertEquals(900, attempt(START), "Con muchos fallos, 15 minutos: nunca las 24 horas");

		failSixTimes(START.plusSeconds(900).plus(Duration.ofHours(24)));
	}

	@Test
	void anAttemptPurgesTheExpiredRowsOfOtherEmailsAndNotTheRecentOnes() {
		String expired = AccountTestSupport.uniqueEmail();
		String recent = AccountTestSupport.uniqueEmail();
		try {
			service(START).claimAttempt(expired);
			service(START.plus(Duration.ofHours(23))).claimAttempt(recent);

			attempt(START.plus(Duration.ofHours(24)));

			assertEquals(0, rowsOf(expired), "La fila vencida se borra");
			assertEquals(1, rowsOf(recent), "La reciente sigue");
		} finally {
			service(START).reset(expired);
			service(START).reset(recent);
		}
	}

	private long rowsOf(String email) {
		return jdbc.sql("select count(*) from login_attempts where email_hash = ?")
				.param(LoginAttemptService.hash(email))
				.query(Long.class).single();
	}

	// Lo que alguien escriba en el campo llega hasta aquí, sin importar su
	// longitud: como clave de un índice, un texto así haría fallar la sentencia.
	@Test
	void aVeryLongEmailIsCountedLikeAnyOther() {
		String longEmail = "a".repeat(100_000) + "@ejemplo.com";
		try {
			for (int failure = 1; failure <= 6; failure++) {
				assertEquals(0, service(START).claimAttempt(longEmail));
			}
			assertEquals(30, service(START).claimAttempt(longEmail));
		} finally {
			service(START).reset(longEmail);
		}
	}

	// El contador no tiene tope: a 15 minutos por fallo, una potencia de 2 sin
	// acotar se desbordaría en unos días de ataque y el login respondería 500.
	@Test
	void aVeryHighCountStaysAt15Minutes() {
		jdbc.sql("insert into login_attempts (email_hash, failures, retry_at) values (?, ?, ?)")
				.param(LoginAttemptService.hash(email))
				.param(1_000_000)
				.param(Timestamp.from(START))
				.update();

		assertEquals(0, attempt(START));
		assertEquals(900, attempt(START));
	}

	// Si se comprobara primero y se anotara después, las veinte pasarían a la vez.
	@Test
	void simultaneousAttemptsCannotSlipPastTheLimit() throws Exception {
		LoginAttemptService service = service(START);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Long>> results = new ArrayList<>();

		try (ExecutorService pool = Executors.newFixedThreadPool(20)) {
			for (int i = 0; i < 20; i++) {
				results.add(pool.submit(() -> {
					start.await();
					return service.claimAttempt(email);
				}));
			}
			start.countDown();

			long allowed = 0;
			for (Future<Long> result : results) {
				if (result.get(30, TimeUnit.SECONDS) == 0) {
					allowed++;
				}
			}
			assertEquals(6, allowed);
		}
	}

}
