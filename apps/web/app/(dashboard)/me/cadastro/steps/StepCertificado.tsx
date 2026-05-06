'use client'

import { useState, useRef } from 'react'
import type { CadastroMEState } from '../actions'

interface Props {
  state: CadastroMEState
  onChange: (partial: Partial<CadastroMEState>) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full'

export function StepCertificado({ state, onChange, onSubmit, onBack, loading }: Props) {
  const [certError, setCertError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) {
      setCertError('Somente arquivos .pfx ou .p12 são aceitos')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCertError('O certificado não pode ser maior que 5MB')
      e.target.value = ''
      return
    }

    setCertError('')
    onChange({ certFile: file })
  }

  const canSubmit =
    !loading &&
    state.certFile !== undefined &&
    (state.certPassword?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-1">Certificado A1</h2>
        <p className="text-sm text-text-2 mt-1">
          O certificado digital é obrigatório para assinar e enviar NFS-e à Receita Federal.
        </p>
      </div>

      {/* Security notice */}
      <div className="rounded-xl border border-nota-processando/30 bg-nota-processando/10 p-4 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-nota-processando mt-0.5">🔒</span>
          <div>
            <p className="font-semibold text-nota-processando">Armazenamento seguro</p>
            <p className="text-text-2 mt-0.5">
              Seu certificado é criptografado com AES-256 e armazenado no{' '}
              <strong className="text-text-1">AWS Secrets Manager</strong>. Nunca é
              salvo em disco nem exposto em nenhum endpoint da plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* File upload */}
      <div>
        <p className="text-sm font-medium text-text-1 mb-2">
          Arquivo do certificado <span className="text-nota-rejeitada">*</span>
        </p>
        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer hover:border-brand-cyan ${
            state.certFile
              ? 'border-nota-autorizada bg-nota-autorizada/5'
              : 'border-navy-600 bg-navy-700/30'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          {state.certFile ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-nota-autorizada">{state.certFile.name}</p>
                <p className="text-xs text-text-2">{formatBytes(state.certFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onChange({ certFile: undefined })
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="ml-2 text-xs text-text-2 hover:text-nota-rejeitada transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <div>
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-sm font-medium text-text-1">Clique para selecionar o arquivo</p>
              <p className="text-xs text-text-2 mt-1">Aceita .pfx ou .p12 · máximo 5MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pfx,.p12"
          onChange={handleFile}
          className="hidden"
        />
        {certError && <p className="text-xs text-nota-rejeitada mt-1">{certError}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="text-sm font-medium text-text-1 mb-2 flex items-center gap-1">
          Senha do certificado <span className="text-nota-rejeitada">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className={inputCls}
            placeholder="Senha definida na emissão do certificado"
            value={state.certPassword ?? ''}
            onChange={e => onChange({ certPassword: e.target.value })}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text-1 transition text-xs"
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
        <p className="text-xs text-text-2 mt-1">
          A senha é usada para decodificar o certificado durante a assinatura das notas.
        </p>
      </div>

      {/* Cert info preview (when file selected) */}
      {state.certFile && (
        <div className="rounded-lg border border-navy-600 bg-navy-700/50 px-4 py-3 text-xs text-text-2">
          <p className="font-medium text-text-1 mb-1">📋 Certificado selecionado</p>
          <p>Arquivo: <span className="font-mono text-text-1">{state.certFile.name}</span></p>
          <p>Tamanho: {formatBytes(state.certFile.size)}</p>
          <p className="mt-1 text-text-2/70">
            A validade do certificado será verificada após o envio.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="border border-navy-600 text-text-2 font-semibold px-6 py-3 rounded-xl hover:border-brand-cyan hover:text-text-1 transition disabled:opacity-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex-1 flex items-center justify-center gap-2 bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Cadastrando...
            </>
          ) : (
            'Finalizar cadastro'
          )}
        </button>
      </div>
    </div>
  )
}
