// backend/services/db_inspect.js
// Utility to inspect current Supabase schema and generate a verification report
// Run via: node backend/services/db_inspect.js

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('✅ Connected to Supabase for inspection');

    // 1. List tables
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type='BASE TABLE';
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('\n📋 Tables:');
    console.table(tables);

    // 2. Columns per table
    const columnsRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `);
    const columns = {};
    columnsRes.rows.forEach(r => {
      if (!columns[r.table_name]) columns[r.table_name] = [];
      columns[r.table_name].push({ column: r.column_name, type: r.data_type, nullable: r.is_nullable });
    });
    console.log('\n📐 Detailed Schema Report:');
    Object.entries(columns).forEach(([tbl, cols]) => {
      console.log(`\nTable: ${tbl}`);
      console.table(cols);
    });

    // 3. Indexes
    const indexesRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public';
    `);
    console.log('\n🔑 Indexes:');
    console.table(indexesRes.rows.map(r => ({ Table: r.tablename, Index: r.indexname, Definition: r.indexdef })));

    // 4. RLS policies
    const rlsRes = await client.query(`
      SELECT relname as table_name, relrowsecurity as rls_enabled
      FROM pg_class
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      WHERE pg_namespace.nspname = 'public' AND relkind = 'r';
    `);
    console.log('\n🔒 RLS status:');
    console.table(rlsRes.rows);

    // Save report JSON
    const report = {
      tables,
      columns,
      indexes: indexesRes.rows,
      rls: rlsRes.rows,
    };
    const reportPath = path.resolve(__dirname, '..', 'migration_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\n📝 Full report saved to', reportPath);
  } catch (err) {
    console.error('❌ Inspection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
