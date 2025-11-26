import { ChartConfig } from "../types";

const colors = [
  "rgba(99, 102, 241, 0.5)",
  "rgba(16, 185, 129, 0.5)",
  "rgba(245, 158, 11, 0.5)",
];

const borderColors = [
  "rgba(99, 102, 241, 1)",
  "rgba(16, 185, 129, 1)",
  "rgba(245, 158, 11, 1)",
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const clampLabel = (text: string) => (text.length > 40 ? `${text.slice(0, 37)}...` : text);

export const buildChartConfig = (query: string): ChartConfig => {
  const baseData = [12, 19, 8, 15, 10];

  return {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        {
          label: `Mocked chart for: ${clampLabel(query)}`,
          data: baseData,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Chart.js tool (mocked)" },
      },
    },
  };
};
