// ============================================================
// Insta-Post-1080x1350.jsx - V3 SIMPLIFIEE
// Zéro copie entre documents (corrige les 2 erreurs "premier plan").
//
// Principe ultra-simple, tout se fait DANS le doc ouvert :
//  1. flatten -> 1 calque
//  2. dupliquer intra-doc -> Fond + Avant (pas de transfert = pas d'erreur)
//  3. resizeCanvas 1080x1350
//  4. Fond : cover + flou gaussien (ou pause galerie manuelle)
//  5. Avant : fit + marge + Contour blanc
//  6. SaveAs JPG vers dossier export, close SANS sauver l'original
//
// Usage lot : ferme tout, Fichier > Scripts > Parcourir > ce jsx,
//   choisis SOURCE puis EXPORT. Originals jamais écrasés.
// ============================================================

var CFG = {
    LARGEUR : 1080,
    HAUTEUR : 1350,
    MARGE_AVANT : 60,
    RAYON_FLOU : 35,
    CONTOUR_TAILLE : 14,      // epaisseur totale du cadre papier visible autour de l'avant (px)
    CONTOUR_R : 255,          // utilise seulement si PAPIER=false (contour uni)
    CONTOUR_V : 255,
    CONTOUR_B : 255,
    // --- aspect papier comme tes exemples (bordure blanc-casse granite) ---
    PAPIER : true,            // true = cadre papier texture, false = ancien contour uni
    PAPIER_R : 235,           // base blanc casse (proche papier clair de Papier-3.pat)
    PAPIER_V : 232,
    PAPIER_B : 222,
    PAPIER_GRAIN : 5,         // % bruit monochrome gaussien (3-8 = papier discret)
    PAPIER_LISSER : 0.6,      // flou sur le cadre pour adoucir le grain (0 = off)
    CONTOUR_INTERNE_FIN : 3,  // fin liseret blanc net sur l'avant (0 = off)
    ARRONDI_LISSAGE : 8,      // adoucit les coins du cadre (selection smooth, px)
    // Option .pat : si tu preferes ton vrai motif, charge Papier-3.pat une fois
    // (Edition > Motifs > charger) puis mets ici le NOM EXACT du motif et PASSE_MOTIF=true.
    // Sinon laisse false = grain simule, sans dependance.
    PASSE_MOTIF : false,
    MOTIF_PAPIER_NOM : "",
    JPEG_QUALITE : 10,
    PAUSE_FLOU_GALERIE_MANUEL : false
};

#target photoshop
app.bringToFront();
if (app.preferences.rulerUnits !== Units.PIXELS) {
    app.preferences.rulerUnits = Units.PIXELS;
}

function largeurCalque(lay) {
    var b = lay.bounds;
    return b[2].as("px") - b[0].as("px");
}
function hauteurCalque(lay) {
    var b = lay.bounds;
    return b[3].as("px") - b[1].as("px");
}
function centrerCalque(lay, canvasW, canvasH) {
    var b = lay.bounds;
    var cx = (b[0].as("px") + b[2].as("px")) / 2.0;
    var cy = (b[1].as("px") + b[3].as("px")) / 2.0;
    lay.translate(new UnitValue(canvasW / 2.0 - cx, "px"), new UnitValue(canvasH / 2.0 - cy, "px"));
}
function echelleCover(pctW, pctH) {
    // pure math, testable : retourne % cover
    return Math.max(pctW, pctH);
}
function echelleFit(w, h, maxW, maxH) {
    return Math.min(maxW / w, maxH / h) * 100.0;
}
function mettreEchelleCover(lay, targetW, targetH) {
    var w = largeurCalque(lay);
    var h = hauteurCalque(lay);
    if (w <= 1 || h <= 1) throw "Calque vide (" + w + "x" + h + ")";
    var s = Math.max(targetW / w, targetH / h) * 100.0;
    lay.resize(s, s, AnchorPosition.MIDDLECENTER);
    centrerCalque(lay, targetW, targetH);
}
function mettreEchelleFitAvecMarge(lay, targetW, targetH, marge) {
    var w = largeurCalque(lay);
    var h = hauteurCalque(lay);
    if (w <= 1 || h <= 1) throw "Calque vide (" + w + "x" + h + ")";
    var s = Math.min((targetW - marge * 2) / w, (targetH - marge * 2) / h) * 100.0;
    lay.resize(s, s, AnchorPosition.MIDDLECENTER);
    centrerCalque(lay, targetW, targetH);
}

