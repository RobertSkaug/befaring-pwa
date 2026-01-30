(function(){
  const buildingParts = [
    {
      key: "soeyler",
      label: "Søyler",
      materialOptions: [
        { code: "armert-betong", label: "Armert betong", desc: "Betong med armeringsjern for høy bæreevne." },
        { code: "prefab-betong", label: "Prefab betong", desc: "Ferdigstøpte betongelementer montert på byggeplass." },
        { code: "staal-i-h-profil", label: "Stål i H-profil", desc: "Bæresøyle av H‑profil i stål." },
        { code: "staal-hulprofil", label: "Stål hulprofil", desc: "Bæresøyle av hulprofil i stål." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Søyle i limtre (laminert tre)." },
        { code: "tre-lvl", label: "Tre – LVL", desc: "Søyle i LVL (laminert finertre)." },
        { code: "murverk-baerende", label: "Murverk (bærende)", desc: "Bærende søyle i murverk/tegl." },
        { code: "ukjent", label: "Ukjent", desc: "Materialet er ikke kjent." },
        { code: "annet", label: "Annet", desc: "Annet materiale – spesifiser under notat." }
      ]
    },
    {
      key: "bjelker",
      label: "Bjelker",
      materialOptions: [
        { code: "staal-i-h-profil", label: "Stål i H-profil", desc: "Bjelke av H‑profil i stål." },
        { code: "staal-hulprofil", label: "Stål hulprofil", desc: "Bjelke av hulprofil i stål." },
        { code: "staal-fagverk", label: "Stål fagverk", desc: "Bjelke utført som stål fagverk." },
        { code: "armert-betong", label: "Armert betong", desc: "Bjelke i armert betong." },
        { code: "prefab-betong", label: "Prefab betong", desc: "Prefabrikkert betongbjelke." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Bjelke i limtre." },
        { code: "tre-i-bjelke", label: "Tre i bjelke", desc: "Bjelke i massivt tre." },
        { code: "tre-lvl", label: "Tre – LVL", desc: "Bjelke i LVL (laminert finertre)." },
        { code: "samvirke-staal-betong", label: "Samvirke stål/betong", desc: "Komposittbjelke med stål og betong." },
        { code: "ukjent", label: "Ukjent", desc: "Materialet er ikke kjent." },
        { code: "annet", label: "Annet", desc: "Annet materiale – spesifiser under notat." }
      ]
    },
    {
      key: "dekke",
      label: "Dekke",
      materialOptions: [
        { code: "plasstoep-betong", label: "Plasstøpt betong", desc: "Dekke støpt på stedet." },
        { code: "hulldekke", label: "Hulldekke", desc: "Prefabrikkert betongelement med hulrom." },
        { code: "tt-element", label: "TT-element", desc: "Prefabrikkert T/TT‑element i betong." },
        { code: "massivdekke-betong", label: "Massivdekke (betong)", desc: "Massivt betongdekke uten hulrom." },
        { code: "samvirkedekke-trapez-betong", label: "Samvirkedekke (trapez+betong)", desc: "Trapesplater med påstøp i betong." },
        { code: "trebjelkelag", label: "Trebjelkelag", desc: "Dekke av tre bjelkelag." },
        { code: "massivtre-clt", label: "Massivtre (CLT)", desc: "Krysslimt massivtre (CLT)." },
        { code: "lettbetong-porebetong", label: "Lettbetong / porebetong", desc: "Lettbetong med porer, lav vekt." },
        { code: "teknisk-gulv", label: "Teknisk gulv", desc: "Hevet/teknisk gulv for installasjoner." },
        { code: "ukjent", label: "Ukjent", desc: "Materialet er ikke kjent." },
        { code: "annet", label: "Annet", desc: "Annet materiale – spesifiser under notat." }
      ]
    },
    {
      key: "tak",
      label: "Tak",
      materialOptions: [
        { code: "takstoler-tre", label: "Takstoler (tre)", desc: "Prefabrikkerte takstoler i tre." },
        { code: "sperrer-tre", label: "Sperrer (tre)", desc: "Tradisjonelle sperrer i tre." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Bærende tak i limtre." },
        { code: "staal-rammer", label: "Stålrammer", desc: "Bærende tak i stålrammer." },
        { code: "staal-fagverk", label: "Stål fagverk", desc: "Bærende tak med stål fagverk." },
        { code: "betong-takelement", label: "Betong takelement", desc: "Prefabrikkerte takelementer i betong." },
        { code: "papp-bitumen", label: "Papp/bitumen", desc: "Taktekking med papp/bitumen." },
        { code: "folie-pvc-tpo-epdm", label: "Folie (PVC/TPO/EPDM)", desc: "Membran/folie som taktekking." },
        { code: "profilplater-staal", label: "Profilplater (stål)", desc: "Taktekking av stål profilerte plater." },
        { code: "metall-baandtekking", label: "Metall båndtekking", desc: "Metallplater i bånd/false‑tekking." },
        { code: "takstein-tegl", label: "Takstein (tegl)", desc: "Takstein av tegl." },
        { code: "takstein-betong", label: "Takstein (betong)", desc: "Takstein av betong." },
        { code: "skifer", label: "Skifer", desc: "Natursteinsskifer som tekking." },
        { code: "groent-tak", label: "Grønt tak", desc: "Vegetasjonsdekke/torvtak." },
        { code: "ukjent", label: "Ukjent", desc: "Materialet er ikke kjent." },
        { code: "annet", label: "Annet", desc: "Annet materiale – spesifiser under notat." }
      ]
    },
    {
      key: "yttervegg",
      label: "Yttervegg",
      materialOptions: [
        { code: "tre-bindingsverk", label: "Tre bindingsverk", desc: "Vegger i tre bindingsverk." },
        { code: "betong", label: "Betong", desc: "Bærende eller utfyllende betongvegg." },
        { code: "staal-skjelett", label: "Stålskjelett", desc: "Stålrammer med plate/isolasjon." },
        { code: "murverk-tegl", label: "Murverk (tegl)", desc: "Murverk i teglstein." },
        { code: "murverk-lettklinker", label: "Murverk (lettklinker)", desc: "Murverk i lettklinkerblokker." },
        { code: "sandwich-betong", label: "Sandwich (betong)", desc: "Sandwichelementer med betong og isolasjon." },
        { code: "sandwich-staal", label: "Sandwich (stål)", desc: "Sandwichelementer med stålplater og isolasjon." },
        { code: "trepanel", label: "Trepanel", desc: "Utvendig kledning i trepanel." },
        { code: "tegl-forblending", label: "Teglforblending", desc: "Teglforblending som fasadekledning." },
        { code: "puss", label: "Puss", desc: "Pusset fasade på mur/betong." },
        { code: "fasadeplater-fibersement", label: "Fasadeplater (fibersement)", desc: "Plater av fibersement." },
        { code: "fasadeplater-hpl", label: "Fasadeplater (HPL)", desc: "Høytrykkslaminatplater." },
        { code: "metallkassetter", label: "Metallkassetter", desc: "Fasade kassetter i metall." },
        { code: "naturstein", label: "Naturstein", desc: "Natursteinsfasade." },
        { code: "glass-aluminium-fasade", label: "Glass/aluminium fasade", desc: "Curtain wall i glass/aluminium." },
        { code: "ukjent", label: "Ukjent", desc: "Materialet er ikke kjent." },
        { code: "annet", label: "Annet", desc: "Annet materiale – spesifiser under notat." }
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
