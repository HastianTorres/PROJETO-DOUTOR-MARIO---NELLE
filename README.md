# Controle de Remédios - Firebase

Versão com Firebase Firestore para sincronizar os dados entre dispositivos.

## Arquivos

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `manifest.json`
- `service-worker.js`
- `icon-192.png`

## Antes de testar

No Firebase Console, vá em:

Firestore > Regras

E publique temporariamente:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read, write: if true;
    }
  }
}
```

Depois suba os arquivos para o GitHub Pages.

## Observação

Esta versão sincroniza os dados entre notebook e celular usando o documento:

`usuarios/mae`

Este app não substitui orientação médica.


## Atualização: reset visual após meia-noite

A tela agora verifica automaticamente a mudança de dia a cada minuto.
Quando passa da meia-noite:

- a tela "Hoje" muda para o novo dia;
- os remédios aparecem como pendentes novamente;
- o histórico antigo continua salvo;
- os lembretes da sessão são liberados para tocar no novo dia.


## Atualização: relatórios CSV

Agora existem 3 relatórios:

1. Histórico de doses CSV
   - Mostra apenas o que foi marcado como “Tomei”.
   - Se nada foi marcado ainda, o arquivo avisa que não há registros.

2. Remédios cadastrados CSV
   - Mostra todos os remédios cadastrados, mesmo que nenhuma dose tenha sido marcada.

3. Agenda 30 dias CSV
   - Mostra as doses previstas para os próximos 30 dias.
   - Cada linha aparece como `tomado` ou `pendente`.