function ajouterContourBlanc(taillePx, r, v, b) {
    var s2t = function (s) { return app.stringIDToTypeID(s); };
    var c2t = function (c) { return app.charIDToTypeID(c); };
    var descSet = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(s2t("property"), s2t("layerEffects"));
    ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
    descSet.putReference(s2t("null"), ref);
    var descFX = new ActionDescriptor();
    descFX.putUnitDouble(s2t("scale"), s2t("percentUnit"), 100);
    var descStroke = new ActionDescriptor();
    descStroke.putBoolean(s2t("enabled"), true);
    descStroke.putBoolean(s2t("present"), true);
    descStroke.putBoolean(s2t("showInDialog"), true);
    descStroke.putEnumerated(s2t("style"), s2t("frameStyle"), s2t("inside"));
    descStroke.putEnumerated(s2t("paintType"), s2t("frameFill"), s2t("solidColor"));
    descStroke.putEnumerated(s2t("mode"), s2t("blendMode"), s2t("normal"));
    descStroke.putUnitDouble(s2t("opacity"), s2t("percentUnit"), 100);
    descStroke.putUnitDouble(s2t("size"), s2t("pixelsUnit"), taillePx);
    var descColor = new ActionDescriptor();
    descColor.putDouble(c2t("Rd  "), r);
    descColor.putDouble(c2t("Grn "), v);
    descColor.putDouble(c2t("Bl  "), b);
    descStroke.putObject(s2t("color"), s2t("RGBColor"), descColor);
    descFX.putObject(s2t("frameFX"), s2t("frameFX"), descStroke);
    descSet.putObject(s2t("to"), s2t("layerEffects"), descFX);
    executeAction(s2t("set"), descSet, DialogModes.NO);
}

// Cadre papier texture autour de l'avant (comme tes exemples).
// Principe : selectionne les pixels de l'avant, etend de epaisseur px,
// cree un calque en dessous rempli blanc-casse + bruit = seule la couronne reste visible.
function creerCadrePapier(doc, avantLayer, epaisseur) {
    app.activeDocument = doc;
    doc.activeLayer = avantLayer;

    // 1. selection pixels opaques de l'avant
    try {
        doc.selection.load(avantLayer, SelectionType.REPLACE);
    } catch (eSel) {
        // fallback : selection rect via bounds
        var b = avantLayer.bounds;
        doc.selection.select([
            [b[0], b[1]],
            [b[2], b[1]],
            [b[2], b[3]],
            [b[0], b[3]]
        ]);
    }
    // 2. etend = epaisseur du cadre
    doc.selection.expand(new UnitValue(epaisseur, "px"));
    // 3. adoucit coins (proche des coins arrondis de tes exemples)
    if (CFG.ARRONDI_LISSAGE > 0) {
        try { doc.selection.smooth(new UnitValue(CFG.ARRONDI_LISSAGE, "px")); } catch (eSm) {}
    }

    // 4. calque cadre sous l'avant
    var cadre = doc.artLayers.add();
    cadre.name = "Cadre Papier";
    try { cadre.move(avantLayer, ElementPlacement.PLACEAFTER); } catch (eMv) {}
    doc.activeLayer = cadre;

    // 5. remplit blanc casse
    var fgSauve = null;
    try { fgSauve = app.foregroundColor; } catch (eFg) {}
    var papier = new SolidColor();
    papier.rgb.red = CFG.PAPIER_R;
    papier.rgb.green = CFG.PAPIER_V;
    papier.rgb.blue = CFG.PAPIER_B;
    try { app.foregroundColor = papier; } catch (eFg2) {}
    try {
        doc.selection.fill(app.foregroundColor, ColorBlendMode.NORMAL, 100, false);
    } catch (eFill) {
        // fallback vieux Photoshop : fill via ActionManager
        try {
            var s2t = function (s) { return app.stringIDToTypeID(s); };
            var d = new ActionDescriptor();
            d.putEnumerated(s2t("using"), s2t("fillContents"), s2t("foregroundColor"));
            d.putUnitDouble(s2t("opacity"), s2t("percentUnit"), 100);
            d.putEnumerated(s2t("mode"), s2t("blendMode"), s2t("normal"));
            executeAction(s2t("fill"), d, DialogModes.NO);
        } catch (eFill2) {}
    }
    try { if (fgSauve) app.foregroundColor = fgSauve; } catch (eFg3) {}

    // 6. grain papier (le .pat Papier-3 donne le meme esprit en plus marque)
    try {
        if (CFG.PAPIER_GRAIN > 0) cadre.applyAddNoise(CFG.PAPIER_GRAIN, NoiseDistribution.GAUSSIAN, true);
    } catch (eNz) {}
    try {
        if (CFG.PAPIER_LISSER > 0) cadre.applyGaussianBlur(CFG.PAPIER_LISSER);
    } catch (eBl) {}

    try { doc.selection.deselect(); } catch (eDe) {}
    return cadre;
}

