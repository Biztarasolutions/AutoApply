const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function initDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('⚠️ WARNING: DATABASE_URL is not set in environment. Skipping database initialization.');
    return;
  }

  console.log('🚀 Connecting to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString,
    // Add SSL support for Supabase remote connection
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to database.');

    // 1. Check if profiles table exists
    const checkTableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
      );
    `);
    
    const tablesExist = checkTableRes.rows[0].exists;

    if (!tablesExist) {
      console.log('📂 Profiles table not found. Executing migrations...');
      
      const migrationPath = path.join(__dirname, '../supabase/migrations/01_init.sql');
      if (fs.existsSync(migrationPath)) {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await client.query(migrationSql);
        console.log('✅ Applied migration: 01_init.sql');
      } else {
        console.error('❌ Migration file not found at:', migrationPath);
      }

      // 2. Create Storage Buckets (via SQL queries to storage.buckets)
      console.log('📦 Setting up storage buckets...');
      try {
        await client.query(`
          INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
          VALUES 
            ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
            ('cover_letters', 'cover_letters', false, 5242880, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
          ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✅ Created storage buckets: resumes, cover_letters');
      } catch (err) {
        console.warn('⚠️ Warning: Failed to create storage buckets. It is possible the storage schema is not initialized yet in your database or you do not have permissions: ', err.message);
      }

      // 3. Seed data
      console.log('🌱 Seeding initial database tables...');
      const seedPath = path.join(__dirname, '../supabase/seed/seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await client.query(seedSql);
        console.log('✅ Database seeded successfully.');
      } else {
        console.warn('⚠️ Seed file not found at:', seedPath);
      }
    } else {
      console.log('✨ Database is already initialized. Skipping migration.');
    }

  } catch (err) {
    console.error('❌ Error during database initialization:', err.message);
  } finally {
    await client.end();
    console.log('🔌 Connection to database closed.');
  }
}

initDb();
