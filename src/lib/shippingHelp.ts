// Help of each field of Regras de frete (/config/shipping), as the API applies it (shipping.service, shipping-fee,
// shipping-boxes). One string per paragraph; a lead ending in ":" shows in bold.
export const SHIPPING_HELP = {
  br: {
    enabled: [
      'Liga ou desliga a entrega própria no Brasil.',
      'Ligado: a loja calcula o frete para CEPs dentro do raio de entrega.',
      'Desligado: a loja não cota frete para nenhum CEP brasileiro, e ninguém consegue assinar no Brasil.',
    ],
    radius: [
      'Distância máxima entre a sede e o endereço do cliente.',
      'Como mede: pela rota de carro. Se a rota não puder ser calculada, usa a linha reta × fator de correção.',
      'Acima do raio: o CEP aparece como fora da área de entrega e o cliente não consegue assinar.',
    ],
    perKm: [
      'Quanto se cobra por km entre a sede e o cliente.',
      'Cálculo: distância × valor por km. Depois valem a taxa mínima e a taxa máxima, se houver.',
    ],
    deliveryDays: [
      'Quantos dias úteis depois do preparo a entrega chega ao cliente. Vale para todo CEP dentro do raio.',
      'Dias úteis: pula sábado, domingo e os dias marcados como fechados para entrega em Feriados e fechamentos. Ex.: preparo na sexta com 2 dias úteis entrega na terça.',
      'Onde aparece: a data de entrega do checkout, do e-mail do pedido, da fila de produção e do painel do cliente.',
      'Mesmo dia: a entrega sai no dia do preparo.',
    ],
    label: [
      'Nome do frete que a loja mostra ao cliente quando calcula o frete, por exemplo "Entrega Eden Bowls".',
    ],
    minFee: [
      'Menor valor de frete cobrado.',
      'Quando vale: quando o cliente mora perto e distância × valor por km dá menos que este valor. Aí cobra-se a taxa mínima.',
      '0 desliga: o frete fica só distância × valor por km.',
    ],
    maxFee: [
      'Maior valor de frete cobrado.',
      'Quando vale: se distância × valor por km passar deste valor, cobra-se este valor.',
      'Vazio: sem limite.',
    ],
    roadFactor: [
      'Plano B do cálculo de distância.',
      'Quando vale: só quando a rota de carro não pode ser calculada. A distância vira a linha reta entre a sede e o cliente × este fator, porque o caminho pelas ruas é mais longo que a linha reta.',
      'Ex.: 1,3 considera o caminho 30% maior que a linha reta.',
    ],
  },
  us: {
    chargeShipping: [
      'Liga ou desliga a cobrança do frete do cliente nos Estados Unidos.',
      'Desligado: o cliente vê o valor original riscado e FREE, e a empresa paga o frete. A cotação UPS fica gravada como custo da empresa.',
      'Ligado: o cliente paga o frete cotado.',
      'A mudança vale só para checkouts novos. Cada assinatura mantém a condição com que foi contratada.',
    ],
    enabled: [
      'Liga ou desliga a entrega nos Estados Unidos.',
      'Ligado: a loja cota o frete para os ZIPs americanos, pelo modo de cotação escolhido.',
      'Desligado: a loja não cota frete para nenhum ZIP, e ninguém consegue assinar nos EUA.',
    ],
    quoteMode: [
      'UPS: a loja pergunta à UPS, na hora, o valor e o prazo para o ZIP do cliente.',
      'Valor fixo: todo pedido paga o mesmo valor, sem consultar a UPS.',
      'Atenção: em produção, o checkout dos EUA precisa da cotação UPS para validar o endereço. Com Valor fixo, todos os endereços são recusados.',
    ],
    services: [
      'Serviços da UPS que a loja pode usar na cotação.',
      'Qual vale: UPS Ground, se estiver marcado; senão, o mais barato entre os marcados.',
    ],
    quoteBox: [
      'A caixa que a UPS usa para calcular o valor do frete no checkout e no simulador.',
      'Não afeta as etiquetas: elas usam as Caixas de envio, mais abaixo.',
      'Dica: use o peso e as medidas de um pedido típico, para o valor cotado ficar perto do valor real.',
    ],
    weight: [
      'Peso da caixa usada na cotação, em libras.',
      'Conversão: 1 kg ≈ 2,2 lb.',
    ],
    dimension: [
      'Medida externa da caixa usada na cotação, em polegadas.',
      'Conversão: 1 in = 2,54 cm.',
      'Por quê: a UPS cobra pelo maior entre o peso real e o peso calculado pelas medidas da caixa.',
    ],
    dryIce: [
      'Quantos kg de gelo seco vão em cada caixa para manter a comida congelada.',
      'A UPS exige a declaração: vai na etiqueta e na cotação como UN1845 (gelo seco). Também é somado ao peso das caixas de envio dos EUA.',
      'Permitido: de 0,1 a 2,5 kg por caixa, com uma casa decimal, e nunca mais que o peso da caixa.',
    ],
    transitDays: [
      'Maior número de dias úteis que a UPS pode levar até o cliente.',
      'Acima disso: o endereço é recusado e o cliente não consegue assinar, porque a comida pode descongelar no caminho.',
      'Permitido: de 1 a 10. A caixa térmica foi pensada para cerca de 48 horas.',
    ],
    fallback: [
      'Plano B para quando a UPS não responde: fora do ar, lenta ou sem cotação para o ZIP.',
      'Ligado: cobra o Valor de reserva e o pedido segue.',
      'Desligado: o cliente não consegue fechar o pedido enquanto a UPS não responder.',
    ],
    cost: [
      'Valor do frete em dólares.',
      'Valor fixo: cobrado em todo pedido dos EUA.',
      'Valor de reserva: cobrado só quando a UPS não responde.',
    ],
    carrier: [
      'Nome da transportadora que o cliente vê quando vale o valor fixo ou o de reserva, por exemplo UPS.',
    ],
    delivery: [
      'Prazo que o cliente vê quando vale o valor fixo ou o de reserva. Escreva em inglês, por exemplo 3–5 business days.',
      'Com a cotação UPS: o prazo vem da própria UPS.',
    ],
    label: [
      'Nome do frete que o cliente vê quando vale o valor fixo ou o de reserva.',
      'Com a cotação UPS: aparece o nome do serviço da UPS.',
    ],
  },
  boxes: {
    section: [
      'As caixas físicas em que cada pedido dos EUA é embalado. Cada caixa vira uma embalagem na etiqueta UPS, nos dois modos de cotação.',
      'Como divide: enquanto sobrarem mais pacotes do que cabem numa caixa mensal, enche uma mensal. O resto vai na Starter, se couber; senão, em mais uma mensal.',
      'Ex.: com a mensal levando 30 e a Starter 15, um pedido de 40 pacotes vai numa mensal com 30 e numa Starter com 10.',
    ],
    dimension: [
      'Medida externa da caixa, em polegadas, que vai na etiqueta UPS.',
      'Conversão: 1 in = 2,54 cm.',
    ],
    emptyWeight: [
      'Peso da caixa sem comida, com o isolamento térmico, em kg.',
      'Peso na etiqueta: peso vazio + pacotes + gelo seco.',
      'Permitido: de 0,1 a 10 kg.',
    ],
    maxPacks: [
      'Quantos pacotes cabem nesta caixa. Pacotes de 300 g e de 500 g contam igual.',
      'Regra: a Starter precisa levar menos pacotes que a mensal.',
    ],
  },
  hq: {
    brName: ['Nome para identificar a sede no painel, por exemplo Cozinha Curitiba.'],
    brZip: [
      'CEP da cozinha de onde saem as entregas locais.',
      'Ao sair do campo, rua, bairro e cidade são preenchidos pelo CEP.',
      'Por quê: a distância de cada cliente, e o frete, são medidos a partir deste endereço.',
    ],
    brStreet: ['Rua da sede. Vem do CEP; corrija se estiver diferente.'],
    brNumber: ['Número do endereço. Use S/N se não houver.', 'Por quê: o número melhora a localização exata da sede no mapa.'],
    brComplement: ['Opcional: galpão, sala ou bloco. Não muda o cálculo do frete.'],
    brNeighborhood: ['Bairro da sede. Vem do CEP.'],
    brCity: ['Cidade da sede. Vem do CEP.'],
    brState: ['Estado (UF) da sede. Vem do CEP.'],
    usName: ['Nome da empresa ou do local que envia os pedidos, como aparece para a UPS.'],
    usStreet: [
      'Número e nome da rua de onde saem os pedidos dos EUA (ship from), por exemplo 350 5th Ave.',
      'Onde vale: remetente das etiquetas UPS, origem da cotação e endereço onde a UPS busca as caixas.',
    ],
    usStreet2: ['Opcional: apartamento, suíte, unidade, prédio ou andar.'],
    usCity: ['Cidade da sede dos EUA.'],
    usState: ['Estado da sede dos EUA.'],
    usZip: ['ZIP da sede dos EUA: 5 dígitos ou ZIP+4.', 'Por quê: a UPS calcula o frete e o prazo a partir deste ZIP.'],
    phone: [
      'Telefone de contato da sede dos EUA, com 10 dígitos.',
      'Por quê: a UPS exige o telefone para agendar a coleta das caixas.',
    ],
  },
  simulator: {
    BR: [
      'Digite um CEP para ver o frete que a loja cobraria, com as regras salvas do Brasil.',
      'Mostra: a distância a partir da sede e o valor, e se a taxa mínima ou máxima foi aplicada.',
      'Não cria pedido nem cobra nada. Alterações ainda não salvas não entram na simulação.',
    ],
    US: [
      'Digite um ZIP para ver o frete que a loja cobraria, com as regras salvas dos EUA.',
      'Mostra: cada chamada à UPS, os serviços com valor e prazo, e qual a loja escolheria.',
      'Roda no sandbox da UPS (ambiente de testes): nada é cobrado. Alterações ainda não salvas não entram na simulação.',
    ],
  },
} as const
