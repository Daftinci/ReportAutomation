export interface Database {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  name: string;
  databases: Database[];
}

export const clients: Client[] = [
  {
    id: 'pertamina',
    name: 'Pertamina EP',
    databases: [
      { id: 'merudb',   name: 'Merudb'   },
      { id: 'soadb',    name: 'soadb'    },
      { id: 'dbreport', name: 'dbreport' },
      { id: 'ext',      name: 'EXT'      },
      { id: 'dwh',      name: 'DWH'      },
    ],
  },
  {
    id: 'kai',
    name: 'KAI',
    databases: [{ id: 'oracleexacc', name: 'OracleExaCC' }],
  },
];
