param(
    [Parameter(Mandatory = $true)]
    [string]$Dossier,
    [string]$ExportRoot = "D:\PXC\insta",
    [switch]$NoPause
)

# Clic droit dossier -> D:\PXC\insta\export\<NomDossier>\ (arborescence sous-dossiers conservee)
# 1080x1350 : fond cover + blur | avant fit + coins arrondis + cadre vrai papier (motif Papier-3)
$ErrorActionPreference = "Continue"
$Largeur = 1080
$Hauteur = 1350
$Marge = 40
$Cadre = 14
$PapierCouleur = "0xEBE8DE"
$FlouSigma = 35
$QualiteJpg = 3
$RayonInterne = 14
$RayonExterne = 26
$PapierOpacite = 1.0   # cadre 100% texture papier -> bord externe net et bien arrondi

function Trouver-Ffmpeg {
    try {
        $w = & where.exe ffmpeg 2>$null | Select-Object -First 1
        if ($w -and (Test-Path -LiteralPath $w.Trim())) { return $w.Trim() }
    } catch {}
    foreach ($p in @("C:\ffmpeg\bin\ffmpeg.exe", "D:\ffmpeg\bin\ffmpeg.exe")) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Pause-Fin {
    if (-not $NoPause) { Read-Host "Entree pour fermer" | Out-Null }
}

if (-not (Test-Path -LiteralPath $Dossier -PathType Container)) {
    Write-Host "Dossier introuvable : $Dossier" -ForegroundColor Red
    Pause-Fin
    exit 1
}

$ffmpeg = Trouver-Ffmpeg
if (-not $ffmpeg) {
    Write-Host "ffmpeg introuvable." -ForegroundColor Red
    Pause-Fin
    exit 1
}

$papier = Join-Path -Path $PSScriptRoot -ChildPath "papier-blanc-200.jpg"
if (-not (Test-Path -LiteralPath $papier -PathType Leaf)) {
    Write-Host "Motif papier introuvable : $papier" -ForegroundColor Red
    Pause-Fin
    exit 1
}

$srcRacine = (Resolve-Path -LiteralPath $Dossier).Path
$nom = Split-Path -Leaf $srcRacine
if (-not $nom) { $nom = "export" }
if ($ExportRoot) {
    # Standard : D:\PXC\insta\<Nom> (ex clic droit Normandie -> D:\PXC\insta\Normandie... si la source
    # est deja ce dossier, les exports vont a cote des originaux, sans jamais les re-traiter)
    # Test : passer -ExportRoot "$env:TEMP\...\..." pour rediriger ailleurs.
    $sortie = Join-Path -Path $ExportRoot -ChildPath $nom
} else {
    # Defaut : dossier frere a cote de la source -> remonte d'un cran
    # ex D:\PXC\insta\Normandie -> D:\PXC\insta\Normandie_insta
    $parent = Split-Path -Parent $srcRacine
    $sortie = Join-Path -Path $parent -ChildPath ($nom + "_insta")
}
if (-not (Test-Path -LiteralPath $sortie)) { New-Item -ItemType Directory -Path $sortie | Out-Null }

$maxW = $Largeur - ($Marge * 2)
$maxH = $Hauteur - ($Marge * 2)

# Filtre ecrit dans un fichier (evite les soucis d'echappement shell).
# Rappel technique : une sortie de filtre = un seul usage -> split obligatoires.
$filtreFichier = Join-Path -Path $env:TEMP -ChildPath ("InstaFilter_" + $PID + ".txt")
$filtre = @"
[0:v]scale=${maxW}:${maxH}:force_original_aspect_ratio=decrease,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(max(0\,${RayonInterne}-min(X\,W-1-X))\,max(0\,${RayonInterne}-min(Y\,H-1-Y)))\,${RayonInterne})\,255\,0)',split=2[fgr1][fgr2];
[fgr1]pad=iw+28:ih+28:x=14:y=14:color=${PapierCouleur},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(max(0\,${RayonExterne}-min(X\,W-1-X))\,max(0\,${RayonExterne}-min(Y\,H-1-Y)))\,${RayonExterne})\,255\,0)'[paddedR];
[paddedR]split=2[aaRGB][aaA];
[aaA]format=rgba,alphaextract,format=gray,gblur=sigma=1.2[aaM];
[aaRGB][aaM]alphamerge[padded];
[padded]split=2[padA][padB];
[padA]format=rgba,alphaextract,format=gray[plateA];
[fgr2]format=rgba,alphaextract,format=gray,pad=iw+28:ih+28:x=14:y=14:color=black,format=gray[fgA];
[plateA][fgA]blend=all_mode=subtract,format=gray,gblur=sigma=1[rim];
[1:v][padB]scale2ref[tileS][padref];
[tileS]format=rgba,colorchannelmixer=aa=${PapierOpacite}[tex];
[tex][rim]alphamerge[texm];
[padref][texm]overlay=0:0,format=rgba[framed];
[0:v]scale=${Largeur}:${Hauteur}:force_original_aspect_ratio=increase,crop=${Largeur}:${Hauteur},gblur=sigma=${FlouSigma},format=rgba[bg];
[bg][framed]overlay=(W-w)/2:(H-h)/2,format=yuvj420p
"@
Set-Content -LiteralPath $filtreFichier -Value $filtre -Encoding Ascii -NoNewline

