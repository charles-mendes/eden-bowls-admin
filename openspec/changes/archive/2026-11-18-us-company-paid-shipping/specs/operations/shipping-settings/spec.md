# Spec Delta

## ADDED Requirements

### Requirement: US rules switch shipping charges on and off

The US rules MUST show "Cobrar frete do cliente", an on/off switch for `us.charge_shipping`, saved with the other US rules by an operator with `shipping.write` on the US market, including a US-only operator. Without `shipping.write` the switch MUST be disabled. Before saving a changed value, the panel MUST ask for confirmation, saying that the change applies to new checkouts only and that each subscription keeps the condition it was checked out with. A 422 `invalid_charge_shipping` MUST show "Não foi possível salvar a cobrança de frete.", keeping the typed values. The hint MUST say that, while off, the customer sees the original price struck through and "FREE", and the company pays the shipping.

#### Scenario: US operator turns charges on

- **WHEN** a US-only operator with `shipping.write` turns the switch on, confirms and saves
- **THEN** the request carries `us.charge_shipping` true and the screen shows the switch on

#### Scenario: Confirmation cancelled

- **WHEN** an operator turns the switch and cancels the confirmation
- **THEN** no request is sent and the switch goes back to its saved value

#### Scenario: Read-only operator

- **WHEN** an operator without `shipping.write` opens the US rules
- **THEN** the switch is disabled and the history is shown

### Requirement: US rules show the history of the switch

Below the switch, the panel MUST list `us.charge_shipping_history`, newest first, each line with the date and time in the US market's time zone (America/New_York), whatever the browser's time zone, the operator's email, and "Cobrança ligada" or "Cobrança desligada". With no event it MUST show "Nenhuma alteração ainda". After a save the list MUST show the new event from the API's answer.

#### Scenario: Two changes

- **WHEN** the history has an enable by ana@ on 18/11 10:00 and a disable by rui@ on 19/11 09:30
- **THEN** the list shows the disable first, then the enable, with dates, emails and labels

#### Scenario: Browser in Brazil

- **WHEN** an event was saved at 2026-11-18T15:00:00Z and the operator's browser is in America/Sao_Paulo
- **THEN** the list shows "18 de nov. de 2026, 10:00", the New York time in the format of the panel's other histories

#### Scenario: Empty history

- **WHEN** the history is empty
- **THEN** the list shows "Nenhuma alteração ainda"

### Requirement: The US simulation shows what the customer pays

The US quote simulation MUST show the quoted amount as "Valor do frete" and, below it, "Cliente paga: FREE" while `charge_shipping` is off or "Cliente paga: US$ <valor>" while it is on, from the simulation's `charged_amount`.

#### Scenario: Charges off

- **WHEN** an operator simulates a US quote of US$ 18.40 with charges off
- **THEN** the panel shows "Valor do frete: US$ 18.40" and "Cliente paga: FREE"
