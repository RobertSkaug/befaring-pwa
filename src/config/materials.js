(function(){
  const buildingParts = [
    {
      key: "fundament-grunn",
      label: "Fundament / grunn",
      materialOptions: [
        "plasstoep-betong",
        "prefab-betong",
        "ringmur",
        "plate-paa-mark",
        "peler-betong",
        "peler-staal",
        "peler-tre",
        "naturstein",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "soeyler",
      label: "Søyler",
      materialOptions: [
        "armert-betong",
        "prefab-betong",
        "staal-i-h-profil",
        "staal-hulprofil",
        "tre-limtre",
        "tre-lvl",
        "murverk-baerende",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "bjelker",
      label: "Bjelker",
      materialOptions: [
        "staal-i-h-profil",
        "staal-hulprofil",
        "staal-fagverk",
        "armert-betong",
        "prefab-betong",
        "tre-limtre",
        "tre-i-bjelke",
        "tre-lvl",
        "samvirke-staal-betong",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "dekke",
      label: "Dekke",
      materialOptions: [
        "plasstoep-betong",
        "hulldekke",
        "tt-element",
        "massivdekke-betong",
        "samvirkedekke-trapez-betong",
        "trebjelkelag",
        "massivtre-clt",
        "lettbetong-porebetong",
        "teknisk-gulv",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "tak-baeresystem",
      label: "Tak bæresystem",
      materialOptions: [
        "takstoler-tre",
        "sperrer-tre",
        "tre-limtre",
        "staal-rammer",
        "staal-fagverk",
        "betong-takelement",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "tak-tekking",
      label: "Tak tekking",
      materialOptions: [
        "papp-bitumen",
        "folie-pvc-tpo-epdm",
        "profilplater-staal",
        "metall-baandtekking",
        "takstein-tegl",
        "takstein-betong",
        "skifer",
        "groent-tak",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "yttervegg-baeresystem",
      label: "Yttervegg bæresystem",
      materialOptions: [
        "tre-bindingsverk",
        "betong",
        "staal-skjelett",
        "murverk-tegl",
        "murverk-lettklinker",
        "sandwich-betong",
        "sandwich-staal",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "yttervegg-fasade",
      label: "Yttervegg fasade",
      materialOptions: [
        "trepanel",
        "tegl-forblending",
        "puss",
        "fasadeplater-fibersement",
        "fasadeplater-hpl",
        "metallkassetter",
        "naturstein",
        "glass-aluminium-fasade",
        "ukjent",
        "annet"
      ]
    },
    {
      key: "innvendig-stabilisering",
      label: "Innvendig stabilisering",
      materialOptions: [
        "betongkjerne",
        "betong-avstivningsvegg",
        "murverk",
        "staal-kryssavstivning",
        "massivtre-clt",
        "ukjent",
        "annet"
      ]
    },
    
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
