import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { NotaMEIError } from './errors.js'

export type ResponseType = 'json' | 'buffer' | 'text'

interface RawRequestOpts {
  method: string
  urlOrPath: string
  body?: unknown
  headers?: Record<string, string>
  responseType: ResponseType
  redirectsLeft?: number
  sendAuth?: boolean
}

export interface HttpClientOpts {
  baseUrl: string
  apiKey: string
  timeout: number
  maxRetries: number
}

export class HttpClient {
  private readonly opts: HttpClientOpts

  constructor(opts: HttpClientOpts) {
    this.opts = opts
  }

  async request<T>(opts: RawRequestOpts): Promise<T> {
    let lastError!: NotaMEIError
    const attempts = 1 + this.opts.maxRetries

    for (let i = 0; i < attempts; i++) {
      if (i > 0) await sleep(1000 * 2 ** (i - 1)) // 1s, 2s, 4s
      try {
        return await this.rawRequest<T>({ ...opts, redirectsLeft: 3, sendAuth: true })
      } catch (err) {
        if (err instanceof NotaMEIError && err.status >= 500) {
          lastError = err
          continue
        }
        throw err
      }
    }
    throw lastError
  }

  private rawRequest<T>(opts: Required<Pick<RawRequestOpts, 'redirectsLeft' | 'sendAuth'>> & RawRequestOpts): Promise<T> {
    const { method, urlOrPath, body, headers: extra = {}, responseType, redirectsLeft, sendAuth } = opts

    return new Promise((resolve, reject) => {
      const url = isAbsolute(urlOrPath)
        ? new URL(urlOrPath)
        : new URL(urlOrPath, this.opts.baseUrl)

      const isHttps = url.protocol === 'https:'
      const requestFn = isHttps ? httpsRequest : httpRequest

      const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : undefined
      const reqHeaders: Record<string, string> = {
        'User-Agent': '@scantelburydevs/notamei/0.1.0',
        Accept: responseType === 'json' ? 'application/json' : '*/*',
        ...extra,
      }
      if (sendAuth) reqHeaders['Authorization'] = `Bearer ${this.opts.apiKey}`
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json'
        reqHeaders['Content-Length'] = String(payload.byteLength)
      }

      const req = requestFn(
        {
          hostname: url.hostname,
          port: url.port !== '' ? Number(url.port) : isHttps ? 443 : 80,
          path: url.pathname + url.search,
          method,
          headers: reqHeaders,
          timeout: this.opts.timeout,
        },
        (res) => {
          if ((res.statusCode === 301 || res.statusCode === 302) && res.headers['location'] && redirectsLeft > 0) {
            res.resume()
            this.rawRequest<T>({ method: 'GET', urlOrPath: res.headers['location'] as string, responseType, redirectsLeft: redirectsLeft - 1, sendAuth: false })
              .then(resolve as (v: T) => void, reject)
            return
          }

          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            const raw = Buffer.concat(chunks)
            const status = res.statusCode ?? 0
            const requestId = res.headers['x-request-id'] as string | undefined

            if (responseType === 'buffer') {
              if (status >= 400) {
                reject(new NotaMEIError('INTERNAL_ERROR', `HTTP ${status}`, status, requestId))
              } else {
                resolve(raw as unknown as T)
              }
              return
            }

            const text = raw.toString('utf8')

            if (responseType === 'text') {
              if (status >= 400) {
                reject(new NotaMEIError('INTERNAL_ERROR', `HTTP ${status}: ${text}`, status, requestId))
              } else {
                resolve(text as unknown as T)
              }
              return
            }

            // json
            let parsed: unknown
            try {
              parsed = JSON.parse(text)
            } catch {
              reject(new NotaMEIError('INTERNAL_ERROR', `Resposta inválida do servidor (HTTP ${status})`, status, requestId))
              return
            }

            if (status >= 400) {
              const e = parsed as { error?: string; message?: string; request_id?: string; fields?: Array<{ field: string; message: string }> }
              reject(new NotaMEIError(e.error ?? 'INTERNAL_ERROR', e.message ?? 'Erro desconhecido', status, e.request_id ?? requestId, e.fields))
              return
            }

            resolve(parsed as T)
          })
          res.on('error', (err: Error) => reject(new NotaMEIError('NETWORK_ERROR', err.message, 0)))
        },
      )

      req.on('error', (err: Error) => reject(new NotaMEIError('NETWORK_ERROR', err.message, 0)))
      req.on('timeout', () => {
        req.destroy()
        reject(new NotaMEIError('NETWORK_ERROR', 'Requisição expirou (timeout)', 0))
      })

      if (payload) req.write(payload)
      req.end()
    })
  }
}

function isAbsolute(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
