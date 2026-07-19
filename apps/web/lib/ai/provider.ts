import "server-only";

import OpenAI, { AzureOpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";
import type { z } from "zod";

type ResponsesClient = OpenAI | AzureOpenAI;

function clientAndModel(): { client: ResponsesClient; model: string } {
  if ((process.env.AI_PROVIDER ?? "openai").toLowerCase() === "azure") {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!apiKey || !endpoint || !deployment) {
      throw new Error("Azure OpenAI is selected, but its API key, endpoint, or deployment is missing.");
    }
    return {
      client: new AzureOpenAI({
        apiKey,
        endpoint,
        deployment,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview",
      }),
      model: deployment,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  };
}

export async function structuredResponse<Schema extends z.ZodType>(options: {
  name: string;
  schema: Schema;
  instructions: string;
  input: string | ResponseInput;
}): Promise<z.infer<Schema>> {
  const { client, model } = clientAndModel();
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "low" },
    instructions: options.instructions,
    input: options.input,
    text: { format: zodTextFormat(options.schema, options.name) },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a structured response.");
  }
  return options.schema.parse(response.output_parsed);
}
