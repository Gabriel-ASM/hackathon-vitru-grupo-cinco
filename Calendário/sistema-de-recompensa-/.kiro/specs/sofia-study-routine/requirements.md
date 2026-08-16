# Requirements Document

## Introduction

O **Sofia Planner — Rotina de Estudos** é um painel lateral integrado ao `calendario.js` do AVA (Ambiente Virtual de Aprendizagem) da Uniasselvi. O painel exibe, no espaço vazio abaixo da lista de eventos acadêmicos, a tarefa de estudo do dia selecionado no calendário, com suporte a marcação de conclusão, sistema de pontos gamificado e persistência local — tudo sem modificar ou remover qualquer funcionalidade existente do calendário.

O escopo desta feature é exclusivamente o front-end do `calendario.js`. Integrações com API real, backend e notificações push são fora de escopo nesta iteração e devem ser preparadas apenas em termos de arquitetura extensível.

---

## Glossary

- **AVA**: Ambiente Virtual de Aprendizagem da Uniasselvi/UniCesumar, acessado em `ava.uniasselvi.com.br`.
- **Calendário_AVA**: O módulo `calendario.js` existente que consome a API `https://api-ava.uniasselvi.com.br/calendar/event/get` e renderiza o calendário com eventos acadêmicos.
- **Painel_Meta**: O novo componente "🎯 Minha meta de hoje" inserido abaixo da área de eventos no layout do AVA.
- **Study_Goals**: Estrutura de dados que mapeia datas a tarefas de estudo (`{ date, subject, duration, action, points }`).
- **Tarefa_Do_Dia**: O registro de `Study_Goals` correspondente à data atualmente selecionada no calendário.
- **Dia_De_Descanso**: Um dia sem `Tarefa_Do_Dia` associada, identificado por disciplina nula ou ausência de entrada em `studyGoals`.
- **Checkbox_Conclusao**: Elemento interativo que permite ao aluno marcar ou desmarcar uma tarefa como concluída.
- **Sistema_De_Pontos**: Mecanismo de gamificação que acumula e desconta pontos com base nas ações do `Checkbox_Conclusao`.
- **Card_Pontuacao**: Componente visual que exibe a pontuação atual e o botão "Retirar pontos".
- **Modal_Confirmacao**: Diálogo de confirmação exibido antes de zerar a pontuação.
- **LocalStorage**: API do navegador utilizada para persistir o estado das tarefas concluídas e a pontuação entre sessões.
- **Data_Selecionada**: A data atualmente ativa no calendário, controlada pelo usuário ao clicar nos dias do calendário.

---

## Requirements

---

### Requisito 1: Preservação do Calendário Existente

**User Story:** Como desenvolvedor do AVA, quero que a adição do Painel_Meta não altere nenhuma funcionalidade do Calendário_AVA, para que os alunos continuem acessando eventos acadêmicos sem interrupções.

#### Critérios de Aceitação

1. WHEN o Painel_Meta é inserido, THE Calendário_AVA SHALL renderizar o calendário, consumir a API de eventos e exibir o layout com comportamento idêntico ao estado pré-inserção do Painel_Meta.
2. WHEN o Painel_Meta é inserido, THE Calendário_AVA SHALL manter a identidade visual com aparência idêntica ao estado pré-inserção, incluindo cabeçalho, fundo, tipografia e espaçamentos.
3. WHEN o aluno interage com controles de navegação de mês ou seleção de dias, THE Calendário_AVA SHALL responder em até 300ms e os eventos de clique destinados ao Calendário_AVA não SHALL ser interceptados ou consumidos pelo Painel_Meta.
4. IF a API `https://api-ava.uniasselvi.com.br/calendar/event/get` retornar erro, THEN THE Calendário_AVA SHALL exibir o mesmo comportamento de erro que apresentava antes da inserção do Painel_Meta, sem propagar o erro nem alterar o estado de renderização do Painel_Meta.

---

### Requisito 2: Exibição da Tarefa do Dia no Painel_Meta

