Ajustei o simulador em /nutrition/simulate conforme o contexto do bug.

Idade (BR e US)
O campo deixou de ser só “anos”. Agora tem número + unidade Anos/Meses (Years/Months), com exemplo de filhote de 2 meses. Um pet de 2 meses vai no payload como age_years: 0 e age_months: 2.

Peso no US
O rótulo passou de Weight (kg) para Weight (lb). Ao trocar o país, o valor é convertido (10 kg ≈ 22 lb). O motor recebe weight_unit: 'lb' ou 'kg'.

Castrado / Neutered
O checkbox não estica mais na grade. Ficou no mesmo padrão dos outros campos: rótulo em cima e controle com Sim/Não (Yes/No).

Labels em inglês no US

Activity: Low / Moderate / High
Body score: Underweight / Ideal / Overweight
Os valores enviados ao backend continuam BAIXO, ADEQUADO, etc.

O backend do simulador passou a aceitar age_months e weight_unit para o cálculo bater com o que a tela envia.