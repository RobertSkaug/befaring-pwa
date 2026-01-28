(function(){
  const buildingParts = [
    {
      key: "fundament-grunn",
      label: "Fundament / grunn",
      materialOptions: [
        { code: "plasstoep-betong", label: "Plasstøpt betong" },
        { code: "prefab-betong", label: "Prefab betong" },
        { code: "ringmur", label: "Ringmur" },
        { code: "plate-paa-mark", label: "Plate på mark" },
        { code: "peler-betong", label: "Peler i betong" },
        { code: "peler-staal", label: "Peler i stål" },
        { code: "peler-tre", label: "Peler i tre" },
        { code: "naturstein", label: "Naturstein" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
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
      key: "tak-baeresystem",
      label: "Tak bæresystem",
      materialOptions: [
        { code: "takstoler-tre", label: "Takstoler (tre)" },
        { code: "sperrer-tre", label: "Sperrer (tre)" },
        { code: "tre-limtre", label: "Tre – limtre" },
        { code: "staal-rammer", label: "Stålrammer" },
        { code: "staal-fagverk", label: "Stål fagverk" },
        { code: "betong-takelement", label: "Betong takelement" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "tak-tekking",
      label: "Tak tekking",
      materialOptions: [
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
      key: "yttervegg-baeresystem",
      label: "Yttervegg bæresystem",
      materialOptions: [
        { code: "tre-bindingsverk", label: "Tre bindingsverk" },
        { code: "betong", label: "Betong" },
        { code: "staal-skjelett", label: "Stålskjelett" },
        { code: "murverk-tegl", label: "Murverk (tegl)" },
        { code: "murverk-lettklinker", label: "Murverk (lettklinker)" },
        { code: "sandwich-betong", label: "Sandwich (betong)" },
        { code: "sandwich-staal", label: "Sandwich (stål)" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    },
    {
      key: "yttervegg-fasade",
      label: "Yttervegg fasade",
      materialOptions: [
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
    },
    {
      key: "innvendig-stabilisering",
      label: "Innvendig stabilisering",
      materialOptions: [
        { code: "betongkjerne", label: "Betongkjerne" },
        { code: "betong-avstivningsvegg", label: "Betong avstivningsvegg" },
        { code: "murverk", label: "Murverk" },
        { code: "staal-kryssavstivning", label: "Stål kryssavstivning" },
        { code: "massivtre-clt", label: "Massivtre (CLT)" },
        { code: "ukjent", label: "Ukjent" },
        { code: "annet", label: "Annet" }
      ]
    }
  ];

  const materialLabels = {
    "plasstoep-betong": "Plasstøpt betong",
    "prefab-betong": "Prefab betong",
    "ringmur": "Ringmur",
    "plate-paa-mark": "Plate på mark",
    "peler-betong": "Peler i betong",
    "peler-staal": "Peler i stål",
    "peler-tre": "Peler i tre",
    "naturstein": "Naturstein",

    "armert-betong": "Armert betong",
    "staal-i-h-profil": "Stål i H-profil",
    "staal-hulprofil": "Stål hulprofil",
    "tre-limtre": "Tre – limtre",
    "tre-lvl": "Tre – LVL",
    "murverk-baerende": "Murverk (bærende)",

    "staal-fagverk": "Stål fagverk",
    "tre-i-bjelke": "Tre i bjelke",
    "samvirke-staal-betong": "Samvirke stål/betong",

    "hulldekke": "Hulldekke",
    "tt-element": "TT-element",
    "massivdekke-betong": "Massivdekke (betong)",
    "samvirkedekke-trapez-betong": "Samvirkedekke (trapez+betong)",
    "trebjelkelag": "Trebjelkelag",
    "massivtre-clt": "Massivtre (CLT)",
    "lettbetong-porebetong": "Lettbetong / porebetong",
    "teknisk-gulv": "Teknisk gulv",

    "takstoler-tre": "Takstoler (tre)",
    "sperrer-tre": "Sperrer (tre)",
    "staal-rammer": "Stålrammer",
    "betong-takelement": "Betong takelement",

    "papp-bitumen": "Papp/bitumen",
    "folie-pvc-tpo-epdm": "Folie (PVC/TPO/EPDM)",
    "profilplater-staal": "Profilplater (stål)",
    "metall-baandtekking": "Metall båndtekking",
    "takstein-tegl": "Takstein (tegl)",
    "takstein-betong": "Takstein (betong)",
    "skifer": "Skifer",
    "groent-tak": "Grønt tak",

    "tre-bindingsverk": "Tre bindingsverk",
    "betong": "Betong",
    "staal-skjelett": "Stålskjelett",
    "murverk-tegl": "Murverk (tegl)",
    "murverk-lettklinker": "Murverk (lettklinker)",
    "sandwich-betong": "Sandwich (betong)",
    "sandwich-staal": "Sandwich (stål)",

    "trepanel": "Trepanel",
    "tegl-forblending": "Teglforblending",
    "puss": "Puss",
    "fasadeplater-fibersement": "Fasadeplater (fibersement)",
    "fasadeplater-hpl": "Fasadeplater (HPL)",
    "metallkassetter": "Metallkassetter",
    "glass-aluminium-fasade": "Glass/aluminium fasade",

    "betongkjerne": "Betongkjerne",
    "betong-avstivningsvegg": "Betong avstivningsvegg",
    "murverk": "Murverk",
    "staal-kryssavstivning": "Stål kryssavstivning",

    "brannvegg-betong": "Brannvegg (betong)",
    "brannvegg-murverk": "Brannvegg (murverk)",
    "gips-brann": "Gips (brann)",
    "brannmaling-staal": "Brannmaling (stål)",
    "steinull-brannisolering": "Steinull (brannisolering)",
    "brannhimling": "Brannhimling",

    "vindu-tre": "Vindu (tre)",
    "vindu-alu": "Vindu (alu)",
    "vindu-tre-alu": "Vindu (tre/alu)",
    "vindu-pvc": "Vindu (PVC)",
    "doer-tre": "Dør (tre)",
    "doer-staal": "Dør (stål)",
    "port-staal": "Port (stål)",
    "port-sandwich": "Port (sandwich)",
    "isolerglass-2-lags": "Isolerglass (2-lags)",
    "isolerglass-3-lags": "Isolerglass (3-lags)",

    "ukjent": "Ukjent",
    "annet": "Annet"
  };

  window.MaterialConfig = {
    buildingParts,
    materialLabels
  };
})();
