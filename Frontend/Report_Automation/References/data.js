// Dummy data for the report automation dashboard
window.AppData = (function () {
  const clients = [
    {
      id: "pertamina",
      name: "Pertamina EP",
      databases: [
        { id: "merudb", name: "Merudb" },
        { id: "soadb", name: "soadb" },
        { id: "dbreport", name: "dbreport" },
        { id: "ext", name: "EXT" },
        { id: "dwh", name: "DWH" },
      ],
    },
    {
      id: "kai",
      name: "KAI",
      databases: [{ id: "oracleexacc", name: "OracleExaCC" }],
    },
  ];

  // Snapshot/finding presets for variety in the preview
  const findingsByDb = {
    merudb: {
      sizeGB: 4821,
      growthPct: 3.2,
      tables: 1284,
      indexes: 3120,
      utilizationPct: 78,
      tablespaces: [
        { name: "USERS",        sizeGB: 1820, usedPct: 84, hot: true },
        { name: "SYSAUX",       sizeGB:  612, usedPct: 71 },
        { name: "REPORTING_TS", sizeGB:  984, usedPct: 92, hot: true },
        { name: "AUDIT_TS",     sizeGB:  408, usedPct: 46 },
        { name: "TEMP",         sizeGB:  220, usedPct: 31 },
      ],
      topConsumers: [
        { schema: "PROD_FIN",    sizeGB: 612, deltaGB: "+18.4" },
        { schema: "RPT_MART",    sizeGB: 488, deltaGB: "+11.0" },
        { schema: "STAGING",     sizeGB: 301, deltaGB:  "+4.7" },
        { schema: "AUDIT_LOG",   sizeGB: 244, deltaGB:  "+2.1" },
      ],
      trend: [
        { m: "Dec '25", gb: 4520 }, { m: "Jan '26", gb: 4604 },
        { m: "Feb '26", gb: 4665 }, { m: "Mar '26", gb: 4712 },
        { m: "Apr '26", gb: 4768 }, { m: "May '26", gb: 4821 },
      ],
    },
    soadb: {
      sizeGB: 1942, growthPct: 1.4, tables: 624, indexes: 1402,
      utilizationPct: 62,
      tablespaces: [
        { name: "SOAINFRA",  sizeGB: 802, usedPct: 74, hot: true },
        { name: "MDS",       sizeGB: 188, usedPct: 41 },
        { name: "BPM_TS",    sizeGB: 412, usedPct: 65 },
        { name: "SYSAUX",    sizeGB: 320, usedPct: 58 },
        { name: "TEMP",      sizeGB: 220, usedPct: 22 },
      ],
      topConsumers: [
        { schema: "SOAINFRA",  sizeGB: 802, deltaGB: "+6.2" },
        { schema: "BPM",       sizeGB: 412, deltaGB: "+2.8" },
        { schema: "OWSM_MDS",  sizeGB: 188, deltaGB: "+0.4" },
      ],
      trend: [
        { m: "Dec '25", gb: 1880 }, { m: "Jan '26", gb: 1894 },
        { m: "Feb '26", gb: 1906 }, { m: "Mar '26", gb: 1918 },
        { m: "Apr '26", gb: 1928 }, { m: "May '26", gb: 1942 },
      ],
    },
    dbreport: {
      sizeGB: 6210, growthPct: 4.8, tables: 2104, indexes: 4880,
      utilizationPct: 88,
      tablespaces: [
        { name: "REPORT_HOT",  sizeGB: 2210, usedPct: 95, hot: true },
        { name: "REPORT_COLD", sizeGB: 1820, usedPct: 71 },
        { name: "MART",        sizeGB: 1180, usedPct: 84, hot: true },
        { name: "SYSAUX",      sizeGB:  620, usedPct: 52 },
        { name: "TEMP",        sizeGB:  380, usedPct: 28 },
      ],
      topConsumers: [
        { schema: "DM_FACT",    sizeGB: 1620, deltaGB: "+32.1" },
        { schema: "DM_DIM",     sizeGB:  880, deltaGB:  "+8.4" },
        { schema: "RPT_STAGE",  sizeGB:  704, deltaGB: "+12.6" },
        { schema: "EXTRACT",    sizeGB:  402, deltaGB:  "+3.0" },
      ],
      trend: [
        { m: "Dec '25", gb: 5680 }, { m: "Jan '26", gb: 5802 },
        { m: "Feb '26", gb: 5924 }, { m: "Mar '26", gb: 6028 },
        { m: "Apr '26", gb: 6121 }, { m: "May '26", gb: 6210 },
      ],
    },
    ext: {
      sizeGB: 982, growthPct: 0.8, tables: 412, indexes: 904,
      utilizationPct: 41,
      tablespaces: [
        { name: "EXT_LANDING", sizeGB: 412, usedPct: 38 },
        { name: "EXT_STAGE",   sizeGB: 288, usedPct: 52 },
        { name: "SYSAUX",      sizeGB: 162, usedPct: 44 },
        { name: "TEMP",        sizeGB: 120, usedPct: 18 },
      ],
      topConsumers: [
        { schema: "EXT_FEED",  sizeGB: 412, deltaGB: "+1.8" },
        { schema: "EXT_STAGE", sizeGB: 288, deltaGB: "+0.6" },
      ],
      trend: [
        { m: "Dec '25", gb: 960 }, { m: "Jan '26", gb: 964 },
        { m: "Feb '26", gb: 970 }, { m: "Mar '26", gb: 974 },
        { m: "Apr '26", gb: 978 }, { m: "May '26", gb: 982 },
      ],
    },
    dwh: {
      sizeGB: 12480, growthPct: 5.6, tables: 3220, indexes: 7240,
      utilizationPct: 91,
      tablespaces: [
        { name: "DWH_FACT",    sizeGB: 4820, usedPct: 96, hot: true },
        { name: "DWH_DIM",     sizeGB: 1980, usedPct: 72 },
        { name: "DWH_AGG",     sizeGB: 2640, usedPct: 88, hot: true },
        { name: "DWH_STAGE",   sizeGB: 1640, usedPct: 64 },
        { name: "SYSAUX",      sizeGB:  820, usedPct: 54 },
        { name: "TEMP",        sizeGB:  580, usedPct: 32 },
      ],
      topConsumers: [
        { schema: "DWH_FACT_SALES", sizeGB: 2840, deltaGB: "+62.0" },
        { schema: "DWH_FACT_OPS",   sizeGB: 1980, deltaGB: "+28.4" },
        { schema: "DWH_AGG_MTH",    sizeGB: 1240, deltaGB: "+11.2" },
        { schema: "DWH_DIM",        sizeGB:  980, deltaGB:  "+3.6" },
      ],
      trend: [
        { m: "Dec '25", gb: 11280 }, { m: "Jan '26", gb: 11520 },
        { m: "Feb '26", gb: 11780 }, { m: "Mar '26", gb: 12040 },
        { m: "Apr '26", gb: 12260 }, { m: "May '26", gb: 12480 },
      ],
    },
    oracleexacc: {
      sizeGB: 8240, growthPct: 2.9, tables: 1840, indexes: 4120,
      utilizationPct: 74,
      tablespaces: [
        { name: "OPS_HOT",     sizeGB: 2820, usedPct: 86, hot: true },
        { name: "OPS_HIST",    sizeGB: 2040, usedPct: 71 },
        { name: "TICKET_TS",   sizeGB: 1480, usedPct: 68 },
        { name: "AUDIT_TS",    sizeGB:  920, usedPct: 52 },
        { name: "SYSAUX",      sizeGB:  580, usedPct: 48 },
        { name: "TEMP",        sizeGB:  400, usedPct: 26 },
      ],
      topConsumers: [
        { schema: "OPS_CORE",   sizeGB: 1820, deltaGB: "+18.6" },
        { schema: "TICKETING",  sizeGB: 1480, deltaGB:  "+9.8" },
        { schema: "HIST_ARCH",  sizeGB: 1240, deltaGB:  "+4.2" },
        { schema: "AUDIT_LOG",  sizeGB:  640, deltaGB:  "+1.6" },
      ],
      trend: [
        { m: "Dec '25", gb: 7820 }, { m: "Jan '26", gb: 7920 },
        { m: "Feb '26", gb: 8020 }, { m: "Mar '26", gb: 8120 },
        { m: "Apr '26", gb: 8180 }, { m: "May '26", gb: 8240 },
      ],
    },
  };

  // Generate 18 reports across the dbs
  const recipe = [
    // [dbId, clientId, fileName, format, date, owner]
    ["merudb",      "pertamina", "Merudb_snapshot_May2026.pdf",     "PDF",  "May 09, 2026", "2d ago",  "Auto · 06:00"],
    ["soadb",       "pertamina", "soadb_snapshot_May2026.pdf",      "PDF",  "May 08, 2026", "3d ago",  "Auto · 06:00"],
    ["dbreport",    "pertamina", "dbreport_snapshot_May2026.docx",  "DOCX", "May 08, 2026", "3d ago",  "Auto · 06:00"],
    ["ext",         "pertamina", "EXT_snapshot_May2026.pdf",        "PDF",  "May 07, 2026", "4d ago",  "Auto · 06:00"],
    ["dwh",         "pertamina", "DWH_snapshot_May2026.pdf",        "PDF",  "May 06, 2026", "5d ago",  "Auto · 06:00"],
    ["oracleexacc", "kai",       "OracleExaCC_snapshot_May2026.pdf","PDF",  "May 09, 2026", "2d ago",  "Auto · 05:30"],
    ["merudb",      "pertamina", "Merudb_snapshot_Apr2026.pdf",     "PDF",  "Apr 30, 2026", "1w ago",  "Auto · 06:00"],
    ["soadb",       "pertamina", "soadb_snapshot_Apr2026.docx",     "DOCX", "Apr 30, 2026", "1w ago",  "Auto · 06:00"],
    ["dbreport",    "pertamina", "dbreport_snapshot_Apr2026.pdf",   "PDF",  "Apr 30, 2026", "1w ago",  "Auto · 06:00"],
    ["ext",         "pertamina", "EXT_snapshot_Apr2026.pdf",        "PDF",  "Apr 30, 2026", "1w ago",  "Auto · 06:00"],
    ["dwh",         "pertamina", "DWH_snapshot_Apr2026.docx",       "DOCX", "Apr 30, 2026", "1w ago",  "Auto · 06:00"],
    ["oracleexacc", "kai",       "OracleExaCC_snapshot_Apr2026.pdf","PDF",  "Apr 30, 2026", "1w ago",  "Auto · 05:30"],
    ["merudb",      "pertamina", "Merudb_snapshot_Mar2026.pdf",     "PDF",  "Mar 31, 2026", "5w ago",  "Auto · 06:00"],
    ["soadb",       "pertamina", "soadb_snapshot_Mar2026.pdf",      "PDF",  "Mar 31, 2026", "5w ago",  "Auto · 06:00"],
    ["dbreport",    "pertamina", "dbreport_snapshot_Mar2026.docx",  "DOCX", "Mar 31, 2026", "5w ago",  "Auto · 06:00"],
    ["dwh",         "pertamina", "DWH_snapshot_Mar2026.pdf",        "PDF",  "Mar 31, 2026", "5w ago",  "Auto · 06:00"],
    ["oracleexacc", "kai",       "OracleExaCC_snapshot_Mar2026.pdf","PDF",  "Mar 31, 2026", "5w ago",  "Auto · 05:30"],
    ["merudb",      "pertamina", "Merudb_snapshot_Feb2026.pdf",     "PDF",  "Feb 28, 2026", "10w ago", "Manual · S. Wijaya"],
  ];

  const clientName = (cid) => clients.find((c) => c.id === cid).name;
  const dbName = (cid, did) =>
    clients.find((c) => c.id === cid).databases.find((d) => d.id === did).name;

  const reports = recipe.map((r, i) => ({
    id: "rpt-" + (i + 1).toString().padStart(2, "0"),
    name: r[2],
    clientId: r[1],
    dbId: r[0],
    clientName: clientName(r[1]),
    dbName: dbName(r[1], r[0]),
    format: r[3],
    type: "Database Snapshot",
    generatedOn: r[4],
    relative: r[5],
    owner: r[6],
    sizeMb: 0.6 + ((i * 37) % 53) / 10,
    findings: findingsByDb[r[0]],
  }));

  return { clients, reports };
})();
