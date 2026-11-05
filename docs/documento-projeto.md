# Documento de projeto: Painel Operacional Turmalina Café

## 1. Propósito, usuária e premissas

O painel apoia Marina Salles, diretora de operações, na segunda-feira pela manhã, antes da reunião semanal com os gerentes regionais. A decisão principal é onde concentrar a capacidade de intervenção da semana, limitada a duas lojas. O produto não é um relatório do período: é um instrumento recorrente para transformar quatro exportações desconectadas em uma lista curta, rastreável e contestável de prioridades.

Premissas adotadas:

- A última data disponível nas vendas define o fim do período analisado; nos arquivos fornecidos, ela é 30/06/2026.
- A janela operacional é composta pelos últimos 28 dias-calendário disponíveis e é comparada aos 28 dias-calendário imediatamente anteriores. Quando uma loja não aparece em uma data de `turmalina_vendas_diarias.csv`, ela não abriu e suas vendas daquele dia são zero.
- Lojas ativas durante as duas janelas entram no ranking de prioridade. Dias sem abertura são exibidos como sinal operacional; não são falha de cobertura nem motivo para excluir a loja.
- Avaliações de clientes usam os últimos 90 dias e só aparecem como sinal comparável a partir de 10 avaliações válidas.
- “Margem após insumos” não é lucro nem margem líquida: não há salários, aluguel, impostos, utilidades, marketing ou investimento de abertura nos dados.
- Lojas abertas há menos de 10 meses são marcadas como recentes. Sua leitura é contextual; elas não são usadas como referência de maturidade.

## 2. Perguntas atendidas

### 2.1 Prioridade semanal

**Quais duas lojas maduras, com evidência suficiente, devem ser investigadas nesta semana e quais sinais justificam a ordem?**

O painel responde por meio de um escore de até cinco pontos e mostra os fatores que compõem cada ponto. A recomendação é de investigação, não um diagnóstico causal automático.

### 2.2 Diagnóstico operacional da loja

**A piora está associada a venda, margem após insumos, produtividade de equipe, desperdício ou experiência do cliente?**

O painel apresenta as medidas no mesmo período e deixa claro o que cada uma mede e o que não mede.

### 2.3 Acompanhamento da rede

**Como as lojas se comportam contra a própria história recente e, apenas como contexto, contra pares de formato e maturidade?**

A comparação principal é sempre da loja consigo mesma. Comparações entre lojas são secundárias porque cidade, formato, modelo de propriedade e estágio de abertura são diferentes.

### 2.4 Expansão como prontidão, não como decisão

**Há sinais operacionais que merecem discussão antes de abrir novas lojas?**

A tela de expansão mostra estabilidade de indicadores disponíveis, evolução das lojas recentes e qualidade do dado. Ela não recomenda expandir, desacelerar ou suspender: essa decisão exige custos fixos, investimento de abertura, capacidade de gestão, demanda de mercado e pipeline, que não foram fornecidos.

## 3. Escopo e navegação

O painel contém cinco páginas:

1. **Visão geral:** prioridades da semana, resumo da rede, sinais de qualidade dos dados e os cinco produtos mais vendidos por quantidade de cada loja prioritária.
2. **Lojas:** ranking explicável, matriz de desempenho e detalhe de uma loja.
3. **Margem e desperdício:** descontos, margem após insumos e desperdício, por loja e período.
4. **Equipe e cliente:** vendas líquidas por hora de equipe, nota média e espera mediana.
5. **Expansão e qualidade dos dados:** checklist de prontidão operacional, lojas recentes, dias sem abertura e limitações.

## 4. Mapa dos dados e tratamento

