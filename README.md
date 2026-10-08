# Insta Export 1080x1350

Clic droit sur un dossier photo → exports format Instagram **1080x1350** (portrait 4:5) :
fond flouté (cover), photo nette ajustée + coins arrondis + cadre papier texturé.

## Contenu

| Fichier | Rôle |
|---|---|
| `Insta-Folder.ps1` | Moteur (ffmpeg) : traite un dossier + sous-dossiers, sortie `D:\PXC\insta\<Nom>\` |
| `Install-ContextMenu.ps1` | Ajoute l'entrée clic droit (HKCU, sans admin) |
| `papier-blanc-200.jpg` | Motif papier du cadre (requis, à côté du .ps1) |
| `insta-logo.ico` | Icône de l'entrée menu |
| `Insta-Post-1080x1350.jsx` | Variante Photoshop (finition premium manuelle) |

## Prérequis

* Windows 10/11, PowerShell 5.1+
* `ffmpeg.exe` accessible (`C:\ffmpeg\bin\ffmpeg.exe`, `D:\ffmpeg\bin\ffmpeg.exe` ou PATH)

## Installation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Install-ContextMenu.ps1
```

Désinstaller :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Install-ContextMenu.ps1 -Uninstall
```

## Utilisation

Clic droit sur un dossier (ex `D:\PXC\insta\Normandie`) → **Exporter Insta 1080x1350**.
Sortie : `D:\PXC\insta\Normandie\` (`*_insta_1080x1350.jpg`, arborescence conservée,
originaux jamais touchés ni retraités grâce au filtre `_insta_1080x1350`).

Ligne de commande :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Insta-Folder.ps1 "D:\PXC\insta\Normandie"
# Variante test vers un autre dossier racine :
powershell -NoProfile -ExecutionPolicy Bypass -File Insta-Folder.ps1 "D:\source" -ExportRoot "D:\tmp\out" -NoPause
```

En cas d'échec sur un fichier : cause affichée + log complet dans `<sortie>\_ERREURS.txt`.

## Réglages (en-tête de `Insta-Folder.ps1`)

`$Marge` (taille photo centrale), `$Cadre`, `$FlouSigma`, `$RayonInterne/Externe`
(coins arrondis), `$PapierOpacite`, `$QualiteJpg`.
