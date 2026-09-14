export interface Finding {
  rule: string;
  severity: "error" | "warning";
  message: string;
  location?: string;
}

export interface SceneGateEntry {
  passId: string;
  title: string;
  passed: boolean | undefined;
  gaps: string[];
  selfCorrected: boolean;
  gateError?: string;
}
