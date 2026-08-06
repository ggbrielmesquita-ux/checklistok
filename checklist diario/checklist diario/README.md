# Diz aí

Checklist de tarefas do dia a dia. Você fala ("trocar o óleo do carro, às
três da tarde, pagar o documento do carro") e o app separa automaticamente
em itens de checklist, agrupa por sessão (tema) e organiza por data. Também
dá para digitar.

100% HTML/CSS/JS puro, sem framework e sem build. Nenhuma chamada de rede —
tudo roda e é salvo no próprio aparelho (`localStorage`). Não há IA nem
serviço externo de "entendimento de linguagem": a separação de tarefas, a
classificação por sessão e a leitura de horário são feitas por regras e
palavras-chave, no próprio dispositivo.

## Funcionalidades

- **Voz (função principal)**: segure o botão verde grande embaixo da tela,
  fale, solte — a tarefa (ou tarefas) já entra na lista, sem confirmação.
- **Texto**: campo acima do botão de voz, com Enter ou botão de enviar.
- **Separação automática**: uma fala corrida vira vários itens (por vírgula,
  ponto, "e", "também", "depois" etc). Lógica isolada em `js/parser.js`.
- **Sessões automáticas**: cada tarefa é classificada por palavra-chave numa
  sessão (Carro, Casa, Trabalho, Saúde, Mercado, Financeiro, Família,
  Outros) e a lista agrupa tarefas relacionadas juntas, dentro do dia.
  Lógica isolada em `js/categories.js` — é só uma lista de palavras-chave
  por sessão, dá pra ajustar sem mexer em mais nada.
- **Horário falado**: se você disser "às três da tarde", "15h30",
  "meio-dia" etc., o app reconhece isso como horário da tarefa (não como
  uma tarefa nova), mostra como etiqueta ao lado do texto e ordena as
  tarefas da sessão por esse horário. Lógica isolada em `js/time.js`.
- **Organização por dia**: "Hoje", "Ontem", ou dia da semana + data por
  extenso para dias mais antigos. A data usa sempre o horário local do
  aparelho.
- **Marcar / editar / excluir**: toque no círculo para concluir, toque longo
  ou duplo toque no texto para editar, botão ✕ para excluir (com desfazer).
- **PWA instalável**: funciona offline depois da primeira visita, pode ser
  adicionado à tela inicial no Android e no iOS.
- **Backup manual**: exportar/importar tarefas em JSON (ícones no cabeçalho).

## Estrutura

```
dizai/
├── index.html
├── manifest.json
├── sw.js
├── vercel.json
├── css/styles.css
└── js/
    ├── app.js         inicialização, conecta os módulos
    ├── store.js       estado + persistência em localStorage
    ├── parser.js      separa texto/fala em tarefas (função pura)
    ├── time.js        lê horário falado dentro do texto (função pura)
    ├── categories.js  classifica a tarefa numa sessão por palavra-chave
    ├── speech.js      Web Speech API, isolado
    └── ui.js          renderização e eventos de tela
```

Cada módulo tem uma responsabilidade só, então dá pra pedir ajustes em um
arquivo por vez sem mexer nos outros: mudar as sessões é só em
`js/categories.js`, mudar como o horário é lido é só em `js/time.js`, mudar
como a fala é separada em tarefas é só em `js/parser.js`.

### Como funciona o agrupamento por sessão

Não existe um modelo de linguagem por trás — é um classificador local por
palavra-chave. `js/categories.js` tem uma lista fixa de sessões, cada uma
com suas palavras (ex.: sessão "Carro" reconhece "carro", "óleo", "pneu",
"ipva" etc.). O texto da tarefa é comparado contra essas listas, na ordem
em que aparecem no arquivo — a primeira sessão que bater vence. Por isso
"pagar o documento do carro" cai em "Carro" (não em "Financeiro"): a sessão
Carro vem antes na lista e "carro" está nela. Ajustar quais palavras
pertencem a cada sessão, ou a ordem de prioridade, é só editar o array
`CATEGORIES` nesse arquivo.

O reconhecimento de horário (`js/time.js`) segue a mesma filosofia: cobre
os formatos mais comuns da fala em português ("três da tarde", "15h30",
"meio-dia", "nove e meia da manhã"), mas não entende toda variação possível
(ex. "quinze pra as quatro" não é reconhecido). Quando a expressão de
horário aparece sozinha, numa pausa própria da fala (como no exemplo "...,
às três da tarde, ..."), ela é anexada à tarefa anterior em vez de virar um
item vazio.

## Como rodar localmente

A Web Speech API (o botão de voz) **só funciona em contexto seguro**
(`https://` ou `http://localhost`). Abrir o `index.html` direto com duplo
clique (`file://...`) faz o app carregar, mas o microfone fica desabilitado
e o app mostra um aviso explicando isso.

Para testar completo, sirva a pasta por um servidor local, por exemplo:

```bash
npx serve .
# ou
python -m http.server 8080
```

Depois acesse `http://localhost:PORTA` no navegador do computador, ou pelo
celular na mesma rede Wi-Fi usando o IP do computador
(`http://192.168.x.x:PORTA`) — nesse caso, como não é `https`, alguns
navegadores de celular ainda bloqueiam o microfone. Para testar voz no
celular de verdade, publique num link https (ver abaixo) e acesse por ele.

## Como publicar no Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) (se ainda não tiver).
2. Instale a CLI (opcional) ou use o site:
   - **Pelo site**: "Add New… → Project", importe a pasta/repositório com
     estes arquivos. Como é um site estático, não precisa configurar build
     command nem output directory — deixe em branco/"Other".
   - **Pela CLI**:
     ```bash
     npm i -g vercel
     cd dizai
     vercel
     ```
     Siga as perguntas (aceite os padrões) e confirme o deploy.
3. Ao final, o Vercel te dá uma URL `https://seu-projeto.vercel.app`. Abra
   essa URL no celular — é nela que o microfone funciona.
4. No Android (Chrome) ou iOS (Safari), abra o menu do navegador e escolha
   "Adicionar à tela inicial" / "Instalar app" para instalar como PWA.

Publicar no Netlify é equivalente: arraste a pasta no
[app.netlify.com/drop](https://app.netlify.com/drop) ou conecte o
repositório — também sem build command, `index.html` já está na raiz.

## Como testar cada funcionalidade no celular

Depois de publicar e abrir pelo link https:

1. **Voz — caminho feliz**: segure o botão verde, fale 2–3 tarefas
   separadas por "e" ou vírgula, solte. Devem aparecer como itens
   separados em "Pendentes" de hoje.
1b. **Sessão + horário**: fale algo como "trocar o óleo do carro, às três
   da tarde, pagar o documento do carro" — devem virar 2 tarefas dentro da
   mesma sessão "Carro", a primeira com a etiqueta "15:00".
2. **Toque acidental**: encoste e solte o botão bem rápido (menos de meio
   segundo) — deve aparecer o aviso "Segure o botão enquanto fala..." e
   nada deve ser adicionado.
3. **Permissão negada**: nas configurações do site (no navegador), bloqueie
   o microfone e tente gravar — deve aparecer mensagem pedindo pra liberar
   o microfone, sem o app travar.
4. **iOS com pausas**: no Safari do iPhone, segure o botão, fale uma frase
   com uma pausa no meio ("comprar pão... e leite") sem soltar o botão — o
   texto reconhecido deve continuar acumulando, sem sumir com o que já foi
   dito.
5. **Texto**: digite algo no campo, aperte Enter e depois teste também o
   botão de enviar (só fica colorido quando há texto).
6. **Concluir/editar/excluir**: toque no círculo para marcar como feita
   (fica verde e riscada); toque duas vezes (ou segure) no texto para
   editar; toque no ✕ para excluir e use "Desfazer" no aviso que aparece.
7. **Virada de dia**: mude a data do aparelho (ou deixe o app aberto
   passando da meia-noite) e volte para o app — deve aparecer um bloco
   novo "Hoje" sozinho.
8. **Offline**: com o app já aberto uma vez (para o service worker
   instalar o cache), ative o modo avião e recarregue — o app deve
   continuar abrindo e mostrando as tarefas salvas.
9. **Instalar como app**: use "Adicionar à tela inicial" e reabra pelo
   ícone — deve abrir em tela cheia, sem barra de endereço.
10. **Exportar/importar**: toque no ícone de exportar para baixar um JSON,
    depois no de importar para reabrir o mesmo arquivo (ou em outro
    aparelho) e conferir que as tarefas voltam.

## Limitações conhecidas

- O reconhecimento de voz depende do navegador: funciona bem em Chrome
  Android e Safari iOS recentes. Firefox para desktop/Android não tem
  `SpeechRecognition` — o app detecta isso e desativa o botão de voz com
  aviso, mas o campo de texto continua funcionando normalmente.
- A precisão da transcrição é a que o motor de voz do sistema operacional
  entrega — o app não faz nenhum pós-processamento além de separar frases
  em tarefas.
- É um backup manual (exportar/importar JSON); não há sincronização
  automática entre aparelhos.
- A sessão (Carro, Casa, Trabalho...) é decidida por palavra-chave, não por
  IA — frases ambíguas ou sem nenhuma palavra da lista caem em "Outros".
  Editar `js/categories.js` ajusta isso.
- O horário falado cobre os formatos mais comuns em português ("três da
  tarde", "15h30", "meio-dia"), mas não toda variação possível — frases
  como "quinze pra as quatro" ou minutos compostos ditos por extenso
  ("vinte e cinco") podem não sair exatos. Editar `js/time.js` ajusta isso.