**User Story:** Como aluno do AVA, quero ver a tarefa de estudo do dia que selecionei no calendário, para saber exatamente o que estudar, por quanto tempo e qual ação realizar.

#### Critérios de Aceitação

1. WHEN o Calendário_AVA é carregado, THE Painel_Meta SHALL exibir a Tarefa_Do_Dia correspondente à data atual do sistema formatada como `YYYY-MM-DD`.
2. WHEN o aluno seleciona um dia no Calendário_AVA, THE Painel_Meta SHALL concluir a atualização do seu conteúdo visível no DOM em até 200ms, sem recarregar a página.
3. IF a Tarefa_Do_Dia existe para a Data_Selecionada, THEN THE Painel_Meta SHALL exibir o nome da disciplina, a duração em minutos e a descrição da ação correspondentes.
4. THE Painel_Meta SHALL exibir a Data_Selecionada no formato "dia-da-semana, DD de mês" em português brasileiro (ex: "segunda-feira, 11 de agosto").
5. IF a Data_Selecionada não possui entrada em `studyGoals`, THEN THE Painel_Meta SHALL exibir a mensagem "🌱 Dia de descanso" e ocultar o Checkbox_Conclusao e o Card_Pontuacao da tarefa.
6. IF a Tarefa_Do_Dia possui disciplina nula, THEN THE Painel_Meta SHALL exibir a mensagem de Dia_De_Descanso e ocultar o Checkbox_Conclusao e o Card_Pontuacao da tarefa.

---

### Requisito 3: Arquitetura Extensível dos Dados de Estudo

**User Story:** Como desenvolvedor do AVA, quero que a estrutura `studyGoals` seja definida de forma isolada e substituível, para que no futuro a fonte de dados possa ser trocada por uma API real sem refatoração do componente principal.

#### Critérios de Aceitação

1. WHEN o Painel_Meta é inicializado, THE Painel_Meta SHALL carregar os dados de Tarefa_Do_Dia exclusivamente a partir de uma estrutura `studyGoals` declarada fora do escopo do componente principal, de modo que substituir `studyGoals` por outra fonte de dados não exija alteração no código interno do componente.
2. WHEN o Painel_Meta é inicializado com os dados mockados iniciais de `studyGoals`, THE Painel_Meta SHALL renderizar a Tarefa_Do_Dia correspondente à data atual sem lançar exceções nem exibir estado de erro ao usuário.
3. WHEN uma string de data no formato `YYYY-MM-DD` é fornecida à função de lookup, THE Painel_Meta SHALL retornar o registro de Tarefa_Do_Dia que contenha ao menos os campos de título (subject), duração e descrição da ação, ou `null` caso nenhum registro com aquela data exista em `studyGoals`.
4. IF a função de lookup retornar `null` para a data atual, THEN THE Painel_Meta SHALL exibir um estado de Dia_De_Descanso indicando ausência de tarefa para o dia, sem lançar exceções.

---

### Requisito 4: Checkbox de Conclusão de Tarefa

**User Story:** Como aluno do AVA, quero marcar minha tarefa do dia como concluída com um clique, para registrar meu progresso e sentir satisfação ao completar o estudo.

#### Critérios de Aceitação

