# Painel Operacional Turmalina Café

Protótipo para a reunião semanal de operações: prioriza até duas lojas para investigação, explica os sinais e exibe a qualidade da evidência. Não altera os CSVs originais.

## Stack

- **API:** Rust, responsável por ler, validar, padronizar e agregar os quatro CSVs uma vez na inicialização.
- **Interface:** Astro estático, que consome a API em JSON e renderiza as seis páginas do painel.

A separação mantém as regras de dados centralizadas e a interface simples de publicar. O conjunto fornecido é pequeno, portanto não requer banco de dados nem cálculo a cada requisição.

## Requisitos

- Rust estável com Cargo.
- Node.js 22.23.4 ou superior e npm.
- Os quatro arquivos originais em `data/`, sem edição manual:
  - `turmalina_lojas.csv`
  - `turmalina_vendas_diarias.csv`
  - `turmalina_itens.csv`
  - `turmalina_avaliacoes.csv`

## Execução

```bash
# Terminal 1: API em http://127.0.0.1:3000
cargo run --manifest-path api/Cargo.toml

# Terminal 2: interface em http://127.0.0.1:4321
npm --prefix web install
npm --prefix web run dev
```

A interface espera a API em `http://127.0.0.1:3000`. Para outro endereço, defina `PUBLIC_API_URL` no ambiente de build/desenvolvimento do Astro.

## Páginas

1. **Visão geral:** duas prioridades, indicadores da rede e qualidade do dado.
2. **Lojas:** ranking explicável, filtros, comparação e detalhe.
3. **Produtos:** seleção de loja, cinco maiores e menores volumes, comparação mensal de quantidade, preço médio e valor estimado, além de produtos novos ou sem registro na competência atual.
4. **Margem e desperdício:** margem após insumos, descontos, desperdício e dias sem abertura.
5. **Equipe e cliente:** vendas por hora, nota e espera.
6. **Expansão e qualidade dos dados:** prontidão operacional e limites da evidência.

## Produtos

A análise de produtos compara a competência mais recente de cada loja à competência imediatamente anterior. A API calcula essa comparação em `GET /api/stores/:store_id/products`; o frontend apenas apresenta o resultado.

- Rankings usam quantidade vendida; valor estimado é `quantidade_vendida × preco_medio`.
- Mudanças de quantidade e valor estimado aparecem como variação percentual. Preço médio é apresentado de forma neutra, pois aumento não é automaticamente positivo ou negativo.
- Produto sem histórico anterior é marcado como novo. Produto que deixa de constar na competência atual aparece separadamente, sem ser interpretado como venda zero.
- `custo_unitario` não participa da análise nem dos rankings.

## Regras essenciais

- Período principal: últimos 28 dias disponíveis versus os 28 anteriores.
- Ausência de linha de venda significa loja fechada e vendas zero: métricas de venda usam todos os dias-calendário e exibem os dias sem abertura.
- Cliente: últimos 90 dias e pelo menos 10 avaliações válidas.
- “Margem após insumos” não é lucro e não deve ser usada isoladamente para decidir expansão.

As definições completas estão em `docs/documento-projeto.md`; a especificação da página de produtos está em `docs/pagina-produtos.md`; justificativas e condições de invalidação estão em `docs/decisoes-de-projeto.md`.
