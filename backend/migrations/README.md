# Migrations — CAP-EPAC

## ⚠️ Règle importante

**Ce dossier est vide intentionnellement.**

Dans ce projet, les modifications de schéma de base de données se font directement dans le fichier :

```
scripts/init.sql
```

## Comment ajouter une table ou modifier le schéma

1. **Ouvrir `scripts/init.sql`**
2. **Ajouter ta table ou ta modification** au bon endroit (respecter l'ordre des dépendances via les FOREIGN KEY)
3. **Appliquer manuellement** sur la base existante via Docker :

```bash
# Appliquer init.sql depuis zéro (nouveau déploiement)
docker exec -i cap-epac-mysql mysql -u cap_epac_user -p'CapEpac@2025' db_telephonie_cap_epac < scripts/init.sql

# Appliquer une seule commande ALTER/CREATE sur la base existante
docker exec cap-epac-mysql mysql -u cap_epac_user -p'CapEpac@2025' db_telephonie_cap_epac -e "ALTER TABLE ..."
```

## Ce qui a déjà été intégré dans init.sql

| Date       | Changement                                              |
|------------|---------------------------------------------------------|
| 2026-05-30 | Ajout colonne `delivered_at` dans `messages`            |
| 2026-05-30 | Création table `notifications`                          |
