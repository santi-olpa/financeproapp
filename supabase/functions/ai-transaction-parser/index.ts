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

    // La validación JWT la hace Supabase a nivel gateway.
    // Acá solo verificamos que haya un token presente.

    const { userInput, accounts, categories } = await req.json();
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
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

    const systemPrompt = `Sos un asistente financiero para una app de finanzas personales en Argentina.
Tu ÚNICA tarea es interpretar frases en español argentino sobre movimientos de plata y extraer datos estructurados.

CONTEXTO DEL USUARIO:
- Cuentas: ${accountNames}
- Categorías de gasto: ${expenseCategories}
- Categorías de ingreso: ${incomeCategories}

REGLAS:
1. Gasto/egreso/compré/pagué/gasté → type "expense"
2. Cobré/me pagaron/me transfirieron/ingreso/sueldo → type "income"
3. Pasé plata/transferí entre cuentas propias → type "transfer"
4. Mapeá cuentas y categorías a las disponibles. Si dice "MP" = Mercado Pago, "uala"/"Ualá" = Ualá, "galicia"/"banco" = buscar coincidencia.
5. Moneda default ARS salvo que diga "dólares", "USD", "US$", "verdes".
6. Modismos argentinos: "luca" = 1000, "dos lucas" = 2000, "palo" = 1.000.000, "mango" = peso, "gamba" = 100.
7. "super"/"súper" = Supermercado, "delivery"/"pedidos ya"/"rappi" = Restaurantes y delivery, "uber"/"taxi"/"bondi"/"sube" = Transporte, "luz"/"gas"/"agua" = Servicios.
8. Si dice "en 3 cuotas" o "en cuotas", igual extraé el monto total y type expense. Las cuotas se manejan aparte.
9. Números: "quince mil" = 15000, "5k" = 5000, "medio palo" = 500000.
10. Si no podés determinar cuenta o categoría, usá null.

Respondé SOLO con la función createTransaction.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userInput }] }],
        tools: [{
          function_declarations: [{
            name: "createTransaction",
            description: "Crea una transacción financiera con los datos extraídos",
            parameters: {
              type: "OBJECT",
              properties: {
                amount: { type: "NUMBER", description: "Monto numérico. Ej: 15000" },
                currency: { type: "STRING", enum: ["ARS", "USD"], description: "Moneda (default ARS)" },
                type: { type: "STRING", enum: ["income", "expense", "transfer"], description: "Tipo" },
                description: { type: "STRING", description: "Descripción breve" },
                accountName: { type: "STRING", description: "Cuenta del usuario" },
                categoryName: { type: "STRING", description: "Categoría inferida" },
                sourceAccountName: { type: "STRING", description: "Cuenta origen (transfers)" },
                destinationAccountName: { type: "STRING", description: "Cuenta destino (transfers)" },
              },
              required: ["amount", "type"],
            },
          }],
        }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["createTransaction"] } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso excedido. Intentá de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Gemini native format: candidates[0].content.parts[0].functionCall
    const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    if (!functionCall || functionCall.name !== "createTransaction") {
      console.error("Unexpected Gemini response:", JSON.stringify(data));
      throw new Error("No se pudo interpretar la transacción");
    }

    const parsedArgs = functionCall.args;
    
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
