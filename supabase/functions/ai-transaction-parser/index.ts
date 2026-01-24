import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountContext {
  id: string;
  name: string;
  currency: string;
}

interface CategoryContext {
  id: string;
  name: string;
  category_type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userInput, accounts, categories } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for grounding
    const accountNames = (accounts as AccountContext[]).map(a => `"${a.name}" (${a.currency})`).join(", ");
    const expenseCategories = (categories as CategoryContext[])
      .filter(c => c.category_type === "expense")
      .map(c => `"${c.name}"`)
      .join(", ");
    const incomeCategories = (categories as CategoryContext[])
      .filter(c => c.category_type === "income")
      .map(c => `"${c.name}"`)
      .join(", ");

    const systemPrompt = `Eres un asistente financiero inteligente para una aplicación de finanzas personales en Argentina. 
Tu única tarea es interpretar frases del usuario sobre movimientos financieros y extraer datos estructurados.

CONTEXTO DEL USUARIO:
- Cuentas disponibles: ${accountNames}
- Categorías de gasto: ${expenseCategories}
- Categorías de ingreso: ${incomeCategories}

REGLAS IMPORTANTES:
1. Si el usuario menciona un gasto/egreso, el tipo es "expense"
2. Si el usuario menciona un ingreso/cobro/pago recibido, el tipo es "income"
3. Si el usuario menciona transferencia entre cuentas, el tipo es "transfer"
4. Mapea los nombres de cuentas y categorías a las opciones disponibles del usuario
5. Si no puedes determinar la cuenta, usa null
6. Si no puedes determinar la categoría, intenta inferirla del contexto o usa null
7. La moneda por defecto es ARS, a menos que el usuario mencione dólares/USD/US$
8. Si el usuario dice "Mercado Pago", "MP", "uala", "Ualá" busca la cuenta que coincida
9. Interpreta modismos argentinos: "luca" = 1000, "palo" = 1.000.000, "mango" = peso

Responde SOLO con la función createTransaction y los parámetros extraídos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "createTransaction",
              description: "Crea una transacción financiera con los datos extraídos de la frase del usuario",
              parameters: {
                type: "object",
                properties: {
                  amount: {
                    type: "number",
                    description: "El monto de la transacción en número. Ej: 15000 para 'quince mil'"
                  },
                  currency: {
                    type: "string",
                    enum: ["ARS", "USD"],
                    description: "La moneda de la transacción. Por defecto ARS"
                  },
                  type: {
                    type: "string",
                    enum: ["income", "expense", "transfer"],
                    description: "El tipo de transacción"
                  },
                  description: {
                    type: "string",
                    description: "Descripción breve del movimiento. Ej: 'Supermercado', 'Sueldo', 'Uber'"
                  },
                  accountName: {
                    type: "string",
                    description: "El nombre de la cuenta mencionada por el usuario. Debe coincidir con una de las cuentas disponibles"
                  },
                  categoryName: {
                    type: "string",
                    description: "El nombre de la categoría inferida. Debe coincidir con una de las categorías disponibles"
                  },
                  sourceAccountName: {
                    type: "string",
                    description: "Para transferencias: cuenta de origen"
                  },
                  destinationAccountName: {
                    type: "string",
                    description: "Para transferencias: cuenta de destino"
                  }
                },
                required: ["amount", "type"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "createTransaction" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso excedido. Intenta de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "createTransaction") {
      throw new Error("No se pudo interpretar la transacción");
    }

    const parsedArgs = JSON.parse(toolCall.function.arguments);
    
    // Map account and category names to IDs
    const result: any = {
      amount: parsedArgs.amount,
      currency: parsedArgs.currency || "ARS",
      type: parsedArgs.type,
      description: parsedArgs.description || null,
      accountId: null,
      categoryId: null,
      sourceAccountId: null,
      destinationAccountId: null,
    };

    // Find matching account
    if (parsedArgs.accountName) {
      const matchedAccount = (accounts as AccountContext[]).find(
        a => a.name.toLowerCase().includes(parsedArgs.accountName.toLowerCase()) ||
             parsedArgs.accountName.toLowerCase().includes(a.name.toLowerCase())
      );
      if (matchedAccount) {
        result.accountId = matchedAccount.id;
        result.accountName = matchedAccount.name;
      }
    }

    // Find matching category
    if (parsedArgs.categoryName) {
      const expectedType = parsedArgs.type === "income" ? "income" : "expense";
      const matchedCategory = (categories as CategoryContext[]).find(
        c => c.category_type === expectedType && 
             (c.name.toLowerCase().includes(parsedArgs.categoryName.toLowerCase()) ||
              parsedArgs.categoryName.toLowerCase().includes(c.name.toLowerCase()))
      );
      if (matchedCategory) {
        result.categoryId = matchedCategory.id;
        result.categoryName = matchedCategory.name;
      }
    }

    // For transfers, map source and destination accounts
    if (parsedArgs.type === "transfer") {
      if (parsedArgs.sourceAccountName) {
        const source = (accounts as AccountContext[]).find(
          a => a.name.toLowerCase().includes(parsedArgs.sourceAccountName.toLowerCase())
        );
        if (source) {
          result.sourceAccountId = source.id;
          result.sourceAccountName = source.name;
        }
      }
      if (parsedArgs.destinationAccountName) {
        const dest = (accounts as AccountContext[]).find(
          a => a.name.toLowerCase().includes(parsedArgs.destinationAccountName.toLowerCase())
        );
        if (dest) {
          result.destinationAccountId = dest.id;
          result.destinationAccountName = dest.name;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, transaction: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI transaction parser error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error al procesar la solicitud" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
