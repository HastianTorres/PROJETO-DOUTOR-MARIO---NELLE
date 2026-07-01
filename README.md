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
