import 'dotenv/config';
import { db } from '../src/db/client';
import { educationStage, gradeLevel } from '../src/db/schema';
import { eq, asc } from 'drizzle-orm';

async function upsertStage(code: string, name: string, orderIndex: number) {
  const [inserted] = await db
    .insert(educationStage)
    .values({ code, name, orderIndex, isActive: true })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(educationStage)
    .where(eq(educationStage.code, code));
  if (!existing) throw new Error(`Failed to upsert stage ${code}`);
  return existing;
}

async function upsertGrade(stageId: string, code: string, name: string, orderIndex: number) {
  const [inserted] = await db
    .insert(gradeLevel)
    .values({ stageId, code, name, orderIndex })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;
  // On conflict, just read it back
  const [existing] = await db
    .select()
    .from(gradeLevel)
    .where(eq(gradeLevel.stageId, stageId))
    .orderBy(asc(gradeLevel.orderIndex));
  return existing;
}

async function run() {
  console.log('Seeding academics: stages and grade levels...');

  const stages = [
    { code: 'PRIMAIRE', name: 'Primaire', orderIndex: 1, grades: [
      'CP1','CP2','CP3','CP4','CP5','CP6'
    ]},
    { code: 'COLLEGE', name: 'Collège', orderIndex: 2, grades: [
      '6EME','5EME','4EME','3EME'
    ]},
    { code: 'LYCEE', name: 'Lycée', orderIndex: 3, grades: [
      '2NDE','1ERE','TLE'
    ]},
  ] as const;

  for (const s of stages) {
    const st = await upsertStage(s.code, s.name, s.orderIndex);
    let idx = 1;
    for (const g of s.grades) {
      await upsertGrade(st.id, g, g, idx++);
    }
    console.log(`Seeded stage ${s.code} with ${s.grades.length} grade levels`);
  }

  console.log('Done seeding academics.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});