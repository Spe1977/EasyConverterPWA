/**
 * Opzioni per la retry logic
 */
export interface RetryOptions {
  maxAttempts: number; // Numero massimo di tentativi
  initialDelay: number; // Delay iniziale in ms
  maxDelay: number; // Delay massimo in ms
  backoffMultiplier: number; // Moltiplicatore per exponential backoff
  onRetry?: (attempt: number, error: Error) => void; // Callback chiamato ad ogni retry
}

/**
 * Esegue una funzione con retry logic ed exponential backoff
 * @param fn Funzione da eseguire (deve ritornare una Promise)
 * @param options Opzioni per il retry
 * @returns Promise con il risultato della funzione
 * @throws L'ultimo errore se tutti i tentativi falliscono
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, initialDelay, maxDelay, backoffMultiplier, onRetry } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Se è l'ultimo tentativo, rilancia l'errore
      if (attempt === maxAttempts) {
        break;
      }

      // Chiama il callback onRetry se presente
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Calcola il delay per il prossimo tentativo (exponential backoff)
      const currentDelay = Math.min(delay, maxDelay);

      console.warn(
        `Retry attempt ${attempt}/${maxAttempts} after ${currentDelay}ms. Error: ${lastError.message}`
      );

      // Aspetta prima di ritentare
      await sleep(currentDelay);

      // Incrementa il delay per il prossimo tentativo
      delay *= backoffMultiplier;
    }
  }

  // Se arriviamo qui, tutti i tentativi sono falliti
  throw lastError!;
}

/**
 * Sleep function helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
