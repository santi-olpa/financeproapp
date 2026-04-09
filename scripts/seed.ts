/**
 * Seed script para datos de prueba en Finance Pro.
 * Ejecutar: npx tsx scripts/seed.ts
 *
 * Requiere un usuario ya registrado. Usa las credenciales del .env.
 * Crea: cuentas, tarjeta, movimientos, recurrentes y una compra en cuotas.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aefnihoqzcrgvobgntnl.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_KEY) {
  console.error('Falta VITE_SUPABASE_PUBLISHABLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Login con usuario de prueba
const EMAIL = process.env.SEED_EMAIL || '';
const PASSWORD = process.env.SEED_PASSWORD || '';

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Setear SEED_EMAIL y SEED_PASSWORD como env vars.');
    console.error('Ejemplo: SEED_EMAIL=tu@email.com SEED_PASSWORD=tupass npx tsx scripts/seed.ts');
    process.exit(1);
  }

  console.log(`Autenticando como ${EMAIL}...`);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr || !auth.user) { console.error('Auth error:', authErr?.message); process.exit(1); }
  const userId = auth.user.id;
  console.log(`OK. user_id: ${userId}`);

  // Marcar onboarding como completado
  await supabase.from('profiles').update({ onboarding_completed: true }).eq('user_id', userId);

  // === CUENTAS ===
  console.log('Creando cuentas...');
  const accounts = [
    { name: 'Banco Galicia', account_type: 'bank', account_subtype: 'operating', currency: 'ARS', initial_balance: 450000, icon: 'bank', color: '#ef4444' },
    { name: 'Mercado Pago', account_type: 'wallet', account_subtype: 'operating', currency: 'ARS', initial_balance: 125000, icon: 'wallet', color: '#3b82f6' },
    { name: 'Efectivo', account_type: 'cash', account_subtype: 'operating', currency: 'ARS', initial_balance: 35000, icon: 'cash', color: '#22c55e' },
    { name: 'Cuenta USD', account_type: 'bank', account_subtype: 'reserve', currency: 'USD', initial_balance: 800, icon: 'bank', color: '#14b8a6' },
    { name: 'Visa Galicia', account_type: 'credit_card', account_subtype: 'liability', currency: 'ARS', initial_balance: 0, icon: 'credit_card', color: '#f97316', closing_day: 15, due_day: 5, credit_limit: 1500000 },
  ];

  const createdAccounts: Record<string, string> = {};
  for (const acc of accounts) {
    const { data, error } = await supabase.from('accounts').insert({
      user_id: userId,
      ...acc,
      current_balance: acc.initial_balance,
    }).select('id').single();
    if (error) { console.error(`Error cuenta ${acc.name}:`, error.message); continue; }
    createdAccounts[acc.name] = data.id;
    console.log(`  ${acc.name}: ${data.id}`);
  }

  const galiciaId = createdAccounts['Banco Galicia'];
  const mpId = createdAccounts['Mercado Pago'];
  const efectivoId = createdAccounts['Efectivo'];
  const visaId = createdAccounts['Visa Galicia'];

  // === CATEGORÍAS ===
  const { data: cats } = await supabase.from('categories').select('id, name').eq('is_system', true);
  const catMap: Record<string, string> = {};
  (cats ?? []).forEach(c => { catMap[c.name] = c.id; });

  // === MOVIMIENTOS ===
  console.log('Creando movimientos...');
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = today.getMonth() === 0
    ? `${today.getFullYear() - 1}-12`
    : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`;

  const transactions = [
    // Ingresos del mes
    { type: 'income', amount: 850000, description: 'Sueldo marzo', account_id: galiciaId, category: 'Sueldo', date: `${thisMonth}-05` },
    { type: 'income', amount: 320000, description: 'Proyecto freelance', account_id: mpId, category: 'Freelance', date: `${thisMonth}-12` },
    { type: 'income', amount: 75000, description: 'Venta MercadoLibre', account_id: mpId, category: 'Ventas', date: `${thisMonth}-18` },
    // Ingresos mes anterior
    { type: 'income', amount: 850000, description: 'Sueldo febrero', account_id: galiciaId, category: 'Sueldo', date: `${lastMonth}-05` },
    { type: 'income', amount: 150000, description: 'Freelance chico', account_id: mpId, category: 'Freelance', date: `${lastMonth}-20` },
    // Egresos del mes
    { type: 'expense', amount: 180000, description: 'Alquiler', account_id: galiciaId, category: 'Alquiler / Vivienda', date: `${thisMonth}-01` },
    { type: 'expense', amount: 45000, description: 'Supermercado Cordiez', account_id: mpId, category: 'Supermercado', date: `${thisMonth}-03` },
    { type: 'expense', amount: 38000, description: 'Supermercado Disco', account_id: efectivoId, category: 'Supermercado', date: `${thisMonth}-10` },
    { type: 'expense', amount: 52000, description: 'Supermercado semanal', account_id: mpId, category: 'Supermercado', date: `${thisMonth}-17` },
    { type: 'expense', amount: 15000, description: 'Uber + SUBE', account_id: mpId, category: 'Transporte', date: `${thisMonth}-08` },
    { type: 'expense', amount: 12000, description: 'Nafta', account_id: efectivoId, category: 'Transporte', date: `${thisMonth}-14` },
    { type: 'expense', amount: 25000, description: 'Internet Fibertel', account_id: galiciaId, category: 'Internet y telefonía', date: `${thisMonth}-10` },
    { type: 'expense', amount: 18000, description: 'Luz + Gas', account_id: galiciaId, category: 'Servicios (luz, agua, gas)', date: `${thisMonth}-15` },
    { type: 'expense', amount: 35000, description: 'Salida con amigos', account_id: mpId, category: 'Restaurantes y delivery', date: `${thisMonth}-07` },
    { type: 'expense', amount: 22000, description: 'Delivery PedidosYa', account_id: mpId, category: 'Restaurantes y delivery', date: `${thisMonth}-20` },
    { type: 'expense', amount: 8500, description: 'Netflix + Spotify', account_id: galiciaId, category: 'Suscripciones', date: `${thisMonth}-01` },
    { type: 'expense', amount: 15000, description: 'Farmacia', account_id: efectivoId, category: 'Salud', date: `${thisMonth}-11` },
    // Egresos mes anterior
    { type: 'expense', amount: 175000, description: 'Alquiler febrero', account_id: galiciaId, category: 'Alquiler / Vivienda', date: `${lastMonth}-01` },
    { type: 'expense', amount: 95000, description: 'Supermercado feb', account_id: mpId, category: 'Supermercado', date: `${lastMonth}-15` },
    { type: 'expense', amount: 42000, description: 'Restaurante', account_id: mpId, category: 'Restaurantes y delivery', date: `${lastMonth}-22` },
    // Transfer
    { type: 'transfer', amount: 50000, description: 'Paso a MP', source_account_id: galiciaId, destination_account_id: mpId, date: `${thisMonth}-06` },
  ];

  for (const tx of transactions) {
    const data: Record<string, unknown> = {
      user_id: userId,
      transaction_type: tx.type,
      amount: tx.amount,
      currency: 'ARS',
      description: tx.description,
      transaction_date: tx.date,
    };
    if (tx.type === 'transfer') {
      data.source_account_id = tx.source_account_id;
      data.destination_account_id = tx.destination_account_id;
    } else {
      data.account_id = tx.account_id;
      if (tx.category && catMap[tx.category]) data.category_id = catMap[tx.category];
    }
    const { error } = await supabase.from('transactions').insert(data);
    if (error) console.error(`  Error tx "${tx.description}":`, error.message);
  }
  console.log(`  ${transactions.length} movimientos creados.`);

  // === RECURRENTES ===
  console.log('Creando recurrentes...');
  const recurring = [
    { name: 'Alquiler', amount: 180000, category: 'Alquiler / Vivienda', account_id: galiciaId, frequency: 'monthly' },
    { name: 'Internet Fibertel', amount: 25000, category: 'Internet y telefonía', account_id: galiciaId, frequency: 'monthly' },
    { name: 'Luz + Gas', amount: 18000, category: 'Servicios (luz, agua, gas)', account_id: galiciaId, frequency: 'monthly' },
    { name: 'Netflix', amount: 5500, category: 'Suscripciones', account_id: galiciaId, frequency: 'monthly' },
    { name: 'Spotify', amount: 3000, category: 'Suscripciones', account_id: galiciaId, frequency: 'monthly' },
    { name: 'Gimnasio', amount: 22000, category: 'Salud', account_id: mpId, frequency: 'monthly' },
  ];

  for (const rec of recurring) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const { error } = await supabase.from('recurring_expenses').insert({
      user_id: userId,
      name: rec.name,
      amount: rec.amount,
      currency: 'ARS',
      category_id: catMap[rec.category] || null,
      account_id: rec.account_id,
      frequency: rec.frequency,
      start_date: `${thisMonth}-01`,
      next_due_date: nextMonth.toISOString().split('T')[0],
      is_active: true,
      price_history: [{ amount: rec.amount, effective_date: `${thisMonth}-01`, notes: 'Precio inicial' }],
    });
    if (error) console.error(`  Error rec "${rec.name}":`, error.message);
  }
  console.log(`  ${recurring.length} recurrentes creados.`);

  // === COMPRA EN CUOTAS ===
  console.log('Creando compra en cuotas...');
  if (visaId) {
    const { error } = await supabase.from('purchases').insert({
      user_id: userId,
      card_account_id: visaId,
      description: 'Notebook Lenovo IdeaPad',
      merchant: 'MercadoLibre',
      purchase_date: `${thisMonth}-08`,
      total_amount: 650000,
      original_currency: 'ARS',
      installments_count: 6,
      interest_rate: 0,
      category_id: catMap['Compras (ropa, tecnología)'] || null,
    });
    if (error) console.error('  Error compra:', error.message);
    else console.log('  Compra 6 cuotas creada (trigger genera installments).');

    // Segunda compra
    const { error: err2 } = await supabase.from('purchases').insert({
      user_id: userId,
      card_account_id: visaId,
      description: 'Zapatillas Nike Air',
      merchant: 'Dexter',
      purchase_date: `${lastMonth}-20`,
      total_amount: 120000,
      original_currency: 'ARS',
      installments_count: 3,
      interest_rate: 0,
      category_id: catMap['Compras (ropa, tecnología)'] || null,
    });
    if (err2) console.error('  Error compra 2:', err2.message);
    else console.log('  Compra 3 cuotas creada.');
  }

  // === RECALCULAR SALDOS ===
  console.log('Recalculando saldos...');
  await supabase.rpc('recalculate_all_account_balances', { p_user_id: userId });

  console.log('\nSeed completo. Recargá la app en el navegador.');
}

main().catch(e => { console.error(e); process.exit(1); });
