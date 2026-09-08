export interface Finding {
  rule: string;
  severity: "error" | "warning";
  message: string;
  location?: string;
}
