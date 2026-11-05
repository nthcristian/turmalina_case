# Painel Operacional Turmalina Café

Protótipo para a reunião semanal de operações: prioriza até duas lojas para investigação, explica os sinais e exibe a qualidade da evidência. Não altera os CSVs originais.

## Stack

- **API:** Rust, responsável por ler, validar, padronizar e agregar os quatro CSVs uma vez na inicialização.
- **Interface:** Astro estático, que consome a API em JSON e renderiza as cinco páginas do painel.

A separação mantém as regras de dados centralizadas e a interface simples de publicar. O conjunto fornecido é pequeno, portanto não requer banco de dados nem cálculo a cada requisição.

## Requisitos

- Rust estável com Cargo.
- Node.js 20 ou superior e npm.
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

1. **Visão geral:** duas prioridades, indicadores da rede, qualidade do dado e produtos mais vendidos das prioridades.
2. **Lojas:** ranking explicável, filtros, comparação e detalhe.
3. **Margem e desperdício:** descontos, margem após insumos e desperdício.
4. **Equipe e cliente:** vendas por hora, nota e espera.
5. **Expansão e qualidade dos dados:** prontidão operacional e limites da evidência.

## Regras essenciais

- Período principal: últimos 28 dias disponíveis versus os 28 anteriores.
- Ausência de linha de venda significa loja fechada e vendas zero: métricas de venda usam todos os dias-calendário e exibem os dias sem abertura.
- Cliente: últimos 90 dias e pelo menos 10 avaliações válidas.
- “Margem após insumos” não é lucro e não deve ser usada isoladamente para decidir expansão.

As definições completas estão em `docs/documento-projeto.md`; justificativas e condições de invalidação estão em `docs/decisoes-de-projeto.md`.
