# Installe le clic droit "Export Insta 1080x1350" sur les dossiers (HKCU, pas d'admin).
# Le style du menu (classique vs Win11) est géré par ExplorerPatcher, pas ici.
# Usage : powershell -ExecutionPolicy Bypass -File Install-ContextMenu.ps1
#   -Uninstall : retire l'entree
param([switch]$Uninstall)

$cle = "HKCU:\Software\Classes\Directory\shell\Insta1080x1350"
$cleCmd = "$cle\command"
$scriptIci = Join-Path -Path $PSScriptRoot -ChildPath "Insta-Folder.ps1"
$iconeIci = Join-Path -Path $PSScriptRoot -ChildPath "insta-logo.ico"

if ($Uninstall) {
    if (Test-Path -LiteralPath $cle) {
        Remove-Item -LiteralPath $cle -Recurse -Force
        Write-Host "Clic droit Insta supprime." -ForegroundColor Green
    } else {
        Write-Host "Rien a supprimer." -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path -LiteralPath $scriptIci -PathType Leaf)) {
    Write-Host "Introuvable : $scriptIci" -ForegroundColor Red
    exit 1
}

New-Item -Path $cle -Force | Out-Null
Set-ItemProperty -Path $cle -Name "(Default)" -Value "Exporter Insta 1080x1350"
if (Test-Path -LiteralPath $iconeIci -PathType Leaf) {
    Set-ItemProperty -Path $cle -Name "Icon" -Value $iconeIci
} else {
    Write-Host "Icone absente ($iconeIci), entree sans icone." -ForegroundColor Yellow
}
New-Item -Path $cleCmd -Force | Out-Null
$cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $scriptIci + '" "%V"'
Set-ItemProperty -Path $cleCmd -Name "(Default)" -Value $cmd

Write-Host "Installe OK. Clic droit sur un dossier -> 'Exporter Insta 1080x1350'." -ForegroundColor Green
Write-Host "Sortie : D:\PXC\insta\<Nom> (sous-dossiers conserves)" -ForegroundColor Gray
Write-Host "Style du menu : regle via ExplorerPatcher (Proprietes -> Explorateur de fichiers -> menu contextuel Windows 11 -> Desactive)." -ForegroundColor Gray
