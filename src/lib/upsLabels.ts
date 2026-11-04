// Why a UPS label cannot be bought, in the words the operator reads in the panel.
export type LabelIssue = { code: string }

export function labelIssueText(issue: LabelIssue): string {
  switch (issue.code) {
    case 'po_box_not_allowed':
      return 'O endereço de entrega é um PO Box, onde a UPS não entrega. O cliente corrige em Meu Plano, na loja.'
    case 'military_address_not_supported':
      return 'O endereço é militar (APO, FPO ou DPO), onde a UPS não entrega. O cliente corrige em Meu Plano, na loja.'
    case 'address_incomplete':
      return 'Falta rua, cidade, estado ou ZIP no endereço de entrega. O cliente corrige em Meu Plano, na loja.'
    case 'ship_from_missing':
      return 'O endereço de origem dos EUA não está preenchido.'
    case 'recipient_name_missing':
      return 'A assinatura não tem nome de quem recebe e a conta não tem nome válido para a etiqueta. O cliente informa quem recebe em Meu Plano, na loja, ou você preenche o nome da conta.'
    case 'ups_not_configured':
      return 'As credenciais da UPS não estão configuradas na API.'
    default:
      return `Etiqueta bloqueada: ${issue.code}.`
  }
}
