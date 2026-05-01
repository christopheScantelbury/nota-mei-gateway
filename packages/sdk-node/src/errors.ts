export type ErrorCode =
  | 'INVALID_API_KEY'
  | 'PLAN_LIMIT_REACHED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'VALIDATION_ERROR'
  | 'RECEITA_REJECTION'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

export interface FieldError {
  field: string
  message: string
}

export class NotaMEIError extends Error {
  readonly code: ErrorCode | string
  readonly status: number
  readonly requestId: string | undefined
  readonly fields: FieldError[] | undefined

  constructor(
    code: string,
    message: string,
    status: number,
    requestId?: string,
    fields?: FieldError[],
  ) {
    super(message)
    this.name = 'NotaMEIError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.fields = fields
  }
}
