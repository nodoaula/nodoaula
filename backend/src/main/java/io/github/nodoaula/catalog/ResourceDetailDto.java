package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

/**
 * Vista pública de la ficha de un recurso (historia HU108): los nueve campos
 * vigentes del esquema de metadatos, más su identificador y el de su curso,
 * con el que la ficha enlaza al catálogo filtrado por ese curso. Los opcionales
 * (descripción, fecha de publicación, duración y canal) llegan como null
 * cuando no se registraron.
 * Nunca la entidad, según ADR-008.
 *
 * canEdit dice si quien la ve puede corregir el recurso (historia HU311): sin
 * sesión, siempre false. Así el frontend muestra u oculta la acción sin
 * conocer al autor ni repetir la regla, que solo vive en el servicio.
 *
 * Con el mismo criterio, canRetire y canRepublish dicen si quien la ve puede
 * retirarlo o volver a publicarlo (historia HU307). La ficha de un recurso
 * retirado llega con retired en true y sin su contenido, para que lo retirado
 * por moderación no siga a la vista por enlace directo: solo el identificador
 * y, para quien puede volver a publicarlo, el título; lo demás en null, sin
 * temas y sin permiso de corrección.
 *
 * pageCount y fileSizeBytes describen el archivo de un apunte (historia
 * HU411); en un video llegan en null.
 */
public record ResourceDetailDto(
		Long id,
		String title,
		String description,
		LocalDate publishedAt,
		Integer durationSeconds,
		String channel,
		String url,
		ResourceType resourceType,
		Long courseId,
		String course,
		List<String> topics,
		boolean canEdit,
		boolean retired,
		boolean canRetire,
		boolean canRepublish,
		Integer pageCount,
		Long fileSizeBytes) {
}
