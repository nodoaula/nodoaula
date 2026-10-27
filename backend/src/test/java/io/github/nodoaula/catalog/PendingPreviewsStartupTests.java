package io.github.nodoaula.catalog;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;
import org.springframework.transaction.support.TransactionTemplate;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.TransferQuota;

/** Cubre cuándo arranca la tarea de las vistas previas pendientes (historia HU412). */
class PendingPreviewsStartupTests {

	private final TaskExecutor taskExecutor = mock(TaskExecutor.class);

	@Test
	void onStartupItRunsInTheBackground() {
		task(true).onApplicationReady();

		verify(taskExecutor).execute(any());
	}

	@Test
	void turnedOffItDoesNotRun() {
		task(false).onApplicationReady();

		verifyNoInteractions(taskExecutor);
	}

	private PendingPreviewsTask task(boolean onStartup) {
		return new PendingPreviewsTask(mock(ResourceRepository.class), mock(FileStorage.class),
				mock(TransferQuota.class), mock(TransactionTemplate.class), taskExecutor, onStartup);
	}

}
