import { jsonResponse, optionsResponse } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `You are an elite B2B sales engineer and proposal specialist. You receive raw enquiry/RFQ emails (often messy, forwarded, broken English, WhatsApp-style, or with mixed paragraphs) and convert them into clean, commercially-structured quotation data.

CRITICAL RULES:
1. IGNORE greetings, signatures, footers, disclaimers, "Sent from iPhone", forwarded headers, contact blocks at the bottom (those go into client info, not items).
2. EXTRACT only ACTUAL product/service requirements. If the email is ambiguous, infer the most commercially sensible item.
3. GROUP intelligently: if multiple specs (material, size, pressure, type) belong to ONE physical item, keep them as ONE row — never explode specs into separate rows.
4. NORMALIZE: "ss316" → "SS316", "stainless steel 316" → "SS316", "nos" → "Nos", "pcs" → "Nos", "kgs" → "Kg".

5. ⚠️ CATEGORY vs ITEM_NAME vs DESCRIPTION — this is the MOST important distinction. Get it right every time:
   • category = the PRODUCT FAMILY / equipment class, ALWAYS plural Title Case.
   • item_name = the SPECIFIC product / model / variant the buyer is asking for.
   • description = SPECS ONLY (capacity, size, pressure, rating, service fluid, temperature, lining, end-connections).

6. EVERY item MUST carry a non-empty category. Infer from item type if not stated.
7. CONSISTENT CATEGORIES: same family = same category string, plural Title Case.
8. MOC: grade only — SS316, SS304, CS, MS, PP, PTFE, etc. Empty string if not mentioned.
9. QUANTITY: numeric. Default 1 if clearly one item.
10. UNIT: Nos, Set, Mtr, Kg, Lot.
11. URGENCY: "low" | "normal" | "high".
12. Sort items so same category are adjacent.
13. Return clean fields via the build_quotation tool only.`;

const buildQuotationTool = {
  type: "function",
  function: {
    name: "build_quotation",
    description: "Build a structured quotation from the parsed enquiry email.",
    parameters: {
      type: "object",
      properties: {
        client: {
          type: "object",
          properties: {
            contact_person: { type: "string" },
            company_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
          },
          required: ["contact_person", "company_name", "email", "phone", "address"],
          additionalProperties: false,
        },
        subject: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              item_name: { type: "string" },
              description: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
              moc: { type: "string" },
            },
            required: ["category", "item_name", "description", "qty", "unit", "moc"],
            additionalProperties: false,
          },
        },
        terms: {
          type: "object",
          properties: {
            payment_terms: { type: "string" },
            delivery_terms: { type: "string" },
            delivery_timeline: { type: "string" },
            shipping_terms: { type: "string" },
            incoterms: { type: "string" },
          },
          required: ["payment_terms", "delivery_terms", "delivery_timeline", "shipping_terms", "incoterms"],
          additionalProperties: false,
        },
        notes: { type: "array", items: { type: "string" } },
        urgency: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["client", "subject", "items", "terms", "notes", "urgency"],
      additionalProperties: false,
    },
  },
};

async function callLovableGateway(email: string, apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract a quotation from this enquiry email:\n\n---\n${email}\n---` },
      ],
      tools: [buildQuotationTool],
      tool_choice: { type: "function", function: { name: "build_quotation" } },
    }),
  });
}

function parseToolResponse(data: { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] }) {
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return null;
  return JSON.parse(toolCall.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || email.trim().length < 10) {
      return jsonResponse({ error: "Email content is too short" }, 400);
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured." }, 500);
    }

    const resp = await callLovableGateway(email, lovableKey);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI error", resp.status, text);
      if (resp.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      }
      if (resp.status === 402) {
        return jsonResponse({ error: "AI credits exhausted." }, 402);
      }
      return jsonResponse({ error: "AI extraction failed" }, 500);
    }

    const data = await resp.json();
    const parsed = parseToolResponse(data);
    if (!parsed) {
      return jsonResponse({ error: "No structured output returned from AI" }, 500);
    }

    return jsonResponse(parsed);
  } catch (e) {
    console.error("extract-quotation error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