| Arquivo | Colunas usadas | Tratamento | Uso no painel |
|---|---|---|---|
| `turmalina_lojas.csv` | `id_loja`, `nome_loja`, `cidade_uf`, `formato`, `modelo`, `data_abertura`, `status` | Padronizar caixa, grafias de formato/modelo/cidade e datas. `id_loja` é a chave canônica. | Nome, formato, modelo, maturidade e agrupamento contextual. |
| `turmalina_vendas_diarias.csv` | `data`, `id_loja`, `faturamento_bruto`, `descontos`, `num_tickets`, `horas_trabalhadas_equipe`, `custo_insumos`, `valor_desperdicio` | Converter data e números; identificar duplicata por `id_loja` e `data`; completar o calendário de cada loja ativa com zero quando não houver linha de venda, pois isso representa dia sem abertura. | Prioridade, vendas, descontos, margem após insumos, produtividade e desperdício. |
| `turmalina_itens.csv` | `id_loja`, `competencia`, `produto`, `quantidade_vendida`, `preco_medio`, `custo_unitario` | Converter preço e quantidade; manter mês de competência; não usar `custo_unitario` ausente para inferência. Não é necessário padronizar `categoria`, que fica fora do escopo. | Cinco produtos mais vendidos por quantidade; valor indicativo por produto (`quantidade_vendida × preco_medio`). |
| `turmalina_avaliacoes.csv` | `id_avaliacao`, `id_loja`, `data`, `nota`, `canal`, `tempo_espera_min`, `comentario` | Padronizar ID da loja/canal e datas; converter notas textuais conhecidas; excluir nota inválida e espera ausente, nula ou implausível (acima de 120 min). | Nota média, espera mediana, volume de avaliações e sinal de experiência. |

### Regras de qualidade visíveis

- Duplicata de venda: manter uma única linha apenas após registrar o conflito no painel; a regra de retenção precisa ser exibida na implementação e no log de qualidade.
- Dias sem linha de venda: completar o dia com zero e mostrar o total de dias sem abertura na janela. A ausência representa loja fechada, conforme a regra de negócio informada.
- Custo unitário ausente no arquivo de itens: não afeta os produtos mais vendidos por quantidade; impede qualquer conclusão de custo por produto.
- Nota textual: converter somente formatos explicitamente reconhecidos, como `3 estrelas` e `quatro`; valores não interpretáveis ficam excluídos e contados.
- Espera: valores acima de 120 minutos são tratados como falha de totem e excluídos, com contagem visível.

## 5. Dicionário de indicadores

| Indicador | Fórmula e unidade | Período e comparação | Pergunta atendida | Limitação |
|---|---|---|---|---|
| Dias sem abertura | número de datas sem linha de venda, em dias | Últimos 28 dias | Houve indisponibilidade operacional? | Não informa o motivo do fechamento. |
| Vendas líquidas por dia-calendário | `(faturamento_bruto - descontos) / 28`, R$/dia | Últimos 28 dias versus 28 anteriores | A performance comercial/operacional caiu? | Combina demanda e dias de operação; o detalhe de dias sem abertura é necessário para interpretar a queda. |
| Variação de vendas/dia | `(vendas/dia-calendário atual ÷ vendas/dia-calendário anterior - 1) × 100`, % | 28 versus 28 dias | A performance caiu? | Sensível a eventos não presentes nos dados e a fechamentos operacionais. |
| Margem após insumos | `(vendas líquidas - custo_insumos) / vendas líquidas × 100`, % | 28 versus 28 dias | Há pressão de custos de insumo? | Não é lucro; exclui mão de obra, custos fixos e impostos. |
| Vendas líquidas por hora de equipe | `vendas líquidas / horas_trabalhadas_equipe`, R$/hora | 28 versus 28 dias | Há sinal para revisar escala/cobertura? | Não mede custo de trabalho, qualidade do atendimento ou quadro adequado. |
| Desperdício sobre vendas líquidas | `valor_desperdicio / vendas líquidas × 100`, % | Últimos 28 dias | Há vazamento operacional a investigar? | Depende da qualidade do registro de desperdício. |
| Ticket médio líquido | `vendas líquidas / num_tickets`, R$/ticket | 28 versus 28 dias | A mudança vem de valor por compra? | Não substitui uma medida de fluxo; tickets não são clientes únicos. |
| Nota média | média das notas válidas, escala 1–5 | Últimos 90 dias, mínimo de 10 avaliações | A experiência é um sinal de prioridade? | Canais e perfis de respondente diferem; não representa toda a clientela. |
| Espera mediana | mediana dos tempos válidos, minutos | Últimos 90 dias, mínimo de 10 valores | Há sinal de fricção no atendimento? | Totem pode falhar; não representa todas as compras. |
| Produtos mais vendidos | cinco maiores `quantidade_vendida`, unidades | Mês mais recente disponível no arquivo de itens | O que a loja está vendendo em maior volume? | Arquivo é mensal e não é sincronizado com a janela diária; não mostra rentabilidade por produto. |

