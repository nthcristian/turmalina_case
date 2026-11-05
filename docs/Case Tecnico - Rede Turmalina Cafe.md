# CASE TÉCNICO / ESTÁGIO EM IA & DADOS

# Rede Turmalina Café

Projeto de um sistema para tomada de decisão.

## Objetivo

Projetar e construir um sistema simples de visualização que sustente as decisões operacionais recorrentes de uma rede de cafeterias. A análise de dados é meio: a avaliação recai sobre a seleção de indicadores, a escolha das visualizações e a justificativa de cada decisão de projeto.

| | |
|---|---|
| **Prazo** | 5 dias corridos |
| **Nível** | Básico |
| **Entrega** | Protótipo funcional e documentação das decisões |
| **Stack** | Livre, com justificativa |
| **Dados** | 4 arquivos CSV, sem tratamento |
| **Uso de IA** | Liberado e recomendado, com registro |

> **Sobre a avaliação**
>
> Não há gabarito, e a maior parte das definições de escopo é deliberadamente aberta. O case não mede volume de entrega: mede a consistência entre o problema, as decisões de projeto e a defesa dessas decisões. Toda escolha relevante deve estar documentada.

**O que se avalia são as escolhas, não o volume da entrega.**

---

## 01 Contexto

### 1.1 A empresa

A Rede Turmalina Café é uma rede de cafeterias fundada em Belo Horizonte em 2021. Opera 14 lojas em três estados (MG, SP e ES), em três formatos: loja de rua, operação em shopping e quiosque. Nove são próprias, cinco são franqueadas, e cinco das quatorze abriram nos últimos dez meses.

Não existe sistema de gestão unificado. O cadastro sai do sistema de franquias, o movimento diário do PDV, o mix de produtos do controle de estoque, e as avaliações vêm do aplicativo próprio, do Google e do totem de loja. São quatro exportações que nunca foram integradas.

### 1.2 O retrato consolidado

| Faturamento bruto | Crescimento | Margem sobre insumos | Ticket médio |
|---|---|---|---|
| **R$ 20,8 mi** nos últimos 12 meses | **+26,5%** no 2º semestre contra o 1º semestre | **67,7%**, estável nos dois semestres | **R$ 25,17**, praticamente inalterado |

São os números que chegam hoje ao conselho, extraídos da planilha consolidada mensal. Todos os quatro estão corretos.

### 1.3 A demanda

> “Toda segunda-feira eu recebo seis planilhas por e-mail. Levo dois dias para montar um retrato da semana e, quando termino, a semana já passou. Eu sei que tem loja indo mal. Só não sei qual, nem por quê, nem se o problema é a loja ou o jeito como estamos medindo.”
>
> **Marina Salles, diretora de operações**

O pedido é por um instrumento de uso recorrente, e não por um relatório pontual sobre o período.

### 1.4 Uso previsto do sistema

| | |
|---|---|
| **Usuária** | Marina Salles, diretora de operações. Lê números com facilidade, não programa e não constrói consultas. |
| **Momento de uso** | Início da manhã de segunda-feira, antes da reunião semanal de operações. |
| **Desdobramento** | A reunião envolve cinco gerentes regionais e define as prioridades da semana. |
| **Capacidade de intervenção** | A estrutura atual sustenta ação efetiva em, no máximo, duas lojas por semana. |
| **Acesso à empresa** | Não haverá acesso à equipe da Turmalina durante os cinco dias. |

---

## 02 Os dados

Quatro arquivos CSV, exportados de sistemas distintos. As notas de exportação reproduzem o que a equipe respondeu quando questionada sobre cada arquivo.

### `turmalina_lojas.csv` (14 linhas)

Cadastro das lojas. Origem: sistema de franquias.

`id_loja` · `nome_loja` · `cidade_uf` · `formato` · `modelo` · `data_abertura` · `area_m2` · `num_funcionarios` · `meta_faturamento_mensal` · `status`

> **Nota:** “Esse cadastro foi preenchido à mão por quem abriu cada loja. Nunca padronizamos nada.”

### `turmalina_vendas_diarias.csv` (4.127 linhas)

Uma linha por loja e por dia, de 01/07/2025 a 30/06/2026. Origem: PDV.

`data` · `id_loja` · `faturamento_bruto` · `descontos` · `num_tickets` · `horas_trabalhadas_equipe` · `custo_insumos` · `valor_desperdicio`