// --- TRANSFO EN PLACE : aucune operation inter-documents ---
function formaterEnPlace(doc, nomBase) {
    app.activeDocument = doc;

    // 0. securite mode couleur
    try { if (doc.mode !== DocumentMode.RGB) doc.changeMode(ChangeMode.RGB); } catch (e0) {}
    try { if (doc.bitsPerChannel !== BitsPerChannelType.EIGHT) doc.bitsPerChannel = BitsPerChannelType.EIGHT; } catch (e0b) {}

    // 1. aplatir -> 1 calque unique
    try { doc.flatten(); } catch (e1) {}
    var base = doc.activeLayer;
    // fond d'origine JPG = Background -> convertir en normal pour resize/blur
    try { if (base.isBackgroundLayer) base.isBackgroundLayer = false; } catch (eBg) {}

    // 2. dupliquer EN PLACE (intra-doc, jamais d'erreur premier plan)
    // Attention ordre : chaque duplicate() se place JUSTE AU-DESSUS de sa source.
    // Donc fond puis avant depuis base donnerait [fond, avant, base] -> fond couvrirait tout !
    // On force l'ordre final : [Avant (haut), Fond (bas)].
    doc.activeLayer = base;
    var fond = base.duplicate();
    fond.name = "Fond Flou (cover)";
    doc.activeLayer = base;
    var avant = base.duplicate();
    avant.name = "Avant Net + Contour (fit)";
    // Ordre explicite : avant devant, fond derriere
    try { avant.move(fond, ElementPlacement.PLACEBEFORE); } catch (eMove1) {}
    try { fond.move(avant, ElementPlacement.PLACEAFTER); } catch (eMove2) {}
    // Supprime la base d'origine, garde seulement Avant + Fond
    try { base.remove(); } catch (eRm) {}
    try { avant.visible = true; fond.visible = true; } catch (eVis) {}
    app.activeDocument = doc;
    // Securite : re-selection par nom (evite refs eventees apres remove/move)
    try { doc.activeLayer = doc.layers.getByName("Avant Net + Contour (fit)"); avant = doc.activeLayer; } catch (eGet1) {}
    try { doc.activeLayer = doc.layers.getByName("Fond Flou (cover)"); fond = doc.activeLayer; } catch (eGet2) {}

    // 3. canvas -> 1080x1350 net (les calques gardent leurs pixels, on les remet a l'echelle apres)
    doc.resizeCanvas(new UnitValue(CFG.LARGEUR, "px"), new UnitValue(CFG.HAUTEUR, "px"), AnchorPosition.MIDDLECENTER);

    // 4. FOND cover + flou
    doc.activeLayer = fond;
    mettreEchelleCover(fond, CFG.LARGEUR, CFG.HAUTEUR);
    doc.activeLayer = fond;
    if (CFG.PAUSE_FLOU_GALERIE_MANUEL) {
        alert("FOND : fais Filtre > Galerie d'effets de flou > Flou de profondeur de champ, OK, puis OK ici.");
    } else {
        fond.applyGaussianBlur(CFG.RAYON_FLOU);
    }

    // 5. AVANT fit + cadre papier (ou contour uni si PAPIER=false)
    doc.activeLayer = avant;
    mettreEchelleFitAvecMarge(avant, CFG.LARGEUR, CFG.HAUTEUR, CFG.MARGE_AVANT);
    doc.activeLayer = avant;
    if (CFG.PAPIER) {
        // fin liseret net pour bord franc photo, puis couronne papier texture autour
        if (CFG.CONTOUR_INTERNE_FIN > 0) {
            try { ajouterContourBlanc(CFG.CONTOUR_INTERNE_FIN, 255, 255, 255); } catch (eStrokeIn) {}
        }
        // re-securise ref avant (le stroke ne change pas le calque, mais on re-pointe)
        try { avant = doc.activeLayer; } catch (eAv) {}
        creerCadrePapier(doc, avant, CFG.CONTOUR_TAILLE);
        // Ordre final attendu haut->bas : Avant, Cadre Papier, Fond
        try { doc.activeLayer = doc.layers.getByName("Avant Net + Contour (fit)"); } catch (eTop) {}
    } else {
        ajouterContourBlanc(CFG.CONTOUR_TAILLE, CFG.CONTOUR_R, CFG.CONTOUR_V, CFG.CONTOUR_B);
    }

    // verif finale
    if (doc.width.as("px") !== CFG.LARGEUR || doc.height.as("px") !== CFG.HAUTEUR) {
        throw "Canvas final inattendu : " + doc.width.as("px") + "x" + doc.height.as("px");
    }
    return doc;
}

