import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SYSTEM_PROMPT = `You are an elite AI Commercial Assistant embedded in a B2B quotation editor. You act like a senior proposal coordinator / sales engineer.

The user types natural-language commands (often broken English, Indian business English, procurement slang, shorthand). You MUST infer intent intelligently and translate the command into a sequence of STRUCTURED ACTIONS via the provided tool — never plain text.

You receive the CURRENT quotation JSON and the user command. Decide the minimal set of actions needed.

Rules:
- Always use the tool. Never reply in prose.
- Be conservative: do not delete or destroy data unless clearly requested.
- For pricing/discount/margin/tax/currency: use the dedicated actions.
- For wording / shortening / professional tone: use rewrite_items and pass NEW item_name/description for the affected items (preserve their id from the input).
- For layout requests (hide description column, merge desc into name, MOC position, compact/premium/minimal/tender mode): use set_layout.
- For grouping ("group all SS316", "group pump items"): use group_items.
- For "highlight urgent" / "highlight items above X": use highlight_items.
- For "add gst" → set_tax 18 (India default) unless another % is specified.
- For "remove empty rows" → remove_empty_rows. "Remove duplicates" → remove_duplicates.
- For "professional tone / cleaner / make premium" without other intent: rewrite_items on all items with tone=professional length=short, and consider set_layout mode=premium.
- For unit changes ("change all units to Nos"): set_unit_all.
- Always include a brief 'summary' of what you did (one sentence).
`;

const ACTION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One short sentence summarizing what changed." },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "apply_discount", "set_margin", "set_tax", "set_currency",
              "remove_empty_rows", "remove_duplicates", "highlight_items",
              "group_items", "ungroup_items", "set_unit_all", "rewrite_items",
              "set_layout", "set_terms", "add_note", "set_notes",
              "reorder_items", "delete_items", "update_items", "set_subject",
            ],
          },
          condition: { type: "object", additionalProperties: true },
          discount_percent: { type: "number" },
          increase_percent: { type: "number" },
          tax_percent: { type: "number" },
          currency: { type: "string" },
          on: { type: "boolean" },
          by: { type: "string", enum: ["moc", "name_contains"] },
          value: { type: "string" },
          group_label: { type: "string" },
          unit: { type: "string" },
          tone: { type: "string" },
          length: { type: "string" },
          items: { type: "array", items: { type: "object", additionalProperties: true } },
          layout: { type: "object", additionalProperties: true },
          terms: { type: "object", additionalProperties: true },
          note: { type: "string" },
          notes: { type: "array", items: { type: "string" } },
          ids: { type: "array", items: { type: "string" } },
          updates: { type: "array", items: { type: "object", additionalProperties: true } },
          subject: { type: "string" },
        },
        required: ["action"],
        additionalProperties: true,
      },
    },
  },
  required: ["summary", "actions"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { command, quotation } = await req.json();
    if (!command || typeof command !== "string") {
      return new Response(JSON.stringify({ error: "Missing command" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ctx = {
      currency: quotation?.currency,
      tax_percent: quotation?.tax_percent,
      layout: quotation?.layout,
      items: (quotation?.items || []).map((it: any) => ({
        id: it.id, item_name: it.item_name, description: it.description,
        qty: it.qty, unit: it.unit, moc: it.moc, unit_price: it.unit_price, discount: it.discount,
      })),
      terms: quotation?.terms,
      notes: quotation?.notes,
      subject: quotation?.subject,
    };

    const tool = {
      type: "function",
      function: {
        name: "apply_quotation_actions",
        description: "Return structured actions to mutate the quotation.",
        parameters: ACTION_SCHEMA,
      },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `CURRENT QUOTATION:\n${JSON.stringify(ctx)}\n\nUSER COMMAND:\n${command}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "apply_quotation_actions" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI assistant failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No structured output");
    const parsed = JSON.parse(tc.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