$fichiers = Get-ChildItem -LiteralPath $srcRacine -Recurse -File | Where-Object {
    ($_.Extension -match '^\.(jpg|jpeg|png|tif|tiff)$') -and ($_.Name -notmatch '_insta_1080x1350')
}

if ($fichiers.Count -eq 0) {
    Write-Host "Aucune image (avec sous-dossiers) dans $srcRacine" -ForegroundColor Yellow
    Pause-Fin
    exit 0
}

$ok = 0
$ko = @()
$i = 0
$logErreurs = Join-Path -Path $sortie -ChildPath "_ERREURS.txt"
if (Test-Path -LiteralPath $logErreurs) { Remove-Item -LiteralPath $logErreurs -Force -ErrorAction SilentlyContinue }
foreach ($f in $fichiers) {
    $i++
    $relatif = $f.FullName.Substring($srcRacine.Length).TrimStart('\', '/')
    $sousDossier = Split-Path -Parent $relatif
    $dstDossier = if ($sousDossier) { Join-Path -Path $sortie -ChildPath $sousDossier } else { $sortie }
    if (-not (Test-Path -LiteralPath $dstDossier)) { New-Item -ItemType Directory -Path $dstDossier | Out-Null }
    $dst = Join-Path -Path $dstDossier -ChildPath ($f.BaseName + "_insta_1080x1350.jpg")
    $dstLog = $dst + ".ffmpeg.log"
    Write-Host "[$i/$($fichiers.Count)] $relatif"
    & $ffmpeg -hide_banner -loglevel verbose -y -i $f.FullName -i $papier -filter_complex_script $filtreFichier -q:v $QualiteJpg "$dst" 2> $dstLog
    if (($LASTEXITCODE -eq 0) -and (Test-Path -LiteralPath $dst)) {
        $ok++
        Remove-Item -LiteralPath $dstLog -Force -ErrorAction SilentlyContinue
    } else {
        $ko += $relatif
        $queue = Get-Content -LiteralPath $dstLog -Tail 6 -ErrorAction SilentlyContinue
        Write-Host "  ECHEC (log: $(Split-Path -Leaf $dstLog))" -ForegroundColor Red
        if ($queue) { $queue | ForEach-Object { Write-Host "  | $_" -ForegroundColor DarkYellow } }
        Add-Content -LiteralPath $logErreurs -Value ("=" * 70) -Encoding UTF8
        Add-Content -LiteralPath $logErreurs -Value ("FICHIER : " + $f.FullName) -Encoding UTF8
        Add-Content -LiteralPath $logErreurs -Value (Get-Content -LiteralPath $dstLog -Raw -ErrorAction SilentlyContinue) -Encoding UTF8
    }
}

try { Remove-Item -LiteralPath $filtreFichier -Force -ErrorAction SilentlyContinue } catch {}

Write-Host ""
Write-Host "Termine : $ok/$($fichiers.Count) -> $sortie (sous-dossiers conserves)" -ForegroundColor Green
if ($ko.Count -gt 0) {
    Write-Host "Echecs :" -ForegroundColor Red
    $ko | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
}
Pause-Fin
