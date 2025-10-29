import { NextResponse } from "next/server";
import { z } from "zod";

import { executeAgentPlan } from "@/lib/agent/executor";
import { interpretInstruction } from "@/lib/agent/interpreter";
import type { AgentRequestPayload } from "@/lib/agent/types";
import { isMailchimpConfigured } from "@/lib/env";

const requestSchema = z.object({
  instruction: z.string().min(1, "An instruction is required."),
  config: z
    .object({
      listId: z.string().optional(),
      fromName: z.string().optional(),
      replyTo: z.string().email({ message: "Reply-To must be a valid email." }).optional(),
      defaultPreviewText: z.string().optional(),
      tags: z.array(z.string()).optional()
    })
    .partial()
    .optional()
});

type ValidatedRequest = z.infer<typeof requestSchema>;

export function GET() {
  return NextResponse.json({ configured: isMailchimpConfigured() });
}

export async function POST(request: Request) {
  let payload: AgentRequestPayload;

  try {
    payload = (await request.json()) as AgentRequestPayload;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const result = requestSchema.safeParse(payload as ValidatedRequest);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid input provided.",
        issues: result.error.flatten()
      },
      { status: 400 }
    );
  }

  const interpretation = interpretInstruction(result.data.instruction, result.data.config);
  const execution = await executeAgentPlan(interpretation.actions);

  return NextResponse.json({
    configured: isMailchimpConfigured(),
    summary: execution.summary,
    interpretation: interpretation.logs,
    execution: execution.logs,
    results: execution.results
  });
}
