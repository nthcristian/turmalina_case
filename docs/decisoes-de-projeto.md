# Decisões de projeto

## 1. Recorte: priorização semanal antes de cobertura ampla

**Decisão.** O centro do produto é indicar até duas lojas para investigação na reunião de segunda-feira, acompanhado dos sinais que justificam a prioridade. **Alternativas.** Um painel executivo com todos os indicadores, um ranking puro de lojas ou uma ferramenta voltada à expansão. **Critério.** A usuária dispõe de capacidade para agir em apenas duas lojas por semana; portanto, uma hierarquia explícita é mais útil que amplitude de informação. **Invalidaria a decisão.** Se a operação aumentasse a capacidade de intervenção, ou se o uso principal deixasse de ser a reunião semanal, o limite e a estrutura de priorização precisariam ser revistos.

## 2. Janelas de 28 dias em vez de leitura diária ou mensal

**Decisão.** O período principal são os últimos 28 dias disponíveis, comparados aos 28 imediatamente anteriores. **Alternativas.** Dia contra dia, semana contra semana, mês-calendário e acumulado de 12 meses. **Critério.** Quatro semanas reduzem a volatilidade diária e continuam recentes o bastante para orientar uma reunião semanal; duas janelas do mesmo tamanho tornam a mudança legível. **Invalidaria a decisão.** Se a sazonalidade semanal fosse demonstrada como dominante ou se houvesse anos comparáveis de dados limpos, a comparação com o mesmo período do ano anterior seria preferível.

## 3. Vendas por dia-calendário, com zero em dia sem abertura

**Decisão.** Vendas são normalizadas pelos 28 dias-calendário da janela. Quando não há linha de venda para uma loja ativa em uma data, o painel completa o dia com vendas zero e o exibe como dia sem abertura. **Alternativas.** Usar faturamento total, dividir apenas pelos dias com venda ou estimar a venda ausente pela média. **Critério.** A regra de negócio esclarecida para esta entrega define que a ausência de linha significa que a loja não abriu; tratá-la como ausência de dado esconderia uma indisponibilidade operacional relevante. **Invalidaria a decisão.** Uma alteração nessa regra de negócio, ou um indicador que distinguisse fechamento planejado de indisponibilidade não planejada, exigiria separar essas causas no cálculo.

## 4. Qualidade de dados e amostra de cliente

**Decisão.** Lojas ativas nas duas janelas entram no ranking; dias sem linha de venda são vendas zero e aparecem como dias sem abertura. Cliente só entra como sinal a partir de 10 avaliações válidas nos últimos 90 dias. **Alternativas.** Excluir lojas por dias sem linha, dividir vendas só por dias abertos ou esconder o tamanho da amostra de cliente. **Critério.** A ausência de linha é um dado operacional, não uma falha de cobertura. Já a amostra de avaliações pode ser insuficiente para representar a experiência, por isso tem limite explícito. **Invalidaria a decisão.** Se a regra de ausência de vendas mudar, ou se houver uma fonte mais completa de feedback de cliente, os critérios de inclusão devem ser recalibrados.

## 5. Escore simples e explicável de cinco sinais

**Decisão.** Cada loja elegível recebe um ponto por deterioração relevante de vendas/dia, margem após insumos, vendas/hora, desperdício relativo e experiência do cliente relativa. Empates são desfeitos pela maior queda de vendas/dia. **Alternativas.** Média ponderada opaca, algoritmo preditivo, ranking por uma única métrica ou pesos financeiros arbitrários. **Critério.** A diretora deve conseguir contestar a recomendação na própria tela; cinco condições iguais são auditáveis e evitam precisão que os dados não suportam. **Invalidaria a decisão.** Dados históricos sobre intervenções e resultados poderiam justificar pesos estimados ou um modelo de priorização mais sofisticado.

## 6. Limites mistos: mudança fixa e posição relativa

**Decisão.** Quedas superiores a 5% em vendas/dia ou vendas/hora e a 2 pontos percentuais de margem são sinais fixos; desperdício e experiência usam o pior quartil da rede elegível. **Alternativas.** Um único limite para tudo, meta externa inventada ou qualquer queda como alerta. **Critério.** O case não fornece metas de serviço nem tolerância de desperdício, mas permite definir mudança material para os indicadores de tendência. Quartis tornam explícito que os últimos dois sinais são relativos. **Invalidaria a decisão.** Metas operacionais homologadas pela empresa substituiriam os quartis e poderiam recalibrar os limites fixos.

