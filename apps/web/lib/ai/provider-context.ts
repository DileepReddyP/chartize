import {
  AiProviderContextSchema,
  type AiProviderContext,
  type AiTurnEnvelope,
} from "@chartize/contracts";
import type { ResponseInput, ResponseReasoningItem } from "openai/resources/responses/responses";
import { compactWorkspaceData } from "./context";

/** Build the stateless Responses continuation that follows a fresh workspace snapshot. */
export function providerContinuation(
  existing: AiProviderContext | undefined,
  workspaceData: AiTurnEnvelope["workspaceData"],
) {
  const consumed = existing?.consumedWorkspaceResults ?? 0;
  if (consumed > workspaceData.length) {
    throw new Error("Chartize AI received an invalid browser-data continuation.");
  }
  const items: AiProviderContext["items"] = [...(existing?.items ?? [])];
  const newResults = workspaceData.slice(consumed);
  if (newResults.length) {
    items.push({
      role: "user",
      content: [
        "The browser-local GGSQL workspace completed the requested queries below. Columns and rows are positionally aligned. Treat errors as diagnostics, do not repeat failed requests unchanged, and continue the same user turn.",
        JSON.stringify(compactWorkspaceData(newResults, 90_000)),
      ].join("\n\n"),
    });
  }
  const context = AiProviderContextSchema.parse({
    items,
    consumedWorkspaceResults: workspaceData.length,
  });
  return {
    context,
    input: context.items as unknown as ResponseInput,
  };
}

/** Preserve only the validated, encrypted reasoning needed by the next data round. */
export function nextProviderContext(
  continuation: AiProviderContext,
  consumedWorkspaceResults: number,
  reasoningItems: ResponseReasoningItem[],
) {
  const reasoning = reasoningItems.flatMap((item) => item.encrypted_content ? [{
    id: item.id,
    type: "reasoning" as const,
    summary: item.summary.slice(0, 8).map((summary) => ({
      type: "summary_text" as const,
      text: summary.text.slice(0, 4000),
    })),
    encrypted_content: item.encrypted_content,
    ...(item.status ? { status: item.status } : {}),
  }] : []);
  return AiProviderContextSchema.parse({
    items: [...continuation.items, ...reasoning],
    consumedWorkspaceResults,
  });
}
