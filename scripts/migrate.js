const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  try {
    const migrationsDir = path.join(__dirname, '../src/lib/db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations folder not found at: ${migrationsDir}`);
      process.exit(1);
    }
    
    // Read all SQL files in the directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    console.log(`Found ${files.length} migration files. Processing...`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Executing migration file: ${file}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const statements = content.split('--> statement-breakpoint');
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;
        
        try {
          await sql.unsafe(stmt);
        } catch (err) {
          // Skip warnings if schema/type/relation already exists
          if (err.message.includes("already exists")) {
            // Silently skip or log warnings
          } else {
            console.error(`[✗] Statement failed in ${file}:`, err.message);
            throw err;
          }
        }
      }
      console.log(`[✓] File ${file} executed successfully.`);
    }
    
    console.log("All database migrations successfully applied!");
  } catch (err) {
    console.error("Migration execution failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
