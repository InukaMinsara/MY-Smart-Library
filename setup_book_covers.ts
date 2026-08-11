import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('d:/library/.env', 'utf-8');
const envVars = Object.fromEntries(
  envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('='))
);

const supabaseUrl = envVars.VITE_SUPABASE_URL?.trim().replace(/"/g, '');
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/"/g, '');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }

  const bucketName = 'book-covers';
  const exists = buckets.find(b => b.name === bucketName);

  if (!exists) {
    console.log(`Creating ${bucketName} bucket...`);
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log(`Bucket ${bucketName} created successfully!`);
    }
  } else {
    console.log(`Bucket ${bucketName} already exists.`);
    
    // Ensure it's public
    await supabaseAdmin.storage.updateBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
      fileSizeLimit: 5242880 // 5MB
    });
    console.log(`Bucket ${bucketName} updated to ensure it's public.`);
  }
}

createBucket();