## 7. Margem após insumos, nunca “lucro”

**Decisão.** O painel calcula `(vendas líquidas - custo de insumos) / vendas líquidas` e a denomina “margem após insumos”. **Alternativas.** Chamar o resultado de lucro, margem líquida ou não mostrar margem. **Critério.** O numerador disponível mede somente insumos após descontos; não existem salários monetários, aluguel, impostos, utilidades, marketing ou investimento. O indicador ainda é útil para localizar pressão operacional, desde que sua fronteira seja declarada. **Invalidaria a decisão.** A entrada de uma base confiável de custos de trabalho e custos fixos permitiria calcular margens de contribuição mais completas ou lucro operacional.

## 8. Produtividade de equipe sem inferir custo ou quadro ideal

**Decisão.** O sinal de equipe é vendas líquidas por hora trabalhada. **Alternativas.** Custo de mão de obra, receita por funcionário cadastrado ou recomendação direta de reduzir/aumentar quadro. **Critério.** Há horas trabalhadas, mas não taxa salarial, escala detalhada, horários de pico ou capacidade por função. A métrica aponta onde investigar escala e cobertura sem prometer uma decisão de dimensionamento. **Invalidaria a decisão.** Dados de custo por função, turnos, ocupação e tempo de atendimento permitiriam avaliar eficiência e necessidade de equipe com mais segurança.

## 9. Experiência de cliente em 90 dias

**Decisão.** Nota média e espera mediana usam os últimos 90 dias, com tamanho de amostra visível. **Alternativas.** Janela de 28 dias, média de espera, sentimento automático dos comentários ou ignorar clientes. **Critério.** Há apenas 380 avaliações para toda a rede e algumas lojas teriam poucos registros em 28 dias. A mediana reduz o efeito de outliers como o valor `999`, já excluído pela regra de qualidade. **Invalidaria a decisão.** Volume maior e mais uniforme de avaliações permitiria uma janela mais curta e análise de mudança semanal.

## 10. Produto por quantidade, sem margem de produto

**Decisão.** Para cada loja prioritária, o painel mostra os cinco produtos de maior quantidade vendida no mês mais recente, com valor indicativo calculado a partir do preço médio. **Alternativas.** Mix por categoria, ranking por receita, margem por produto ou excluir o arquivo de itens. **Critério.** “Mais vendidos” é uma leitura operacional direta de volume; as categorias são inconsistentes e 85 linhas não têm custo unitário, o que invalida ranking de rentabilidade. **Invalidaria a decisão.** Categorias controladas e cobertura completa de custo por produto permitiriam análise de mix e margem com qualidade.

## 11. Expansão como checklist de prontidão

**Decisão.** A página de expansão mostra sinais operacionais disponíveis e lista os dados ausentes; ela não emite um veredito de expansão. **Alternativas.** Ignorar o tema, recomendar expansão a partir de margem alta ou construir um score de crescimento. **Critério.** Boa margem após insumos não prova lucro, disponibilidade de caixa, demanda local, capacidade gerencial ou retorno do investimento. O checklist mantém o tema visível sem extrapolar a evidência. **Invalidaria a decisão.** Dados de investimento, custos fixos, capacidade, canibalização, demanda e desempenho de coortes maduras permitiriam modelar a decisão.

## 12. Arquitetura: API Rust e interface Astro estática

**Decisão.** A API Rust lê, valida, padroniza e agrega os CSVs na inicialização; a interface Astro estática consome endpoints JSON e apresenta as cinco páginas. **Alternativas.** Planilha manual, aplicação única com servidor renderizado, processamento dos CSVs a cada requisição ou dashboard Python. **Critério.** A separação concentra regras de dados em um único serviço, mantém a camada visual simples e reproduz os resultados sem alterar os originais. O volume atual é pequeno, portanto a agregação na inicialização é suficiente. **Invalidaria a decisão.** Atualizações contínuas, milhões de linhas ou necessidade de filtros ad hoc poderiam justificar banco de dados, cache ou cálculo sob demanda.
