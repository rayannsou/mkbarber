# MK Barber, prise de rendez-vous

Site simple (HTML) à héberger gratuitement avec GitHub Pages.

## Mettre le site en ligne

1. Sur github.com, créez un dépôt public, par exemple `MK-BARBER`.
2. Ouvrez le dépôt, puis **Add file > Upload files**.
3. Déposez tous les fichiers de ce dossier (`index.html`, `config.js`, `logo.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest`) et validez avec **Commit changes**.
4. Allez dans **Settings > Pages**. Sous « Branch », choisissez `main` et `/ (root)`, puis **Save**.
5. Après une minute, le site est disponible à l'adresse `https://VOTRE-NOM.github.io/MK-BARBER/`.

Sur téléphone, ouvrez ce lien puis « Ajouter à l'écran d'accueil » pour avoir une icône comme une appli.

## Comment ça marche

- Le client choisit une prestation, un jour et une heure libre, puis prépare sa demande. Le site lui donne un message prêt à envoyer à MK Barber (WhatsApp si vous avez saisi votre numéro, sinon Instagram ou copier-coller).
- Le rendez-vous est confirmé quand vous répondez au client.
- Le site n'a pas de base de données. Les créneaux pris et les horaires sont lus dans le fichier `config.js`.

## Espace gérant (onglet Connexion)

- Code par défaut : **0000**. Changez-le tout de suite dans Réglages > Code gérant.
- Rendez-vous : notez les rendez-vous que vous avez confirmés. Le créneau disparaît de la liste des clients après publication.
- Réglages : horaires par jour (plusieurs plages possibles, par exemple samedi 8h à 15h et 17h à 18h), jours de fermeture, prestations, numéro WhatsApp.
- Publier : copiez le texte affiché et collez-le dans `config.js` sur GitHub (crayon, puis **Commit changes**). Tant que ce n'est pas fait, vos modifications ne sont visibles que sur votre appareil.

Le code gérant ne sert qu'à afficher ces outils. Ce qui compte vraiment, c'est l'accès à votre compte GitHub : seul le propriétaire du dépôt peut changer `config.js`.
