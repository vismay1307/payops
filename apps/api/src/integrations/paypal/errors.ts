export interface PayPalErrorInit {
  status: number;
  code: string;
  message: string;
  debugId?: string | undefined;
  details?: unknown;
  retriable?: boolean;
}

/** One normalized error for every failed PayPal call. */
export class PayPalError extends Error {
  readonly status: number;
  readonly code: string;
  readonly debugId: string | undefined;
  readonly details: unknown;
  readonly retriable: boolean;

  constructor(init: PayPalErrorInit) {
    super(init.message);

    this.name = 'PayPalError';
    this.status = init.status;
    this.code = init.code;
    this.debugId = init.debugId;
    this.details = init.details;
    this.retriable = init.retriable ?? false;
  }
}