## 6. Regra de prioridade

Uma loja ativa nas duas janelas recebe um ponto por cada condição abaixo. O escore máximo é cinco; empates são resolvidos pela maior queda de vendas líquidas por dia-calendário.

| Sinal | Regra | Origem do limite |
|---|---|---|
| Venda | queda superior a 5% em vendas líquidas/dia-calendário | Limite fixo, escolhido para não sinalizar variação pequena como crise. |
| Margem | queda superior a 2 pontos percentuais na margem após insumos | Limite fixo, separa alteração material de oscilação pequena. |
| Equipe | queda superior a 5% em vendas líquidas/hora | Limite fixo, alinhado ao limite de venda. |
| Desperdício | valor no pior quartil da rede elegível | Não há meta externa fornecida; compara posição relativa, não desempenho absoluto. |
| Cliente | nota média ou espera mediana no pior quartil da rede com amostra válida | Não há padrão de serviço fornecido; só é sinal contextual. |

O painel recomenda, no máximo, duas lojas com maior escore. Se não houver duas lojas com sinal material, ele informa que não há evidência suficiente para preencher artificialmente a capacidade de intervenção.

## 7. Wireframes

### 7.1 Visão geral

```text
+--------------------------------------------------------------------------------+
| TURMALINA | Visão geral | Período: 03–30 jun 2026 vs. 06 mai–02 jun 2026    |
| Dias sem abertura: 5 | 1 duplicata tratada | Atualizado com dados até 30/06 |
+--------------------------------------------------------------------------------+
| PRIORIDADES DA SEMANA (no máximo 2)                                           |
| 1. [Loja] Escore 4/5 | venda/dia -8% | margem -3,1 pp | por que investigar  |
| 2. [Loja] Escore 3/5 | ...                                                    |
+--------------------------------------------------------------------------------+
| Rede: vendas/dia-calendário | margem após insumos | desperdício | produtividade equipe |
+--------------------------------------+-----------------------------------------+
| Matriz: venda/dia x variação         | Qualidade do dado                       |
| pontos = lojas; cor = margem         | dias sem abertura / dados excluídos     |
+--------------------------------------+-----------------------------------------+
| Produtos mais vendidos das prioridades (mês mais recente; unidades)           |
| [Loja 1: 1...5]                                      [Loja 2: 1...5]          |
+--------------------------------------------------------------------------------+
```

### 7.2 Lojas e detalhe

```text
+--------------------------------------------------------------------------------+
| Filtros: período | formato | modelo | status de abertura                      |
+--------------------------------------------------------------------------------+
| Ranking explicável: loja | escore | dias fechada | venda/dia | variação | sinais |
+--------------------------------------+-----------------------------------------+
| Lista/matriz de lojas                | Detalhe da loja selecionada             |
|                                      | série diária de vendas líquidas          |
|                                      | cartões: ticket, margem, horas, perda   |
|                                      | nota, espera, tamanho da amostra         |
+--------------------------------------+-----------------------------------------+
```

## 8. Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| Dashboard com todos os números em uma tela | Não respeita o momento de uso e dilui a decisão de duas intervenções. |
| Ranking por faturamento total | Favorece lojas maiores e não evidencia dias sem abertura. |
| Comparar toda loja contra a média da rede | Formatos, cidades e maturidade são heterogêneos; a média cria uma referência enganosa. |
| Definir expansão por “lucro” | O dado não contém custos suficientes para apurar lucro. |
| Alerta universal de desperdício, nota ou espera | Não há meta operacional fornecida; quartis são mais honestos como sinal relativo. |
| Tratar dias ausentes como falta de dado | Contraria a regra de negócio: ausência de linha representa loja fechada e venda zero. |
| Análise de categoria de produto | As categorias têm grafias incompatíveis e não são necessárias para a decisão semanal. |
| Ranking de rentabilidade por produto | Há custos unitários ausentes; produziria falsa precisão. |