> **Nota:** “Exportação direta do PDV. Loja que não abriu no dia simplesmente não gera linha. Já tivemos problema de sincronização em algumas praças.”

### `turmalina_itens.csv` (1.701 linhas)

Mix de produtos por loja e por mês, de janeiro a junho de 2026. Origem: controle de estoque.

`id_loja` · `competencia` · `categoria` · `produto` · `quantidade_vendida` · `preco_medio` · `custo_unitario`

> **Nota:** “Categoria é campo livre, cada loja escreve como quer. E o custo unitário não está preenchido em todas as linhas.”

### `turmalina_avaliacoes.csv` (380 linhas)

Avaliações de clientes por loja, com tempo de espera medido e comentário em texto livre.

`id_avaliacao` · `id_loja` · `data` · `nota` · `canal` · `tempo_espera_min` · `comentario`

> **Nota:** “A versão antiga da ferramenta aceitava texto livre no campo de nota. E o tempo de espera vem do totem, que às vezes trava.”

> **Qualidade dos dados**
>
> Nenhum dos arquivos passou por validação. Há inconsistências de formato dentro de cada um e entre eles. Avaliar o que os dados sustentam, e o que não sustentam, faz parte do trabalho. O tratamento não é o objeto principal da avaliação, mas o sistema responde pelo que exibe.

---

## 03 O que a operação precisa decidir

A reunião semanal trata de um conjunto recorrente de decisões. A relação abaixo descreve o que se discute na operação, e não o que o sistema deve exibir.

| Tema | A decisão em jogo |
|---|---|
| Prioridade da semana | Onde concentrar a capacidade de intervenção disponível. |
| Expansão | Manter, desacelerar ou suspender a abertura de novas lojas. |
| Margem | Qual alavanca operacional acionar, e em quais lojas. |
| Equipe | Onde revisar quadro, escala e cobertura de horário de pico. |
| Cliente | Onde a operação está comprometendo a experiência de quem compra. |

> **Escopo a definir**
>
> Definir quais perguntas o sistema responde, quantas são e em que hierarquia é parte do trabalho de projeto. A relação acima não é obrigatória nem exaustiva: recortá-la, ampliá-la ou reformulá-la é uma decisão legítima, desde que justificada. Cobrir todos os temas não é indicador de qualidade, e deixar um tema de fora com um motivo claro é uma resposta aceitável.

### 3.1 Premissas

Este documento é tudo o que a empresa forneceu. Onde faltar informação, cabe assumir o que for razoável e registrar a premissa junto da entrega. Premissa explícita não é penalizada; premissa silenciosa, que só aparece quando alguém questiona um número na apresentação, é tratada como falha de documentação.

Dúvidas sobre o case podem ser enviadas a qualquer momento. A formulação da pergunta também é informação sobre o candidato.

---

## 04 Escopo do projeto

O escopo se divide em duas partes: um conjunto curto de requisitos, que valem como condição de entrega, e um conjunto amplo de decisões de projeto, que ficam a cargo do candidato.

### 4.1 Requisitos

- O protótipo lê os quatro arquivos CSV como eles estão, sem edição manual dos originais.
- Roda em outra máquina a partir de um README de no máximo uma página.
- É interpretável sem apresentação verbal: rótulo, unidade, período e base de comparação explícitos na própria tela.
- Usa apenas o que os quatro arquivos sustentam. Custos fixos, aluguel e metas não fornecidas não podem ser presumidos como dado.
- Toda decisão de projeto relevante está documentada, conforme a seção 05.

### 4.2 Decisões de projeto

As definições abaixo são deliberadamente abertas. Não há número mínimo ou máximo de indicadores, não há formato de tela prescrito e não há tipo de gráfico preferido. O que se avalia é o critério adotado em cada caso.

| Definição | Fica a cargo do candidato |
|---|---|
| Perguntas atendidas | Quais decisões o sistema apoia, e quais deixa de fora. |
| Indicadores | Quais, quantos, com que fórmula, unidade e hierarquia na tela. |
| Recorte de tempo | Período exibido e granularidade da agregação. |
| Base de comparação | Contra meta, contra o próprio histórico, contra a rede ou contra grupos de lojas. |
| Normalização | Se, onde e como normalizar os valores comparados. |
| Visualizações | Tipo de gráfico ou tabela para cada elemento, e o que cada formato omite. |
| Sinalização | Se há alerta, qual o limite numérico e qual a origem desse limite. |
| Estrutura de telas | Quantas telas, o que fica em cada uma e como se navega entre elas. |
| Qualidade dos dados | Critério para dado ausente, duplicado ou inconsistente, e onde isso aparece. |