1. IF a Tarefa_Do_Dia existe, THEN THE Painel_Meta SHALL exibir um Checkbox_Conclusao com o rótulo "Concluir atividade" no estado desmarcado, a menos que o LocalStorage indique que essa tarefa já foi concluída.
2. IF o Checkbox_Conclusao está no estado desmarcado e o aluno o aciona, THEN THE Sistema_De_Pontos SHALL adicionar exatamente 50 pontos à pontuação total.
3. IF o Checkbox_Conclusao está no estado desmarcado e o aluno o aciona, THEN THE Checkbox_Conclusao SHALL exibir o rótulo "Atividade concluída" no estado marcado.
4. IF o Checkbox_Conclusao está no estado marcado e a pontuação total atual é maior ou igual a 50 e o aluno o aciona, THEN THE Sistema_De_Pontos SHALL subtrair exatamente 50 pontos da pontuação total.
5. IF o Checkbox_Conclusao está no estado marcado e o aluno o aciona, THEN THE Checkbox_Conclusao SHALL retornar ao rótulo "Concluir atividade" no estado desmarcado.
6. WHEN o aluno aciona o Checkbox_Conclusao múltiplas vezes dentro de uma janela de 300ms, THE Sistema_De_Pontos SHALL processar apenas o primeiro acionamento, ignorando os demais até que a janela expire.
7. IF o Checkbox_Conclusao está no estado marcado e a pontuação total atual é menor que 50 e o aluno o aciona, THEN THE Checkbox_Conclusao SHALL permanecer no estado marcado e a pontuação total SHALL permanecer inalterada.
8. IF o LocalStorage não puder ser lido ao restaurar o estado, THEN THE Checkbox_Conclusao SHALL exibir o estado desmarcado por padrão.

---

### Requisito 5: Sistema de Pontos

**User Story:** Como aluno do AVA, quero acumular pontos ao concluir tarefas, para ter motivação gamificada durante minha rotina de estudos.

#### Critérios de Aceitação

1. WHEN o Sistema_De_Pontos é carregado e não existem dados de pontuação válidos no LocalStorage, THE Sistema_De_Pontos SHALL inicializar a pontuação total com 0 pontos e persistir esse valor no LocalStorage.
2. WHEN uma tarefa é marcada como concluída, THE Sistema_De_Pontos SHALL incrementar a pontuação total em exatamente 50 pontos.
3. WHEN uma tarefa é desmarcada, THE Sistema_De_Pontos SHALL decrementar a pontuação total em exatamente 50 pontos.
4. IF a pontuação total atual for 0 e uma tarefa é desmarcada, THEN THE Sistema_De_Pontos SHALL manter a pontuação total em 0 pontos, sem resultar em valor negativo.
5. WHEN o estado do Sistema_De_Pontos é alterado, THE Sistema_De_Pontos SHALL atualizar o LocalStorage de forma síncrona com a nova pontuação total antes de qualquer renderização do Card_Pontuacao.
6. WHEN a pontuação total é atualizada, THE Card_Pontuacao SHALL exibir o valor atual no formato "⭐ X PONTOS", onde X é o número inteiro correspondente à pontuação total, incluindo o valor 0.
7. WHEN o Sistema_De_Pontos é carregado e existem dados de pontuação válidos no LocalStorage, THE Sistema_De_Pontos SHALL restaurar a pontuação total com o valor previamente persistido.
8. IF os dados de pontuação no LocalStorage estiverem corrompidos ou contiverem valor não numérico, THEN THE Sistema_De_Pontos SHALL inicializar a pontuação total com 0 pontos e sobrescrever o valor inválido no LocalStorage.

---

### Requisito 6: Card de Pontuação e Modal de Confirmação

**User Story:** Como aluno do AVA, quero visualizar minha pontuação acumulada e ter a opção de resgatá-la, para entender meu progresso e interagir com o sistema de recompensas.

#### Critérios de Aceitação

