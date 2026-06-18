/**
 * Ограничивает время ожидания промиса (сеть, Supabase).
 */
export function withTimeout(promise, ms, message = 'Превышено время ожидания') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
