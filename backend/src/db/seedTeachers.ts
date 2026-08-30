import { hashPassword } from "../auth/passwords.js";
import { toClassId } from "../config/dataset.js";
import { prisma } from "./prisma.js";

/**
 * Seeds exactly the two dev accounts documented in the repo-root CLAUDE.md.
 * The sign-in screen's "Dev mode" panel shows these credentials directly, so
 * changing either side means updating both this file and
 * `frontend/src/components/SignIn.tsx` together.
 *
 * `teacher9a`'s scope is set to whichever classId the real seeded dataset
 * actually calls "Class 9" — the official fixture has no section split, so
 * this scopes them to the whole of Class 9 rather than a literal "Section A".
 */
const ACCOUNTS = [
  {
    username: "controller",
    password: "result2026",
    name: "Nasrin Akter",
    role: "Exam controller",
    scope: "*",
  },
  {
    username: "teacher9a",
    password: "class9a",
    name: "Abdul Karim",
    role: "Class teacher - Class 9",
    scope: toClassId("Class 9"),
  },
];

async function main(): Promise<void> {
  for (const account of ACCOUNTS) {
    const passwordHash = await hashPassword(account.password);
    await prisma.teacherAccount.upsert({
      where: { username: account.username },
      create: {
        username: account.username,
        passwordHash,
        name: account.name,
        role: account.role,
        scope: account.scope,
      },
      update: {
        passwordHash,
        name: account.name,
        role: account.role,
        scope: account.scope,
      },
    });
    console.log(`  ${account.username} (${account.role}, scope=${account.scope})`);
  }
  console.log("[seed-teachers] done");
}

main()
  .catch((error: unknown) => {
    console.error("[seed-teachers] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
