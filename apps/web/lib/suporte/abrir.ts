// Canal de suporte visível em qualquer tela (#258).
//
// O chat (SupportChat, montado no layout do dashboard) escuta este evento;
// qualquer botão "Falar com o suporte" só precisa chamar abrirSuporte().

export const EVENTO_ABRIR_SUPORTE = 'nf:abrir-suporte'

export function abrirSuporte(mensagem?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_SUPORTE, { detail: { mensagem } }))
}

/** WhatsApp Business do suporte (só dígitos, com DDI). */
export const SUPORTE_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '5547997352380').replace(/\D/g, '')

export function linkWhatsAppSuporte(texto = 'Olá! Preciso de ajuda com o NotaFácil.') {
  return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(texto)}`
}
