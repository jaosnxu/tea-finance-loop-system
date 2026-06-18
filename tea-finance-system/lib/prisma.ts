let prismaClientSingleton: unknown;

export async function getPrismaClient() {
  if (prismaClientSingleton) {
    return prismaClientSingleton as any;
  }

  const { PrismaClient } = await import("@prisma/client");
  prismaClientSingleton = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return prismaClientSingleton as any;
}