1. THE Card_Pontuacao SHALL ser exibido no Painel_Meta sempre que houver dados de pontuação no estado (incluindo 0 pontos), exibindo o valor numérico inteiro da pontuação atual.
2. THE Card_Pontuacao SHALL exibir um botão com o rótulo "Retirar pontos", habilitado quando a pontuação atual for maior ou igual a 1 e desabilitado quando a pontuação for 0.
3. WHEN o aluno clica no botão "Retirar pontos" habilitado, THE Modal_Confirmacao SHALL ser exibido com a pontuação atual a ser resgatada antes de executar qualquer ação.
4. WHEN o aluno confirma no Modal_Confirmacao, THE Sistema_De_Pontos SHALL zerar a pontuação total para 0, THE Modal_Confirmacao SHALL ser fechado, e THE LocalStorage SHALL ser atualizado de forma síncrona antes de qualquer nova interação do aluno ser aceita.
5. WHEN o aluno confirma no Modal_Confirmacao, THE Checkbox_Conclusao SHALL manter o estado marcado de todas as tarefas previamente concluídas — o resgate de pontos não desmarca tarefas.
6. WHEN o aluno cancela no Modal_Confirmacao, THE Sistema_De_Pontos SHALL manter a pontuação inalterada e o Modal_Confirmacao SHALL ser fechado sem modificar nenhum dado no LocalStorage.
7. IF o aluno desmarcar uma tarefa após ter resgatado os pontos (pontuação em 0), THEN THE Sistema_De_Pontos SHALL manter a pontuação em 0, sem decrementar para valor negativo.
8. WHILE o Modal_Confirmacao estiver aberto, THE Painel_Meta SHALL bloquear interações com o Checkbox_Conclusao e o botão "Retirar pontos", e IF o aluno tentar interagir com esses elementos bloqueados, THEN THE Sistema_De_Pontos SHALL ignorar a interação sem alterar o estado atual.

---

### Requisito 7: Persistência de Estado via LocalStorage

**User Story:** Como aluno do AVA, quero que meu progresso de tarefas e minha pontuação sejam preservados entre sessões do navegador, para não perder meu histórico ao fechar e reabrir o AVA.

#### Critérios de Aceitação

1. THE Painel_Meta SHALL armazenar no LocalStorage o estado de conclusão de cada tarefa indexado pela data no formato `YYYY-MM-DD`, utilizando a chave `sofia_tasks`, onde cada entrada contém a data como chave e o valor booleano de conclusão.
2. THE Painel_Meta SHALL armazenar no LocalStorage a pontuação total atual utilizando a chave `sofia_points`, onde o valor armazenado é um número inteiro não negativo.
3. WHEN o Calendário_AVA é carregado, THE Painel_Meta SHALL ler o LocalStorage e restaurar o estado de conclusão das tarefas e a pontuação total antes de renderizar qualquer componente visual do painel.
4. IF o LocalStorage não contiver a chave `sofia_tasks`, THEN THE Painel_Meta SHALL inicializar o estado de tarefas como objeto vazio sem gerar erros nem interromper a renderização.
5. IF o LocalStorage não contiver a chave `sofia_points`, THEN THE Painel_Meta SHALL inicializar a pontuação total como 0 sem gerar erros nem interromper a renderização.
6. IF o LocalStorage retornar dados malformados para a chave `sofia_tasks` ou `sofia_points` (JSON inválido ou tipo de dado inesperado), THEN THE Painel_Meta SHALL descartar os dados corrompidos, inicializar a chave afetada com seu estado padrão válido e sobrescrever imediatamente essa chave no LocalStorage antes de renderizar.
7. WHEN o Painel_Meta executa qualquer operação de leitura ou escrita no LocalStorage, THE Painel_Meta SHALL tratar exceções de quota excedida ou permissão negada de modo que a renderização da interface prossiga normalmente, exibindo no Painel_Meta uma indicação de que a persistência está indisponível nessa sessão.

---

### Requisito 8: Identidade Visual Nativa do AVA

**User Story:** Como aluno do AVA, quero que o Painel_Meta tenha aparência integrada ao sistema da Uniasselvi, para que a experiência pareça coesa e não um componente externo sobreposto.

#### Critérios de Aceitação

