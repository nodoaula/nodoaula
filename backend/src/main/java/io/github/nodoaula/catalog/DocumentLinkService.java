package io.github.nodoaula.catalog;

import java.time.Duration;

import org.springframework.stereotype.Service;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.TransferQuota;

/**
 * Enlaces firmados al archivo de un apunte (historia HU411). Cada enlace cuenta
 * el archivo entero para el tope de transferencia, y si ya no cabe no se firma.
 *
 * Sin @Transactional: el contador confirma su suma por su cuenta, y la llamada
 * a Supabase no debe retener una conexión de la base.
 */
@Service
class DocumentLinkService {

	private static final Duration LINK_VALIDITY = Duration.ofSeconds(60);

	private final ResourceRepository resourceRepository;
	private final TransferQuota transferQuota;
	private final FileStorage fileStorage;

	DocumentLinkService(ResourceRepository resourceRepository, TransferQuota transferQuota, FileStorage fileStorage) {
		this.resourceRepository = resourceRepository;
		this.transferQuota = transferQuota;
		this.fileStorage = fileStorage;
	}

	DocumentLinkDto issueLink(Long resourceId) {
		Resource resource = resourceRepository.findById(resourceId).orElseThrow(ResourceNotFoundException::new);
		if (resource.isRetired()) {
			throw new ResourceRetiredException();
		}
		DocumentFile file = resource.getFile();
		if (file == null) {
			throw new DocumentFileNotFoundException();
		}
		if (!transferQuota.reserve(file.sizeBytes())) {
			throw new DocumentTransferExhaustedException();
		}
		return new DocumentLinkDto(fileStorage.signedUrl(file.key(), LINK_VALIDITY).toString());
	}

}
