const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'silkolo@gmail.com';
  const plain = 'Abcd1234';

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user) {
    console.log(JSON.stringify({ ok: false, message: 'USER_NOT_FOUND', email }));
    return;
  }

  const hash = await bcrypt.hash(plain, 10);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
    select: { id: true, email: true, role: true, isActive: true, updatedAt: true }
  });

  console.log(JSON.stringify({ ok: true, user: updated }));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ ok: false, message: e.message }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
