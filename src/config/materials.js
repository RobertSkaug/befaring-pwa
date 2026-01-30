(function(){
  const buildingParts = [
    {
      key: "soeyler",
      label: "Søyler",
      materialOptions: [
        { code: "armert-betong", label: "Armert betong", desc: "Betong som er forsterket med stålstenger inni. Det gjør søylen sterkere og tåler større belastning." },
        { code: "prefab-betong", label: "Prefab betong", desc: "Ferdigstøpte betongelementer fra fabrikk som monteres på byggeplass. Gir rask montering og jevn kvalitet." },
        { code: "staal-i-h-profil", label: "Stål i H-profil", desc: "Stålsøyle med H‑formet tverrsnitt. Vanlig i industribygg fordi den tåler mye last." },
        { code: "staal-hulprofil", label: "Stål hulprofil", desc: "Stålsøyle som er hul (rørformet). Gir høy styrke med lavere vekt enn massiv stål." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Søyle av flere trelameller som er limt sammen. Gir høy styrke og stabilitet." },
        { code: "tre-lvl", label: "Tre – LVL", desc: "Laminert finertre i mange tynne lag. Sterkere og mer formstabilt enn vanlig tre." },
        { code: "murverk-baerende", label: "Murverk (bærende)", desc: "Søyle i tegl/stein som bærer last. Brukes ofte i eldre bygg." },
        { code: "ukjent", label: "Ukjent", desc: "Velg dette hvis du ikke kan identifisere materialet." },
        { code: "annet", label: "Annet", desc: "Brukes når materialet ikke finnes i listen. Beskriv i notatfeltet." }
      ]
    },
    {
      key: "bjelker",
      label: "Bjelker",
      materialOptions: [
        { code: "staal-i-h-profil", label: "Stål i H-profil", desc: "Stålbjelke med H‑form. Brukes ofte som hovedbjelke i større bygg." },
        { code: "staal-hulprofil", label: "Stål hulprofil", desc: "Bjelke av stålrør/hulprofil. Gir høy styrke i forhold til vekt." },
        { code: "staal-fagverk", label: "Stål fagverk", desc: "Bjelke bygget som et fagverk (trekanter). Tåler store spenn." },
        { code: "armert-betong", label: "Armert betong", desc: "Betongbjelke med armeringsjern. Vanlig i betongbygg." },
        { code: "prefab-betong", label: "Prefab betong", desc: "Betongbjelke produsert i fabrikk og montert på byggeplass." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Bjelke i limtre (laminert tre) med god bæreevne." },
        { code: "tre-i-bjelke", label: "Tre i bjelke", desc: "Bjelke av massivt tre. Ofte i eldre bygg." },
        { code: "tre-lvl", label: "Tre – LVL", desc: "Bjelke i LVL (laminert finertre) som er sterkere enn vanlig tre." },
        { code: "samvirke-staal-betong", label: "Samvirke stål/betong", desc: "Kompositt der stål og betong arbeider sammen for høy styrke." },
        { code: "ukjent", label: "Ukjent", desc: "Velg dette hvis materialet er ukjent." },
        { code: "annet", label: "Annet", desc: "Brukes når materialet ikke finnes i listen. Beskriv i notatfeltet." }
      ]
    },
    {
      key: "dekke",
      label: "Dekke",
      materialOptions: [
        { code: "plasstoep-betong", label: "Plasstøpt betong", desc: "Dekke som støpes på stedet. Gir solid og tung konstruksjon." },
        { code: "hulldekke", label: "Hulldekke", desc: "Prefabrikkert betongdekke med hulrom som reduserer vekt." },
        { code: "tt-element", label: "TT-element", desc: "Prefabrikkert betongelement formet som T/TT. Brukes i store spenn." },
        { code: "massivdekke-betong", label: "Massivdekke (betong)", desc: "Helstøpt betongdekke uten hulrom. Svært robust." },
        { code: "samvirkedekke-trapez-betong", label: "Samvirkedekke (trapez+betong)", desc: "Stålplater med betongpåstøp. Kombinerer stål og betong." },
        { code: "trebjelkelag", label: "Trebjelkelag", desc: "Dekke bygget opp av trebjelker. Vanlig i eldre trebygg." },
        { code: "massivtre-clt", label: "Massivtre (CLT)", desc: "Krysslimt tre i store plater. Stabilt og relativt lett." },
        { code: "lettbetong-porebetong", label: "Lettbetong / porebetong", desc: "Betong med luftporer. Lav vekt og god isolasjon." },
        { code: "teknisk-gulv", label: "Teknisk gulv", desc: "Hevet gulv som skjuler kabler og tekniske installasjoner." },
        { code: "ukjent", label: "Ukjent", desc: "Velg dette hvis materialet er ukjent." },
        { code: "annet", label: "Annet", desc: "Brukes når materialet ikke finnes i listen. Beskriv i notatfeltet." }
      ]
    },
    {
      key: "tak",
      label: "Tak",
      materialOptions: [
        { code: "takstoler-tre", label: "Takstoler (tre)", desc: "Ferdige trekonstruksjoner som bærer taket. Vanlig i boliger og småbygg." },
        { code: "sperrer-tre", label: "Sperrer (tre)", desc: "Tradisjonelle skrå treverk som bærer takflaten." },
        { code: "tre-limtre", label: "Tre – limtre", desc: "Bærende takbjelker i limtre. Sterkt og stabilt." },
        { code: "staal-rammer", label: "Stålrammer", desc: "Bærende rammer i stål. Vanlig i industribygg." },
        { code: "staal-fagverk", label: "Stål fagverk", desc: "Fagverk i stål som gir lange spenn uten mange søyler." },
        { code: "betong-takelement", label: "Betong takelement", desc: "Prefabrikkerte betongelementer som danner taket." },
        { code: "papp-bitumen", label: "Papp/bitumen", desc: "Takpapp/bitumenmembran som varmesveiset eller limes." },
        { code: "folie-pvc-tpo-epdm", label: "Folie (PVC/TPO/EPDM)", desc: "Takfolie/membran i plast eller gummi. Vanlig på flate tak." },
        { code: "profilplater-staal", label: "Profilplater (stål)", desc: "Profilerte stålplater som taktekking." },
        { code: "metall-baandtekking", label: "Metall båndtekking", desc: "Metallplater i langsgående bånd med false‑tekking." },
        { code: "takstein-tegl", label: "Takstein (tegl)", desc: "Takstein laget av brent leire (tegl)." },
        { code: "takstein-betong", label: "Takstein (betong)", desc: "Takstein laget av betong. Ofte tyngre enn tegl." },
        { code: "skifer", label: "Skifer", desc: "Naturstein brukt som taktekking. Svært holdbart." },
        { code: "groent-tak", label: "Grønt tak", desc: "Tak med jord/vegetasjon for isolasjon og overvann." },
        { code: "ukjent", label: "Ukjent", desc: "Velg dette hvis materialet er ukjent." },
        { code: "annet", label: "Annet", desc: "Brukes når materialet ikke finnes i listen. Beskriv i notatfeltet." }
      ]
    },
    {
      key: "yttervegg",
      label: "Yttervegg",
      materialOptions: [
        { code: "tre-bindingsverk", label: "Tre bindingsverk", desc: "Vegger bygget av trestendere med isolasjon og kledning." },
        { code: "betong", label: "Betong", desc: "Vegger i betong, bærende eller utfyllende." },
        { code: "staal-skjelett", label: "Stålskjelett", desc: "Stålrammer med plate/isolasjon som vegg." },
        { code: "murverk-tegl", label: "Murverk (tegl)", desc: "Vegger murt i teglstein." },
        { code: "murverk-lettklinker", label: "Murverk (lettklinker)", desc: "Vegger murt i lettklinkerblokker." },
        { code: "sandwich-betong", label: "Sandwich (betong)", desc: "Sandwichelementer med betong og isolasjon i midten." },
        { code: "sandwich-staal", label: "Sandwich (stål)", desc: "Sandwichelementer med stålplater og isolasjon." },
        { code: "trepanel", label: "Trepanel", desc: "Utvendig kledning av trepanel." },
        { code: "tegl-forblending", label: "Teglforblending", desc: "Tegl som kledning utenpå en annen vegg." },
        { code: "puss", label: "Puss", desc: "Pusset overflate på mur/betong eller isolasjon." },
        { code: "fasadeplater-fibersement", label: "Fasadeplater (fibersement)", desc: "Plater av sement og fiber. Robust fasadekledning." },
        { code: "fasadeplater-hpl", label: "Fasadeplater (HPL)", desc: "Høytrykkslaminatplater, harde og slitesterke." },
        { code: "metallkassetter", label: "Metallkassetter", desc: "Kassetter i metall som fasadekledning." },
        { code: "naturstein", label: "Naturstein", desc: "Naturstein brukt som fasadekledning." },
        { code: "glass-aluminium-fasade", label: "Glass/aluminium fasade", desc: "Glassfasade med aluminiumsprofiler." },
        { code: "ukjent", label: "Ukjent", desc: "Velg dette hvis materialet er ukjent." },
        { code: "annet", label: "Annet", desc: "Brukes når materialet ikke finnes i listen. Beskriv i notatfeltet." }
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
