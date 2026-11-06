# Página de Produtos

## Objetivo

Permitir que a operação analise o giro de produtos de uma loja sem misturar formatos, praças ou modelos de operação. A página substitui os produtos mais vendidos que antes apareciam na visão geral.

## Escopo

- A análise é de uma loja por vez.
- Filtros de formato e modelo reduzem o seletor de lojas.
- A competência mais recente é comparada à competência imediatamente anterior.
- A API calcula toda a comparação mensal; o frontend apenas apresenta o resultado.

## Indicadores

Para cada produto registrado na competência atual, mostrar:

- Quantidade vendida e variação percentual contra a competência anterior.
- Preço médio e variação percentual contra a competência anterior.
- Valor estimado de vendas (`quantidade_vendida × preco_medio`) e sua variação percentual.

O ranking mostra os cinco produtos com maior quantidade e os cinco com menor quantidade na competência atual. Uma tabela completa permite consultar todos os produtos registrados.

## Regras de interpretação

- Aumento de quantidade usa verde; queda usa vermelho.
- Variação de preço usa tom neutro: aumento não é automaticamente positivo ou negativo.
- Produto sem registro na competência anterior é rotulado como `Novo na competência`; não há percentual contra zero.
- Produto presente na competência anterior e ausente na atual aparece em “Produtos sem registro na competência atual”. A ausência não implica venda zero, descontinuação ou indisponibilidade.
- `custo_unitario` não participa da página nem de rankings de produto. A qualidade de dados continua reportando custos unitários ausentes para explicar por que rentabilidade por produto não é apresentada.

## Limitações

O arquivo de itens é mensal, de janeiro a junho de 2026. A página não compara janelas diárias de 28 dias, não mede margem por produto e não permite inferir causa para uma mudança de preço ou volume.

## Contrato esperado da API

Um endpoint por loja retorna a competência atual, a competência anterior, os produtos da competência atual com métricas e variações, e os produtos que ficaram sem registro na competência atual. Valores ausentes devem ser estados explícitos, nunca convertidos em zero sem evidência.
