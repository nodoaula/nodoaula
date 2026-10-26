package io.github.nodoaula.shared.storage;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Presupuesto de transferencia del almacenamiento en cada ciclo de facturación
 * de Supabase. El plan gratuito no admite pasarse: al agotar el cupo restringe
 * el proyecto entero, base de datos incluida. Supabase no expone el consumo por
 * API, así que se cuenta aquí, por lo alto: cada enlace entregado suma el
 * tamaño completo del archivo, se descargue o no.
 */
@Component
public class TransferQuota {

	// 4 GB de los 5 GB sin caché del plan: el resto queda para la base de datos.
	static final long LIMIT_BYTES = 4_000_000_000L;

	private static final int BILLING_CYCLE_DAY = 19;

	private final JdbcClient jdbc;
	private final Clock clock;

	@Autowired
	TransferQuota(JdbcClient jdbc) {
		this(jdbc, Clock.systemUTC());
	}

	// Las pruebas fijan el reloj para elegir el ciclo.
	TransferQuota(JdbcClient jdbc, Clock clock) {
		this.jdbc = jdbc;
		this.clock = clock;
	}

	/**
	 * Suma esos bytes al ciclo actual si caben bajo el tope. Comprobar y sumar
	 * son una sola sentencia: dos peticiones a la vez no pueden pasarse del tope
	 * entre las dos.
	 *
	 * @return false si no caben, y entonces no se suma nada
	 */
	public boolean reserve(long bytes) {
		int updated = jdbc.sql("""
				insert into storage_transfer (cycle_start, bytes)
				select :cycleStart, :bytes where :bytes <= :limit
				on conflict (cycle_start) do update set bytes = storage_transfer.bytes + excluded.bytes
				where storage_transfer.bytes + excluded.bytes <= :limit
				""")
				.param("cycleStart", cycleStart(LocalDate.now(clock)))
				.param("bytes", bytes)
				.param("limit", LIMIT_BYTES)
				.update();
		return updated == 1;
	}

	static LocalDate cycleStart(LocalDate today) {
		LocalDate thisMonth = today.withDayOfMonth(BILLING_CYCLE_DAY);
		return today.isBefore(thisMonth) ? thisMonth.minusMonths(1) : thisMonth;
	}

}
