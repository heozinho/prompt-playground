export type Variant = {
  id: string;
  name: string;
  mode: "builder" | "raw";
  fields: {
    role: string;
    task: string;
    constraints: string;
    examples: string;
    format: string;
    failureRules: string;
  };
  rawPrompt: string;
  output: string;
  status: "idle" | "loading" | "success" | "error";
};
