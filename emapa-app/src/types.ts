export type Sector = { id: string; name: string };

export type WaterQuality = {
  sectorId: string;
  updatedAt: string;
  chlorine: number; // mg/L (rango recomendado 0.3 - 1.5)
  ph: number; // rango 6.5 - 8.5
  turbidity: number; // NTU (máx 5)
  status: 'apta' | 'precaucion' | 'no_apta';
};

export type Incident = {
  id: string;
  sectorIds: string[];
  type: 'corte_programado' | 'falla' | 'baja_presion';
  title: string;
  description: string;
  startsAt: string;
  estimatedEnd: string;
  resolved: boolean;
};

export type Invoice = {
  id: string;
  period: string;
  consumptionM3: number;
  amount: number;
  dueDate: string;
  paid: boolean;
};

export type ProcedureType = {
  id: string;
  name: string;
  description: string;
};

export type ProcedureRequest = {
  id: string;
  typeId: string;
  typeName: string;
  detail: string;
  createdAt: string;
  status: 'recibido' | 'en_revision' | 'atendido';
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
