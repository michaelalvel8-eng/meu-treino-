# Meu Treino v13 — configuração do gerador de IA

O site estático continua sendo publicado pelo GitHub Pages. A geração real de treinos usa uma Firebase Callable Function para que a chave da API de IA nunca seja colocada no JavaScript público.

## Antes de publicar

1. Faça backup do repositório e dos dados do Firestore.
2. Instale o Firebase CLI no computador: `npm install -g firebase-tools`.
3. Entre na conta Firebase: `firebase login`.
4. Na pasta do projeto extraído, confira se `firebase use` aponta para `meu-treino-7bf42`.
5. Configure a chave da API como segredo (não a coloque em `app.js`, `index.html` ou no GitHub):
   `firebase functions:secrets:set OPENAI_API_KEY`
6. Implante somente a função:
   `firebase deploy --only functions`
7. Confirme que a função `generateWorkout` foi criada na região `southamerica-east1`.

## Custos e permissões

- A chamada à API de IA é cobrada pelo provedor de IA conforme o modelo e o uso.
- O Firebase Functions pode exigir que o projeto Firebase esteja no plano Blaze (cobrança por uso) e que o faturamento esteja habilitado.
- Confira os preços atuais do provedor e do Firebase antes de ativar faturamento.
- A chave é armazenada como Secret do Firebase e não é enviada ao navegador.
- A função exige usuário autenticado no Firebase, valida os principais campos do perfil e limita cada usuário a 10 gerações por dia para reduzir uso abusivo e custos.

## Publicação do site

Os arquivos `index.html`, `app.js`, `manifest.json` e `sw.js` ficam na raiz, como antes. Publique esses arquivos na branch `main` do repositório `meu-treino-` pelo GitHub Pages. O arquivo `firebase.json`, `.firebaserc` e a pasta `functions/` são usados para implantar o backend; não substituem a publicação do site.

## Limitações desta entrega

A função é fornecida como código-fonte e ainda precisa ser implantada na conta Firebase pelo proprietário. O gerador não funcionará até que a chave seja configurada e a função seja implantada. Nenhuma alteração foi feita diretamente no GitHub ou no Firebase remoto.
