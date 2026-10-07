# Guide de contribution

Merci de contribuer à Ohm-gato !

## Flux de travail

1. Créez une branche depuis `main` : `git checkout -b feat/ma-fonctionnalite`.
2. Faites des commits petits et ciblés.
3. Poussez la branche et ouvrez une pull request vers `main`.
4. Attendez que la CI passe et qu'une relecture soit faite avant de fusionner.

## Nommage des branches

| Préfixe     | Usage                                  |
|-------------|----------------------------------------|
| `feat/`     | Nouvelle fonctionnalité                |
| `fix/`      | Correction de bug                      |
| `docs/`     | Documentation uniquement               |
| `chore/`    | Maintenance, outillage, dépendances    |
| `refactor/` | Refactorisation sans changement de comportement |

## Messages de commit

Le projet suit [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<portée optionnelle>): <description courte>

feat: ajoute la connexion utilisateur
fix(api): corrige le délai d'expiration
docs: complète le README
```

## Signaler un bug ou proposer une idée

Utilisez les modèles d'issue disponibles dans l'onglet **Issues**. Pour une faille de sécurité, suivez plutôt [SECURITY.md](SECURITY.md).
