// Why a UPS label cannot be bought, in the words the operator reads in the panel.
export type LabelIssue = { code: string }

export function labelIssueText(issue: LabelIssue): string {
  switch (issue.code) {
    case 'po_box_not_allowed':
      return 'O endereço de entrega é um PO Box, onde a UPS não entrega. O cliente corrige o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'military_address_not_supported':
      return 'O endereço é militar (APO, FPO ou DPO), onde a UPS não entrega. O cliente corrige o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'address_incomplete':
      return 'Falta rua, cidade, estado ou ZIP no endereço de entrega. O cliente completa o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'ship_from_missing':
      return 'O endereço de origem dos EUA não está preenchido.'
    case 'recipient_name_missing':
      return 'Falta o nome de quem recebe na assinatura. O cliente informa quem recebe em Meu Plano, na loja (numa assinatura antiga, pode ajustar o nome em Meu Perfil). Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'ups_not_configured':
      return 'As credenciais da UPS não estão configuradas na API.'
    default:
      return `Etiqueta bloqueada: ${issue.code}.`
  }
}
