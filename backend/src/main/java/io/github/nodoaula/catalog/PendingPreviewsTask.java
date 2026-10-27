package io.github.nodoaula.catalog;

import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.StorageUnavailableException;
import io.github.nodoaula.shared.storage.TransferQuota;

/**
 * Genera la vista previa de los apuntes subidos antes de la historia HU412.
 * Corre en segundo plano al arrancar, para no alargar el arranque en frío, y
 * cuando ya no queda ninguno no hace nada. Es temporal: se borra después de
 * verla correr en producción.
 */
@Component
class PendingPreviewsTask {

	private static final Logger log = LoggerFactory.getLogger(PendingPreviewsTask.class);

	private final ResourceRepository resourceRepository;
	private final FileStorage fileStorage;
	private final TransferQuota transferQuota;
	private final TransactionTemplate transactionTemplate;
	private final TaskExecutor taskExecutor;
	// Las pruebas la apagan: con la base local de un desarrollador descargaría
	// de Supabase en cada contexto.
	private final boolean onStartup;

	PendingPreviewsTask(ResourceRepository resourceRepository, FileStorage fileStorage, TransferQuota transferQuota,
			TransactionTemplate transactionTemplate, TaskExecutor taskExecutor,
			@Value("${pending-previews.on-startup:true}") boolean onStartup) {
		this.resourceRepository = resourceRepository;
		this.fileStorage = fileStorage;
		this.transferQuota = transferQuota;
		this.transactionTemplate = transactionTemplate;
		this.taskExecutor = taskExecutor;
		this.onStartup = onStartup;
	}

	@EventListener(ApplicationReadyEvent.class)
	void onApplicationReady() {
		if (onStartup) {
			taskExecutor.execute(this::generatePendingPreviews);
		}
	}

	/**
	 * Un apunte que falla, también uno cuya vista previa no cabe, queda en el
	 * log y no detiene a los demás. Sin transferencia o con el almacenamiento
	 * lleno no se descarga ninguno más: se intentará en el próximo arranque.
	 */
	void generatePendingPreviews() {
		for (Resource document : resourceRepository.findDocumentsWithoutPreview()) {
			if (PdfDocuments.previewPageCount(document.getFile().pageCount()) == 0) {
				continue;
			}
			if (resourceRepository.totalStoredBytes() >= ResourceService.STORAGE_LIMIT_BYTES) {
				log.warn("Sin espacio en el almacenamiento para las vistas previas pendientes");
				return;
			}
			try {
				generatePreview(document);
			} catch (DocumentTransferExhaustedException _) {
				log.warn("Sin transferencia para generar las vistas previas pendientes");
				return;
			} catch (RuntimeException exception) {
				log.error("No se pudo generar la vista previa del apunte {}", document.getId(), exception);
			}
		}
	}

	private void generatePreview(Resource document) {
		DocumentFile file = document.getFile();
		if (!transferQuota.reserve(file.sizeBytes())) {
			throw new DocumentTransferExhaustedException();
		}
		Path original = TempFiles.create("apunte-");
		try {
			Path previewPdf = TempFiles.create("vista-previa-");
			try {
				fileStorage.download(file.key(), original);
				int pages = PdfDocuments.previewPageCount(file.pageCount());
				long bytes = PdfDocuments.writePreview(original, pages, previewPdf);
				if (resourceRepository.totalStoredBytes() + bytes > ResourceService.STORAGE_LIMIT_BYTES) {
					throw new DocumentStorageFullException();
				}
				DocumentPreview preview = new DocumentPreview(DocumentPreview.keyFor(file.key()), bytes, pages);
				// Una ejecución anterior pudo guardarla sin llegar a registrarla, y
				// guardar nunca reemplaza un archivo.
				fileStorage.delete(preview.key());
				fileStorage.store(preview.key(), previewPdf, MediaType.APPLICATION_PDF_VALUE);
				registerOrDelete(document.getId(), preview);
				log.info("Vista previa del apunte {} generada: {} de {} páginas", document.getId(), pages,
						file.pageCount());
			} finally {
				TempFiles.delete(previewPdf);
			}
		} finally {
			TempFiles.delete(original);
		}
	}

	private void registerOrDelete(Long resourceId, DocumentPreview preview) {
		try {
			transactionTemplate.executeWithoutResult(
					status -> resourceRepository.findById(resourceId).orElseThrow().attachPreview(preview));
		} catch (RuntimeException exception) {
			try {
				fileStorage.delete(preview.key());
			} catch (StorageUnavailableException deletion) {
				log.error("La vista previa {} quedó en el almacenamiento sin registrar", preview.key(), deletion);
			}
			throw exception;
		}
	}

}
