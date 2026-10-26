package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.UnavailableException;

/**
 * Se agotó la transferencia de este ciclo de facturación (historia HU411). Solo
 * dejan de entregarse apuntes; lo demás sigue igual.
 */
class DocumentTransferExhaustedException extends UnavailableException {

	DocumentTransferExhaustedException() {
		super("DOCUMENT_TRANSFER_EXHAUSTED",
				"Los apuntes no están disponibles por ahora. El catálogo y los videos siguen funcionando.",
				null);
	}

}
