import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface MealOption {
  type: "cook" | "delivery" | "dineout";
  title: string;
  subText: string;
  cost: number;          // in INR, inclusive of fees/taxes where known
  timeMinutes: number;    // prep/eta/wait time depending on type
  deepLinkUrl: string;
  confidence?: "high" | "low"; // "low" if the node had to fall back to partial data
}

export interface SystemError {
  node: string;
  message: string;
  recoverable: boolean;
}

export const MealStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  userCoordinates: Annotation<{ lat: number; lng: number }>({
    reducer: (_x, y) => y, // always overwrite with latest
  }),
  budgetCap: Annotation<number | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  quotes: Annotation<MealOption[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  errors: Annotation<SystemError[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});
export type MealState = typeof MealStateAnnotation.State;
