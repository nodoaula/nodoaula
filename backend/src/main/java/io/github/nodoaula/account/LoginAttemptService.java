package io.github.nodoaula.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Límite de intentos de inicio de sesión por correo intentado, exista o no una
 * cuenta con él, de modo que la respuesta no revela qué correos tienen cuenta
 * (ADR-007).
 *
 * Los cinco primeros fallos seguidos no tienen espera. El sexto abre una de 30
 * segundos, que se duplica con cada fallo hasta 15 minutos.
 *
 * Cada intento se anota como fallo antes de comprobar la contraseña, y un
 * inicio de sesión correcto borra la anotación. Anotarlo después dejaría pasar
 * juntas todas las peticiones que llegaran mientras se calcula el bcrypt, que
 * es justo lo que haría quien prueba contraseñas. A cambio, un error del
 * servidor al comprobarla cuenta como un fallo; es raro y solo adelanta la
 * espera.
 *
 * Pasadas 24 horas sin un fallo nuevo, el contador vuelve a cero y su fila se
 * borra. El usuario no lo sabe: lo único que se le dice es cuánto falta de la
 * espera en curso, que nunca pasa de 15 minutos.
 */
@Service
class LoginAttemptService {

	private static final Duration COUNT_LIFETIME = Duration.ofHours(24);

	private final JdbcClient jdbc;
	private final Clock clock;

	@Autowired
	LoginAttemptService(JdbcClient jdbc) {
		this(jdbc, Clock.systemUTC());
	}

	// Las pruebas fijan el reloj para no tener que esperar.
	LoginAttemptService(JdbcClient jdbc, Clock clock) {
		this.jdbc = jdbc;
		this.clock = clock;
	}

	/**
	 * Anota un intento, salvo que el correo esté en espera: los rechazados no
	 * cuentan como fallos. Comprobar y anotar son una sola sentencia, para que
	 * dos peticiones a la vez no puedan pasar por el mismo hueco.
	 *
	 * @return los segundos que faltan, redondeados hacia arriba, o 0 si el
	 *         intento puede seguir
	 */
	long claimAttempt(String email) {
		byte[] emailHash = hash(email);
		OffsetDateTime now = OffsetDateTime.now(clock.withZone(ZoneOffset.UTC));

		// Se purga aquí y no con una tarea programada, que no correría con el
		// servicio suspendido. Borra las de cualquier correo, para que la tabla no
		// crezca con correos que nadie vuelve a intentar; el de este intento, si
		// tenía una vencida, vuelve así a empezar de cero.
		jdbc.sql("delete from login_attempts where retry_at <= ?")
				.param(now.minus(COUNT_LIFETIME))
				.update();

		// El exponente se acota porque el contador no tiene tope y una potencia
		// muy alta se desborda: con 2^5, los 30 segundos ya pasan de los 900.
		int claimed = jdbc.sql("""
				insert into login_attempts (email_hash, failures, retry_at)
				values (:emailHash, 1, :now)
				on conflict (email_hash) do update
				set failures = login_attempts.failures + 1,
				    retry_at = :now + make_interval(secs => case
				        when login_attempts.failures < 5 then 0
				        else least(30 * power(2, least(login_attempts.failures - 5, 5)), 900)
				    end)
				where login_attempts.retry_at <= :now
				""")
				.param("emailHash", emailHash)
				.param("now", now)
				.update();
		if (claimed == 1) {
			return 0;
		}

		// Si ya no hay fila, un inicio de sesión correcto acaba de borrarla.
		return jdbc.sql("select retry_at from login_attempts where email_hash = ?")
				.param(emailHash)
				.query(OffsetDateTime.class)
				.optional()
				.map(retryAt -> secondsUntil(now, retryAt))
				.orElse(0L);
	}

	/** Reinicia el contador del correo, tras un inicio de sesión correcto. */
	void reset(String email) {
		jdbc.sql("delete from login_attempts where email_hash = ?").param(hash(email)).update();
	}

	// Al menos 1: la espera pudo vencer entre las dos sentencias, y este intento
	// ya no quedó anotado.
	private static long secondsUntil(OffsetDateTime now, OffsetDateTime retryAt) {
		return Math.max(1, Duration.between(now, retryAt).plusNanos(999_999_999).toSeconds());
	}

	static byte[] hash(String email) {
		try {
			return MessageDigest.getInstance("SHA-256")
					.digest(AccountService.normalizeEmail(email).getBytes(StandardCharsets.UTF_8));
		} catch (NoSuchAlgorithmException exception) {
			// SHA-256 viene en todas las JVM: no puede faltar.
			throw new IllegalStateException(exception);
		}
	}

}
