# Inventário de TI

Projeto de inventário de equipamentos de TI que centraliza o cadastro de computadores, a identificação dos responsáveis e o acompanhamento de substituições e entregas. A aplicação reúne informações que ajudam a equipe de TI a consultar os ativos, organizar a manutenção dos cadastros e planejar a renovação dos equipamentos.

Esta versão foi preparada para demonstração em portfólio. A identidade visual, as contas e todos os registros são fictícios, gerados do zero.

## Quais problemas a aplicação resolve

| Problema | Como a aplicação ajuda |
| --- | --- |
| Informações de equipamentos espalhadas em planilhas ou registros separados | Centraliza o inventário em uma interface com cadastro, edição e consulta dos ativos. |
| Dificuldade para identificar quem utiliza cada computador e em qual setor | Relaciona o equipamento ao usuário, setor, sistema operacional e tipo de aquisição. |
| Pouca visibilidade sobre a distribuição dos equipamentos | Apresenta indicadores e gráficos com filtros por setor, tipo de equipamento, sistema operacional e aquisição. |
| Dificuldade para consultar equipamentos próprios e alugados | Permite filtrar os ativos por modalidade de aquisição e acessar uma visão dedicada às máquinas alugadas. |
| Solicitações de troca sem critérios claros de prioridade | Registra avaliações e calcula uma prioridade sugerida com base na frequência das falhas e no impacto no trabalho, mantendo a aprovação sob análise técnica. |
| Falta de acompanhamento entre a aprovação de uma troca e a entrega | Organiza os equipamentos aprovados em uma lista de entregas, com situação, data e identificação de quem recebeu. |
| Retrabalho ao cadastrar o novo equipamento após uma substituição | Integra o registro da entrega ao cadastro ou à atualização do novo equipamento no inventário. |
| Dificuldade para rastrear alterações nos cadastros | Mantém um histórico das inclusões, edições e exclusões, com responsável e valores anteriores e posteriores. |

## Principais funcionalidades

- Cadastro, edição, exclusão e consulta de equipamentos.
- Pesquisa, filtros, ordenação e paginação do inventário.
- Dashboard interativo e exportação da seleção em CSV.
- Registro de avaliações para substituição de equipamentos.
- Parecer técnico, aprovação e controle de entregas.
- Histórico de alterações do inventário.
- Login com sessão e perfis administrativos de demonstração.

## Fluxo de uso

1. Cadastrar os equipamentos e seus responsáveis.
2. Consultar o inventário e analisar a distribuição dos ativos no dashboard.
3. Registrar uma avaliação quando um equipamento apresentar necessidade de substituição.
4. Analisar a prioridade sugerida, registrar o parecer técnico e decidir sobre a aprovação.
5. Acompanhar a entrega e vincular o novo equipamento ao inventário.
6. Consultar o histórico para conferir as alterações realizadas nos cadastros.

## Tecnologias

- **Node.js e Express:** API e servidor da aplicação.
- **SQLite:** armazenamento local do inventário e da auditoria.
- **JSON:** armazenamento local das avaliações e entregas.
- **HTML, CSS, JavaScript e Bootstrap:** interface web com recursos servidos localmente.

## Executar

Requer Node.js 24 ou superior e npm. Na pasta deste projeto:

```powershell
npm ci --ignore-scripts
npm start
```

Abra [a aplicação local](http://127.0.0.1:4317).

Contas de demonstração: `demo.admin` ou `demo.gestor`. Senha pública para ambas: `Demo-Portfolio-2026!`. As duas têm perfil administrador para demonstrar o fluxo completo. Não reutilize essas credenciais em outros sistemas.

## Configuração e dados

Opcionalmente, copie `.env.example` para `.env` e altere `DEMO_PORT`. Nenhuma outra configuração é aceita. Não configure servidores ou credenciais externos.

O primeiro início cria 72 equipamentos e 12 avaliações sintéticos em `data/demo.sqlite` e `data/evaluations.json`. A pasta `data` e o arquivo `.env` ficam fora do Git. Para restaurar o cenário inicial, pare o servidor e exclua somente a pasta `data` deste projeto; os arquivos serão recriados no próximo início.

O servidor aceita apenas acesso local direto, sem proxy ou origens externas, e recusa início com `NODE_ENV=production`. A demo não possui conexões à infraestrutura corporativa. As contas públicas são destinadas somente à execução local; não exponha a aplicação na internet.

## Licenças e divulgação

O aviso de licença MIT do Bootstrap está em `frontend/vendor/bootstrap/LICENSE`. Antes de publicar código, design ou regras reaproveitados de trabalho profissional, confirme a autorização empresarial. Nenhuma licença de redistribuição do código próprio foi presumida.