1. THE Painel_Meta SHALL utilizar as variáveis de cor ou valores equivalentes do tema do AVA para fundo escuro e destaque, de modo que a aparência seja visualmente consistente com o restante do calendário.
2. THE Painel_Meta SHALL utilizar a mesma família tipográfica e tamanhos de fonte do restante do `calendario.js`, sem introduzir novas fontes externas.
3. THE Painel_Meta SHALL ser inserido na área vazia abaixo da lista de eventos acadêmicos, sem deslocar ou sobrepor nenhum elemento existente do layout.
4. THE Card_Pontuacao SHALL exibir borda tracejada destacada, ícone de estrela e texto de pontuação em destaque, com estilo visualmente análogo ao card de créditos do AVA.
5. WHEN o Checkbox_Conclusao é renderizado, THE Checkbox_Conclusao SHALL utilizar apenas estilos compatíveis com o tema escuro do AVA, sem introduzir bordas ou sombras inconsistentes com o sistema.
6. WHEN o Modal_Confirmacao é exibido, THE Modal_Confirmacao SHALL utilizar fundo escuro com overlay de opacidade entre 0.5 e 0.8, compatível com o tema escuro do AVA.
7. IF as variáveis de tema do AVA não estiverem disponíveis no contexto de execução, THEN THE Painel_Meta SHALL aplicar valores de fallback de fundo escuro e destaque amarelo/dourado que preservem a legibilidade.

---

### Requisito 9: Acessibilidade e Usabilidade do Painel

**User Story:** Como aluno do AVA, quero interagir com o Painel_Meta de forma intuitiva por teclado e mouse, para que a experiência seja acessível independente de como navego na plataforma.

#### Critérios de Aceitação

1. THE Checkbox_Conclusao SHALL ser navegável por teclado via tecla `Tab` e ativável pelas teclas `Space` e `Enter`, com indicador visual de foco visível com contraste mínimo de 3:1 em relação ao fundo adjacente.
2. WHEN o Modal_Confirmacao é aberto, THE sistema SHALL mover o foco para o primeiro elemento interativo do Modal_Confirmacao e SHALL aprisionar o foco dentro do modal enquanto ele estiver aberto.
3. WHEN a tecla `Escape` é pressionada enquanto o Modal_Confirmacao está aberto, THE sistema SHALL fechar o Modal_Confirmacao e SHALL devolver o foco ao elemento que o abriu.
4. THE Painel_Meta SHALL incluir atributos `aria-label` ou `aria-labelledby` em todos os elementos interativos (Checkbox_Conclusao, botão "Retirar pontos" e botões do Modal_Confirmacao), de forma que cada elemento possua um nome acessível não vazio.
5. WHEN o Checkbox_Conclusao muda de estado, THE Painel_Meta SHALL atualizar o atributo `aria-checked` do elemento para `true` quando marcado ou `false` quando desmarcado.
6. THE Painel_Meta SHALL apresentar contraste de cor mínimo de 4.5:1 entre texto e fundo para todos os textos informativos com tamanho inferior a 18pt, em conformidade com WCAG 2.1 nível AA.
7. WHEN o Modal_Confirmacao é fechado, THE sistema SHALL remover os elementos do Modal_Confirmacao da ordem de tabulação, de forma que esses elementos não recebam foco enquanto o modal estiver fechado.

---

### Requisito 10: Desempenho e Não-Interferência

**User Story:** Como aluno do AVA, quero que a adição do Painel_Meta não torne o calendário mais lento ou quebre outras partes do sistema, para que minha experiência de estudo seja fluida.

#### Critérios de Aceitação

1. WHEN o aluno seleciona um dia no Calendário_AVA, THE Painel_Meta SHALL concluir a atualização do seu conteúdo visível no DOM em menos de 100ms.
2. WHEN o Painel_Meta registra seus event listeners, THE Calendário_AVA SHALL continuar executando todos os seus event listeners pré-existentes com comportamento e ordem de execução idênticos ao estado anterior à inserção do Painel_Meta.
3. WHEN o Painel_Meta é inicializado, THE Painel_Meta SHALL encapsular todo seu estado sem adicionar novas propriedades ao objeto `window` durante a sessão.
4. IF o navegador não suportar LocalStorage, THEN THE Painel_Meta SHALL exibir no Painel_Meta uma mensagem informando que a persistência está indisponível e SHALL manter o estado apenas em memória durante a sessão.
5. WHEN o aluno realiza operações normais de uso (clicar em dias, marcar/desmarcar tarefas, retirar pontos), THE Painel_Meta SHALL não produzir nenhuma chamada a `console.error` ou `console.warn` no navegador.
