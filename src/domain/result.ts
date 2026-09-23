import type { AppError } from './errors'

export type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError }

export function success<T>(value: T): OperationResult<T> {
  return { ok: true, value }
}

export function failure<T = never>(error: AppError): OperationResult<T> {
  return { ok: false, error }
}
