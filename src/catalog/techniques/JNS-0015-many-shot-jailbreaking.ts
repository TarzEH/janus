import type { TechniqueInput } from "../../schema/technique.js";

export const JNS_0015: TechniqueInput = {
  id: "JNS-0015",
  name: "Many-Shot Jailbreaking",
  category: "temporal-statistical",
  template: {
    body: `{{objective}}`,
  },
  slots: [
    {
      name: "objective",
      description: "Where the operator's instruction lands.",
    },
  ],
  multiTurn: false,
  mutators: { recommended: ["many-shot-padding", "bidi-override"], incompatible: [] },
};