> Divergir do que está escrito aqui é admissível. Um requisito considerado inadequado pode ser descartado, desde que a entrega registre qual foi, o que se ganhou e o que passou a custar.

---

## 05 Entregas

### 5.1 Documento de projeto

Escrito antes da implementação, para evidenciar que o sistema foi projetado e não descoberto durante a construção. Conteúdo esperado:

1. Usuária e momento de uso, com as premissas assumidas.
2. Perguntas que o sistema se propõe a responder, e o motivo do recorte.
3. Mapa dos dados: origem de cada indicador, por arquivo e coluna, e o tratamento aplicado no caminho.
4. Dicionário de indicadores: nome, fórmula, unidade, período, pergunta atendida e limitação de cada um.
5. Wireframe da tela ou telas, com a hierarquia visual definida. Esboço à mão fotografado é suficiente.
6. Alternativas descartadas: indicadores e formatos considerados e deixados de fora, com o motivo de cada descarte.

> As alternativas descartadas têm o mesmo peso na avaliação que o conteúdo mantido na tela.

### 5.2 Protótipo funcional

Stack livre, com justificativa em duas linhas: Python (Streamlit, Dash, Panel), HTML com JavaScript, Lovable, Power BI, Looker Studio ou planilha com painel são todos aceitáveis. Divergências entre o protótipo e o wireframe original são normais e contam a favor quando explicadas.

### 5.3 Documentação das decisões

Um parágrafo por decisão relevante, contendo: a decisão, as alternativas consideradas, o critério que sustentou a escolha e a condição que a invalidaria. As definições listadas na seção 4.2 indicam onde as decisões costumam estar, mas a relação do que foi decidido é do candidato.

### 5.4 Registro de uso de IA e README

Detalhados na seção 06. O README explica, em no máximo uma página, como executar o protótipo a partir dos quatro arquivos originais.

---

## 06 Uso de inteligência artificial

O uso de IA é liberado e recomendado, sem limite de ferramenta, de volume ou de etapa. Recorrer a ela para escrever código, propor indicadores, revisar texto e criticar o próprio painel é prática corrente aqui.

A contrapartida é a responsabilidade pelo resultado. A entrega deve incluir um registro de ao menos três momentos em que a IA participou do trabalho, com três colunas: o que foi pedido (prompt exato), o que foi devolvido (resumo) e o que foi mantido, alterado ou descartado, com o critério da decisão.

Além do registro, dois relatos curtos:

- **Um desacordo:** uma situação em que a recomendação da IA foi contestada e a decisão do candidato prevaleceu, com o argumento que sustentou a posição.
- **Uma recusa:** um indicador ou visualização proposta pela IA e não utilizada, com o que havia de errado ou insuficiente na proposta.

> Uma escolha que não se sustenta em uma frase de justificativa é tratada como escolha não realizada. O que se avalia não é o uso de IA, e sim se o projeto continua sendo do candidato depois dele.

---

## 07 Critérios de avaliação

Cinco critérios, cem pontos. O peso está concentrado em julgamento e defesa, não em execução técnica.

| Critério | Peso | O que se observa |
|---|---:|---|
| Recorte do problema | 25 | Relação entre o que o sistema exibe e as decisões que a operação precisa tomar, e coerência da hierarquia adotada. |
| Indicadores | 25 | Definição, unidade, base de comparação, tratamento da comparabilidade entre lojas e qualidade das alternativas descartadas. |
| Visualizações | 20 | Adequação do formato ao dado e à pergunta, legibilidade e honestidade de eixo e escala. |
| Projeto do sistema | 15 | Caminho do dado até a tela, consistência do tratamento, reprodutibilidade e simplicidade da solução. |
| Defesa das decisões | 15 | Clareza da documentação, uso crítico de IA e reconhecimento das limitações do que foi entregue. |

---

## 08 Prazo, envio e apresentação

| | |
|---|---|
| **Prazo** | 5 dias corridos a partir do recebimento deste documento. |
| **Envio** | Pasta ou repositório contendo protótipo, documento de projeto, documentação das decisões, registro de uso de IA e README. |
| **Apresentação** | 10 minutos ao vivo, conduzindo o sistema como em um uso real, seguidos de cerca de 10 minutos de perguntas sobre as decisões de projeto. |

> **Um sistema de decisão se julga pelas escolhas que o sustentam.**
