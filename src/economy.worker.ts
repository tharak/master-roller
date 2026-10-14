import {
  analyzeEconomy,
  type DraftPrices,
  type EconomyReport,
} from "./economy";

const worker = self as unknown as {
  onmessage: (event: MessageEvent<DraftPrices>) => void;
  postMessage: (report: EconomyReport) => void;
};
worker.onmessage = (event) => worker.postMessage(analyzeEconomy(event.data));
