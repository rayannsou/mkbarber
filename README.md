# MK Barber, prise de rendez-vous

Site HTML hébergé avec GitHub Pages. Les demandes sont enregistrées dans une base Supabase (projet « MK Barber »).

## Fonctionnement

- Le client choisit une prestation, un jour et une heure libre, puis envoie sa demande. Elle reste **en attente**.
- Le gérant ouvre l'onglet **Connexion**, saisit son code et voit les demandes. Il les **confirme** ou les **refuse**.
- Le client retrouve la réponse dans **Mes rendez-vous** (sur le même appareil).
- Un créneau demandé ou confirmé n'est plus proposé aux autres clients. Un refus ou une annulation le libère.

## Espace gérant

- **Demandes** : confirmer ou refuser.
- **Agenda** : rendez-vous confirmés, annulation, ajout manuel d'un rendez-vous (client pris par téléphone).
- **Réglages** : horaires par jour avec plusieurs plages (par exemple samedi 8h à 15h et 17h à 18h), jours de fermeture, prestations et prix, changement du code.
- Après 5 codes faux, la connexion est bloquée 15 minutes.

## Fichiers

- `index.html` : la page
- `app.js` : le fonctionnement du site
- `config.js` : adresse de la base et clé publique (conçue pour être visible, les données sont protégées côté base)
- `logo.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` : logo et icône d'appli

## Mise en ligne

GitHub, onglet **Settings**, puis **Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`.
