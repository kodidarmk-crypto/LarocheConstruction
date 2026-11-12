# Application admin Windows (Visual Basic)

Le projet Visual Basic est dans `admin-desktop/`. Il fournit une fenêtre Windows avec un navigateur WebView2 intégré qui ouvre `/page/admin.html`. Les opérations (ajout de plans/PDF, actualités/images, liens sociaux, chiffres clés, statistiques, commandes) sont celles du tableau web déjà protégé. L’application ne duplique pas les clés serveur et ne stocke pas les mots de passe.

## Compilation sur Windows

L’exécutable x64 autonome est inclus dans `admin-desktop/publish/win-x64/LarocheAdmin.exe`. Le code VB source et le script de reproduction sont également fournis.

Pour le recompiler sur Windows, installer le **SDK .NET 10** puis ouvrir PowerShell dans `admin-desktop` et lancer :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\build.ps1
```

Le script publie `admin-desktop/publish/win-x64/LarocheAdmin.exe` en version autonome .NET 10 x64. **Microsoft Edge WebView2 Runtime (Evergreen)** doit aussi être présent sur le PC client (souvent déjà installé avec Edge).

Lancer le programme, entrer l’URL HTTPS de `larocheconstruction.com` ou du projet `*.vercel.app`, puis se connecter dans l’écran admin avec les identifiants préparés dans Supabase. Pour éviter une URL trompeuse, seuls `larocheconstruction.com`, ses sous-domaines, les domaines Vercel et `localhost` en développement sont acceptés.

Pour le développement local seulement, l’application accepte `http://localhost:<port>` et `http://127.0.0.1:<port>`. Les autres hôtes non autorisés sont refusés; les liens externes HTTPS s’ouvrent dans le navigateur Windows. Un profil navigateur propre à cette application est enregistré sous `%LOCALAPPDATA%\Laroche Construction\AdminDesktop\WebView2`; l’URL du site seule est enregistrée sous `%APPDATA%\Laroche Construction\AdminDesktop\settings.json`.

## Création et sécurité des comptes

L’application **ne crée pas elle-même de compte admin**. C’est intentionnel : une API d’inscription admin intégrée à un exécutable distribuable permettrait à un tiers de s’attribuer les droits. Le propriétaire doit inviter/créer le compte dans **Supabase → Authentication → Users**, puis autoriser l’UUID et définir le PIN bcrypt selon [`SUPABASE-EDITEUR.md`](SUPABASE-EDITEUR.md). L’admin se connecte ensuite par email, mot de passe et PIN à six chiffres.

L’exécutable est un client graphique du panneau web; ce n’est pas un accès hors ligne. Il a besoin d’Internet, du site Vercel et de WebView2. La session utilise un cookie HttpOnly signé par le serveur et expire après huit heures. Ne distribuez pas de secrets, fichier `.env`, clé Supabase secrète, token Monetbil ou token Telegram avec le programme.

## Distribution

Le binaire est compilé en Windows x64, autonome pour .NET, mais **non signé numériquement**. Windows SmartScreen peut donc afficher un avertissement lors du premier lancement; pour une distribution commerciale, signez-le avec un certificat de signature de code appartenant à l’entreprise. Le fichier ne contient aucune clé API. Il stocke seulement l’URL choisie et le profil WebView2 dans les dossiers AppData Windows.
