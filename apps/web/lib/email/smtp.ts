// Cliente SMTP mínimo (STARTTLS + AUTH PLAIN) para o relay de e-mail.
//
// Por que existe: o Railway (API Go) bloqueia SMTP de saída e a API HTTP do
// Brevo pode recusar por bloqueio de IP. O Vercel consegue falar SMTP, então
// a API usa /api/interno/email como último fallback (ver apps/api/pkg/email).
// Sem dependência nova de propósito — o build do Vercel é estrito com lockfile.
import net from 'node:net'
import tls from 'node:tls'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
}

export interface SmtpMensagem {
  from: string // "Nome <email@dominio>"
  to: string
  subject: string
  html: string
}

function enderecoDe(addr: string): string {
  const m = addr.match(/<([^>]+)>/)
  return (m ? m[1] : addr).trim()
}

function encodeHeader(v: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`
}

function formatarFrom(from: string): string {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (!m || !m[1]) return enderecoDe(from)
  return `${encodeHeader(m[1].replace(/^"|"$/g, ''))} <${m[2]}>`
}

export function montarMensagem(m: SmtpMensagem, msgId: string): string {
  const corpo = Buffer.from(m.html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n')
  return [
    `From: ${formatarFrom(m.from)}`,
    `To: ${enderecoDe(m.to)}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Message-ID: ${msgId}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    corpo,
  ].join('\r\n')
}

/** Lê respostas SMTP (inclusive multilinha "250-...") de um socket. */
class Leitor {
  private buf = ''
  private esperando: ((linhas: string) => void) | null = null
  private erro: ((e: Error) => void) | null = null
  private sock: net.Socket | tls.TLSSocket | null = null
  private readonly onData = (d: Buffer) => { this.buf += d.toString('utf8'); this.tentar() }
  private readonly onErro = (e: Error) => this.erro?.(e)

  constructor(sock: net.Socket | tls.TLSSocket) {
    this.anexar(sock)
  }

  /** Passa a ler de outro socket (após STARTTLS o socket cru traz bytes cifrados). */
  anexar(sock: net.Socket | tls.TLSSocket) {
    this.sock?.off('data', this.onData)
    this.sock?.off('error', this.onErro)
    this.buf = ''
    this.sock = sock
    sock.on('data', this.onData)
    sock.on('error', this.onErro)
  }

  private tentar() {
    if (!this.esperando) return
    const linhas = this.buf.split('\r\n')
    for (let i = 0; i < linhas.length - 1; i++) {
      if (/^\d{3} /.test(linhas[i])) {
        const resp = linhas.slice(0, i + 1).join('\n')
        this.buf = linhas.slice(i + 1).join('\r\n')
        const cb = this.esperando
        this.esperando = null
        cb(resp)
        return
      }
    }
  }

  ler(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.esperando = resolve
      this.erro = reject
      this.tentar()
    })
  }
}

export async function enviarSmtp(cfg: SmtpConfig, m: SmtpMensagem, timeoutMs = 20_000): Promise<string> {
  const dominio = enderecoDe(m.from).split('@')[1] ?? 'emitirnotafacil.com.br'
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}.relay@${dominio}>`

  let sock: net.Socket | tls.TLSSocket = net.connect({ host: cfg.host, port: cfg.port })
  sock.setTimeout(timeoutMs, () => sock.destroy(new Error('timeout SMTP')))
  const leitor = new Leitor(sock)

  const esperar = async (codigo: string, etapa: string) => {
    const r = await leitor.ler()
    if (!r.startsWith(codigo)) throw new Error(`SMTP ${etapa}: ${r.slice(0, 200)}`)
    return r
  }
  const cmd = async (linha: string, codigo: string, etapa: string) => {
    sock.write(linha + '\r\n')
    return esperar(codigo, etapa)
  }

  try {
    await new Promise<void>((res, rej) => { sock.once('connect', res); sock.once('error', rej) })
    await esperar('220', 'saudação')
    const ehlo = await cmd(`EHLO ${dominio}`, '250', 'EHLO')
    if (!/STARTTLS/i.test(ehlo)) throw new Error('servidor sem STARTTLS')
    await cmd('STARTTLS', '220', 'STARTTLS')

    const seguro = tls.connect({ socket: sock as net.Socket, servername: cfg.host, minVersion: 'TLSv1.2' })
    leitor.anexar(seguro)
    await new Promise<void>((res, rej) => { seguro.once('secureConnect', res); seguro.once('error', rej) })
    seguro.setTimeout(timeoutMs, () => seguro.destroy(new Error('timeout SMTP')))
    sock = seguro

    await cmd(`EHLO ${dominio}`, '250', 'EHLO (TLS)')
    const plain = Buffer.from(`\0${cfg.user}\0${cfg.pass}`, 'utf8').toString('base64')
    await cmd(`AUTH PLAIN ${plain}`, '235', 'AUTH')
    await cmd(`MAIL FROM:<${enderecoDe(m.from)}>`, '250', 'MAIL FROM')
    await cmd(`RCPT TO:<${enderecoDe(m.to)}>`, '25', 'RCPT TO')
    await cmd('DATA', '354', 'DATA')
    // dot-stuffing: linha que começa com "." ganha outro "."
    const dados = montarMensagem(m, msgId).replace(/\r\n\./g, '\r\n..')
    await cmd(`${dados}\r\n.`, '250', 'envio')
    sock.write('QUIT\r\n')
    return msgId
  } finally {
    setTimeout(() => sock.destroy(), 200)
  }
}
