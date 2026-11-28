/**
 * Result<Failure, Success> — jawny wynik operacji zamiast rzucania wyjątków.
 *
 *   const result = await createTimeEntry(input)
 *   if (!result.ok) return showError(result.error)   // TS wie, że to Failure
 *   result.value                                     // TS wie, że to Success
 */
export interface Success<TValue> {
  readonly ok: true
  readonly value: TValue
}
export interface Failure<TError> {
  readonly ok: false
  readonly error: TError
}
export type Result<TError, TValue> = Failure<TError> | Success<TValue>

export const success = <TValue>(value: TValue): Success<TValue> => ({
  ok: true,
  value,
})
export const failure = <TError>(error: TError): Failure<TError> => ({
  ok: false,
  error,
})

export const isSuccess = <TError, TValue>(
  result: Result<TError, TValue>,
): result is Success<TValue> => result.ok

export const isFailure = <TError, TValue>(
  result: Result<TError, TValue>,
): result is Failure<TError> => !result.ok

export interface MatchHandlers<TError, TValue, TOut> {
  success: (value: TValue) => TOut
  failure: (error: TError) => TOut
}

export function match<TError, TValue, TOut>(
  result: Result<TError, TValue>,
  handlers: MatchHandlers<TError, TValue, TOut>,
): TOut {
  return result.ok
    ? handlers.success(result.value)
    : handlers.failure(result.error)
}

export function map<TError, TValue, TOut>(
  result: Result<TError, TValue>,
  callback: (value: TValue) => TOut,
): Result<TError, TOut> {
  return result.ok ? success(callback(result.value)) : result
}

export function mapError<TError, TOutError, TValue>(
  result: Result<TError, TValue>,
  callback: (error: TError) => TOutError,
): Result<TOutError, TValue> {
  return result.ok ? result : failure(callback(result.error))
}

export function unwrapOr<TError, TValue>(
  result: Result<TError, TValue>,
  fallback: TValue,
): TValue {
  return result.ok ? result.value : fallback
}