function sauverJPEG(doc, dossierSortie, nomBase) {
    var f = new File(dossierSortie.fsName + "/" + nomBase + "_insta_1080x1350.jpg");
    var opts = new JPEGSaveOptions();
    opts.quality = CFG.JPEG_QUALITE;
    opts.embedColorProfile = true;
    opts.formatOptions = FormatOptions.STANDARDBASELINE;
    opts.matte = MatteType.NONE;
    doc.saveAs(f, opts, true, Extension.LOWERCASE);
    return f;
}

// ---------- MAIN SIMPLIFIE ----------
try {
    var dossierIn = null;
    var dossierOut = null;
    var protegerActuel = false;

    if (app.documents.length > 0) {
        // Si un doc est deja ouvert, on demande : traiter ce doc seul ou mode lot ?
        // Simple : si >0 docs, on traite le doc actif seul (pas de dossier a choisir).
        var seul = confirm("Un document est ouvert.\nOui = formater ce document seul\nNon = mode LOT dossier (ferme d'abord tes docs de pref)");
        if (seul) {
            var src = app.activeDocument;
            // duplique niveau Document pour ne jamais toucher l'original affiche
            var copie = src.duplicate("Insta_" + src.name, false);
            formaterEnPlace(copie, src.name);
            alert("Post cree : 1080x1350.\nFond cover + flou " + CFG.RAYON_FLOU + "px / Avant fit marge " + CFG.MARGE_AVANT + "px + Contour " + CFG.CONTOUR_TAILLE + "px.\n\nFichier > Exporter pour sauver.");
        } else {
            dossierIn = Folder.selectDialog("Dossier SOURCE (ex D:\\PXC\\insta\\Normandie)");
            if (!dossierIn) throw "Annule.";
            dossierOut = Folder.selectDialog("Dossier EXPORT (ex D:\\PXC\\insta\\export\\test)");
            if (!dossierOut) throw "Annule.";
        }
    } else {
        dossierIn = Folder.selectDialog("Dossier SOURCE (ex D:\\PXC\\insta\\Normandie)");
        if (!dossierIn) throw "Annule.";
        dossierOut = Folder.selectDialog("Dossier EXPORT (ex D:\\PXC\\insta\\export\\test)");
        if (!dossierOut) throw "Annule.";
    }

    if (dossierIn && dossierOut) {
        var fichiers = dossierIn.getFiles(/\.(jpg|jpeg|png|tif|tiff)$/i);
        // exclut deja-exportes
        var todo = [];
        for (var k = 0; k < fichiers.length; k++) {
            if (fichiers[k] instanceof File && fichiers[k].name.indexOf("_insta_1080x1350") === -1) todo.push(fichiers[k]);
        }
        if (todo.length === 0) throw "Aucune image a traiter dans " + dossierIn.fsName;
        var erreurs = [];
        var ok = 0;
        for (var i = 0; i < todo.length; i++) {
            var d = null;
            try {
                d = app.open(todo[i]);
                var bn = todo[i].name.replace(/\.[^\.]+$/, "");
                formaterEnPlace(d, bn);
                app.activeDocument = d;
                sauverJPEG(d, dossierOut, bn);
                d.close(SaveOptions.DONOTSAVECHANGES);
                d = null;
                ok++;
            } catch (eFile) {
                erreurs.push(todo[i].name + " : " + eFile);
                try { if (d) d.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {}
            }
        }
        var msg = "Termine : " + ok + "/" + todo.length + " -> " + dossierOut.fsName;
        if (erreurs.length) msg += "\n\nEchecs :\n- " + erreurs.join("\n- ");
        alert(msg);
    }
} catch (eMain) {
    if (eMain !== "Annule.") alert("Script interrompu : " + eMain);
}
