(function(){
  const protectionOptions = [
    { code: "sprinkleranlegg", label: "Sprinkleranlegg (Automatisk slokkeanlegg)" },
    { code: "brannalarmanlegg", label: "Brannalarmanlegg" },
    { code: "innbruddsalarmanlegg", label: "Innbruddsalarmanlegg" },
    { code: "gasslokkeanlegg", label: "Gasslokkeanlegg" },
    { code: "roeykventilasjon", label: "Røykventilasjon" },
    { code: "delvis-beskyttelse", label: "Delvis beskyttelse" }
  ];

  const protectionLabels = protectionOptions.reduce((acc, item) => {
    acc[item.code] = item.label;
    return acc;
  }, {});

  window.ProtectionConfig = {
    protectionOptions,
    protectionLabels
  };
})();
