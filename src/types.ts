export interface AgentReference {
  fileId: string;
  question: string;
  answer: string;
}

export interface ChartConfig {
  type: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor: string | string[];
      borderColor: string | string[];
      borderWidth: number;
    }>;
  };
  options: {
    responsive: boolean;
    plugins: {
      legend: { position: string };
      title: { display: boolean; text: string };
    };
  };
}

export interface AgentState {
  query: string;
  tenant: string;
  answer?: string;
  references: AgentReference[];
  fileIds: string[];
  chartConfig?: ChartConfig;
  notes?: string[];
}

export const CLASS_NAME = "QAItem";
export const DEFAULT_TENANT = "tenant-a";
