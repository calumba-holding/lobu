import { describe, expect, test } from "bun:test";
import {
  detectToolIntentRules,
  getCustomToolDescription,
  renderDetectedToolIntentRules,
} from "../agent-policy";

describe("agent-policy file delivery guidance", () => {
  test("detects file delivery prompts and prioritizes UploadUserFile", () => {
    const rules = detectToolIntentRules(
      "Create a PDF summary and send the file to me as an attachment"
    );

    expect(rules.map((rule) => rule.id)).toContain("file-delivery");
    expect(rules.some((rule) => rule.tools.includes("UploadUserFile"))).toBe(
      true
    );
  });

  test("renders explicit create-then-upload guidance for file delivery", () => {
    const instructions = renderDetectedToolIntentRules(
      "Export this as a CSV and upload the file for me to download"
    );

    expect(instructions).toContain("Deliver Files To The User");
    expect(instructions).toContain("UploadUserFile");
    expect(instructions).toContain(
      "create the file, call UploadUserFile, then tell the user it was sent"
    );
  });

  test("UploadUserFile description forbids local path substitutes", () => {
    expect(getCustomToolDescription("UploadUserFile")).toContain(
      "Do not substitute local paths, workspace paths, or sandbox links"
    );
  });
});
