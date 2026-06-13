require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('✅ Connected to Supabase');

    const executed = [];
    const skipped = [];
    const failures = [];

    // ---------- Define Migrations and their check functions ----------
    const migrations = [
      {
        file: '005_resume_parser_fields.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'resumes' AND column_name = 'parser_confidence_score'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '006_ats_engine_fields.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ats_scores' AND column_name = 'raw_ai_response'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '007_ats_version.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ats_scores' AND column_name = 'ats_version'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '011_drop_duplicate_triggers.sql',
        check: async () => {
          // Check if triggers have already been cleaned up by checking if we have duplicate triggers
          // Or just run it since it is safe and idempotent. We'll check if they are dropped.
          const res = await client.query(`
            SELECT 1 FROM pg_trigger WHERE tgname IN (
              'set_question_memory_updated_at', 
              'set_automation_rules_updated_at', 
              'set_cover_letters_updated_at'
            )
          `);
          // If none of these exist, then we've already dropped duplicate triggers (or they never existed)
          // We return false to run it anyways since it's a DO block.
          return false;
        }
      },
      {
        file: '008_update_updated_at.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM pg_trigger WHERE tgname = 'set_question_memory_updated_at'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '009_job_match_history.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'job_match_history'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '010_ai_logs.sql',
        check: async () => {
          const res = await client.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_logs'
          `);
          return res.rows.length > 0;
        }
      },
      {
        file: '012_enable_rls_ai_logs.sql',
        check: async () => {
          const res = await client.query(`
            SELECT relrowsecurity FROM pg_class WHERE relname = 'ai_logs'
          `);
          return res.rows[0]?.relrowsecurity === true;
        }
      },
      {
        file: '013_enable_rls_job_match_history.sql',
        check: async () => {
          const res = await client.query(`
            SELECT relrowsecurity FROM pg_class WHERE relname = 'job_match_history'
          `);
          return res.rows[0]?.relrowsecurity === true;
        }
      }
    ];

    console.log('\n🚀 Starting Database Migration Execution');
    
    for (const m of migrations) {
      const isApplied = await m.check();
      if (isApplied) {
        skipped.push(m.file);
        console.log(`⏭️  Migration ${m.file} already applied, skipping.`);
      } else {
        const sqlPath = path.resolve(__dirname, '..', 'supabase', 'migrations', m.file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`🔧 Applying ${m.file}`);
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('COMMIT');
          executed.push(m.file);
          console.log(`✅ ${m.file} applied successfully.`);
        } catch (e) {
          await client.query('ROLLBACK');
          failures.push({ file: m.file, error: e.message });
          console.error(`❌ ${m.file} failed: ${e.message}`);
        }
      }
    }

    console.log('\n======================================');
    console.log('🏁 Migration Execution Result');
    console.log(`Status: ${failures.length === 0 ? 'SUCCESS' : 'FAILURE'}`);
    console.log('Executed Migrations:', executed);
    console.log('Skipped Migrations:', skipped);
    console.log('Failed Migrations:', failures);
    console.log('======================================\n');

    // ---------- RLS verification ----------
    console.log('🔒 RLS Verification Output:');
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE tablename IN (
        'ai_logs',
        'job_match_history'
      );
    `);
    console.table(rlsRes.rows);

    // ---------- Policy verification ----------
    console.log('📜 Policy Verification Output:');
    const policyRes = await client.query(`
      SELECT policyname, tablename, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename IN (
        'ai_logs',
        'job_match_history'
      );
    `);
    console.table(policyRes.rows);

    // ---------- Final migration report (JSON) ----------
    const reportPath = path.resolve(__dirname, '..', 'migration_report.json');
    const dbInspectRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type='BASE TABLE';
    `);
    const tables = dbInspectRes.rows.map(r => r.table_name);
    
    const rlsStatusRes = await client.query(`
      SELECT relname as table_name, relrowsecurity as rls_enabled
      FROM pg_class
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      WHERE pg_namespace.nspname = 'public' AND relkind = 'r';
    `);

    const finalReport = {
      timestamp: new Date().toISOString(),
      migration_status: failures.length === 0 ? 'SUCCESS' : 'FAILURE',
      executed,
      skipped,
      failures,
      rls_verification: rlsRes.rows,
      policies: policyRes.rows,
      tables,
      rls_status: rlsStatusRes.rows
    };

    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    console.log(`📝 Final migration report generated at ${reportPath}`);

  } catch (err) {
    console.error('❌ Migration process crashed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
