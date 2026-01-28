(function(){
  const buildingParts = [
    {
      key: "soeyler",
      label: "Søyler",
      materialOptions: [
        { code: "armert-betong", label: "Armert betong" },
        { code: "prefab-betong", label: "Prefab betong" },
        { code: "staal-i-h-profil", label: "Stål i H-profil" },
        { code: "staal-hulprofil", label: "Stål hulprofil" },
        { code: "tre-limtre", label: "Tre – limtre" },
        { code: "tre-lvl", label: "Tre – LVL" },
        { code: "murverk-baerende", label: "Murverk (bærende)" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "bjelker",
      label: "Bjelker",
      materialOptions: [
        { code: "staal-i-h-profil", label: "Stål i H-profil" },
        { code: "staal-hulprofil", label: "Stål hulprofil" },
        { code: "staal-fagverk", label: "Stål fagverk" },
        { code: "armert-betong", label: "Armert betong" },
        { code: "prefab-betong", label: "Prefab betong" },
        { code: "tre-limtre", label: "Tre – limtre" },
        { code: "tre-i-bjelke", label: "Tre i bjelke" },
        { code: "tre-lvl", label: "Tre – LVL" },
        { code: "samvirke-staal-betong", label: "Samvirke stål/betong" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "dekke",
      label: "Dekke",
      materialOptions: [
        { code: "plasstoep-betong", label: "Plasstøpt betong" },
        { code: "hulldekke", label: "Hulldekke" },
        { code: "tt-element", label: "TT-element" },
        { code: "massivdekke-betong", label: "Massivdekke (betong)" },
        { code: "samvirkedekke-trapez-betong", label: "Samvirkedekke (trapez+betong)" },
        { code: "trebjelkelag", label: "Trebjelkelag" },
        { code: "massivtre-clt", label: "Massivtre (CLT)" },
        { code: "lettbetong-porebetong", label: "Lettbetong / porebetong" },
        { code: "teknisk-gulv", label: "Teknisk gulv" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "tak",
      label: "Tak",
      materialOptions: [
        { code: "takstoler-tre", label: "Takstoler (tre)" },
        { code: "sperrer-tre", label: "Sperrer (tre)" },
        { code: "tre-limtre", label: "Tre – limtre" },
        { code: "staal-rammer", label: "Stålrammer" },
        { code: "staal-fagverk", label: "Stål fagverk" },
        { code: "betong-takelement", label: "Betong takelement" },
        { code: "papp-bitumen", label: "Papp/bitumen" },
        { code: "folie-pvc-tpo-epdm", label: "Folie (PVC/TPO/EPDM)" },
        { code: "profilplater-staal", label: "Profilplater (stål)" },
        { code: "metall-baandtekking", label: "Metall båndtekking" },
        { code: "takstein-tegl", label: "Takstein (tegl)" },
        { code: "takstein-betong", label: "Takstein (betong)" },
        { code: "skifer", label: "Skifer" },
        { code: "groent-tak", label: "Grønt tak" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "yttervegg",
      label: "Yttervegg",
      materialOptions: [
        { code: "tre-bindingsverk", label: "Tre bindingsverk" },
        { code: "betong", label: "Betong" },
        { code: "staal-skjelett", label: "Stålskjelett" },
        { code: "murverk-tegl", label: "Murverk (tegl)" },
        { code: "murverk-lettklinker", label: "Murverk (lettklinker)" },
        { code: "sandwich-betong", label: "Sandwich (betong)" },
        { code: "sandwich-staal", label: "Sandwich (stål)" },
        { code: "trepanel", label: "Trepanel" },
        { code: "tegl-forblending", label: "Teglforblending" },
        { code: "puss", label: "Puss" },
        { code: "fasadeplater-fibersement", label: "Fasadeplater (fibersement)" },
        { code: "fasadeplater-hpl", label: "Fasadeplater (HPL)" },
        { code: "metallkassetter", label: "Metallkassetter" },
        { code: "naturstein", label: "Naturstein" },
        { code: "glass-aluminium-fasade", label: "Glass/aluminium fasade" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    }
  ];

  const materialLabels = {};
  buildingParts.forEach(part => {
    part.materialOptions.forEach(opt => {
      materialLabels[opt.code] = opt.label;
    });
  });

  window.MaterialConfig = {
    buildingParts,
    materialLabels
  };
})();
