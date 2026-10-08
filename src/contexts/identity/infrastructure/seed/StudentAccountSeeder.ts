import type { AccountRoleRepositoryPort } from '../../domain/ports/out/AccountRoleRepositoryPort.js';
import { Role } from '../../domain/value-objects/Role.js';
import type { IdentityAccount, MongoIdentityProviderAdapter } from '../adapters/out/mongo/MongoIdentityProviderAdapter.js';

/**
 * Cuentas de estudiante de prueba que se crean en MongoDB al arrancar el
 * servidor HTTP (si no existen). Los programas son los de
 * `config/program-catalog.json`. Todas comparten la contrasena de la cuenta
 * historica de prueba para que el equipo de Android no tenga que recordar
 * varias.
 */
const TEST_PASSWORD = 'S3cr3t!UPB';

export const TEST_STUDENT_ACCOUNTS: readonly IdentityAccount[] = [
  student('estudiante@upb.edu.co', 'Ana Gómez', 'Ingeniería de Sistemas', 5, '2024-0001'),
  student('carlos.ramirez@upb.edu.co', 'Carlos Ramírez', 'Ingeniería de Sistemas', 3, '2024-0002'),
  student('laura.martinez@upb.edu.co', 'Laura Martínez', 'Ingeniería Industrial', 7, '2024-0003'),
  student('andres.lopez@upb.edu.co', 'Andrés López', 'Ingeniería Electrónica', 2, '2024-0004'),
  student('valentina.rojas@upb.edu.co', 'Valentina Rojas', 'Administración de Empresas', 4, '2024-0005'),
  student('santiago.herrera@upb.edu.co', 'Santiago Herrera', 'Contaduría Pública', 6, '2024-0006'),
  student('camila.torres@upb.edu.co', 'Camila Torres', 'Psicología', 8, '2024-0007'),
  student('mateo.castro@upb.edu.co', 'Mateo Castro', 'Periodismo', 1, '2024-0008')
];

function student(email: string, name: string, program: string, semester: number, studentId: string): IdentityAccount {
  return { username: email, password: TEST_PASSWORD, profile: { name, email, program, semester, studentId } };
}

export interface SeedReport {
  readonly created: readonly string[];
  readonly existing: readonly string[];
}

/**
 * Crea las cuentas que falten y les asigna `Role.STUDENT` en
 * `AccountRoleRepositoryPort`. Idempotente: no toca cuentas existentes ni
 * degrada a estudiante una cuenta que alguien ya promovio con
 * `ChangeAccountRole`.
 */
export async function seedStudentAccounts(
  users: MongoIdentityProviderAdapter,
  roles: AccountRoleRepositoryPort,
  accounts: readonly IdentityAccount[] = TEST_STUDENT_ACCOUNTS
): Promise<SeedReport> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const account of accounts) {
    const wasCreated = await users.registerIfAbsent(account);
    (wasCreated ? created : existing).push(account.profile.email.toLowerCase());
    await assignStudentRoleIfMissing(roles, account.profile.email, 'seed');
  }

  return { created, existing };
}

export async function assignStudentRoleIfMissing(
  roles: AccountRoleRepositoryPort,
  email: string,
  assignedBy: string
): Promise<void> {
  const subject = email.trim().toLowerCase();
  if (await roles.findBySubject(subject)) return;
  await roles.save({ subject, role: Role.STUDENT, assignedAt: new Date(), assignedBy });
}
