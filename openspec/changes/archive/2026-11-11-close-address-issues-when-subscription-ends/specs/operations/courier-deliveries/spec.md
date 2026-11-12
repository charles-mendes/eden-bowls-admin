# Spec Delta

## MODIFIED Requirements

### Requirement: A row shows the address problem and the email

When a row has `address_issue`, it MUST show the email state: "E-mail enviado em dd/mm", "E-mail não enviado", "Sem correção há N dias" when open for more than 2 days, or, once resolved, the text of its `resolved_by`: "Cliente corrigiu em dd/mm" (`customer`), "Operador corrigiu em dd/mm" (`operator`), "Assinatura encerrada em dd/mm" (`ended`), or "Substituído em dd/mm" (`superseded` or any other value).

#### Scenario: Open for 4 days

- **WHEN** a row's problem opened 4 days ago and its email went out the same day
- **THEN** the row shows "E-mail enviado em" with that date and "Sem correção há 4 dias"

#### Scenario: Closed by an operator

- **WHEN** a row's problem was closed on 5 November with `resolved_by: operator`
- **THEN** the row shows "Operador corrigiu em 05/11" and not "Substituído"

#### Scenario: Closed because the subscription ended

- **WHEN** a problem was closed on 5 November with `resolved_by: ended`
- **THEN** it shows "Assinatura encerrada em 05/11"
