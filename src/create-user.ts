import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';

import { MongoIdentityProviderAdapter } from './contexts/identity/infrastructure/adapters/out/mongo/MongoIdentityProviderAdapter.js';
import { MongoAccountRoleRepository } from './contexts/identity/infrastructure/adapters/out/mongo/MongoAccountRoleRepository.js';
import { assignStudentRoleIfMissing } from './contexts/identity/infrastructure/seed/StudentAccountSeeder.js';

/**
 * Crea (o actualiza) una cuenta en MongoDB con rol `student`:
 *
 *   npm run user:create -- --email juan.perez@upb.edu.co --password 'Clave123!' \
 *     --name 'Juan Pérez' --program 'Ingeniería de Sistemas' --semester 4 --student-id 2024-0100
 *
 * Usa MONGODB_URI / MONGODB_DATABASE igual que el servidor HTTP. Si la cuenta
 * ya existia, reemplaza contrasena y perfil; el rol solo se asigna si la
 * cuenta no tenia uno (no degrada a un administrador).
 */
async function main(): Promise<void> {
  // En local lee .env si existe; en Railway las variables ya vienen inyectadas.
  try {
    process.loadEnvFile();
  } catch {
    // sin .env: se usan las variables del entorno
  }

  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      name: { type: 'string' },
      program: { type: 'string' },
      semester: { type: 'string' },
      'student-id': { type: 'string' }
    }
  });

  const { email, password, name, program } = values;
  const semester = Number(values.semester);
  if (!email || !password || !name || !program || !Number.isInteger(semester) || semester < 1) {
    throw new Error('Uso: --email --password --name --program --semester <entero> [--student-id]');
  }

  const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017');
  await client.connect();
  try {
    const db = client.db(process.env['MONGODB_DATABASE'] ?? 'upb_conecta');
    const normalizedEmail = email.trim().toLowerCase();
    const studentId = values['student-id'];

    await new MongoIdentityProviderAdapter(db).register({
      username: normalizedEmail,
      password,
      profile: { name, email: normalizedEmail, program, semester, ...(studentId ? { studentId } : {}) }
    });
    await assignStudentRoleIfMissing(new MongoAccountRoleRepository(db), normalizedEmail, 'cli');

    console.log(`Cuenta ${normalizedEmail} lista (rol: student).`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
